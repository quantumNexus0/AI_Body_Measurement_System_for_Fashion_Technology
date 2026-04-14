require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const crypto = require("crypto");

const connectDB = require("./config/db");
const seedDatabase = require("./utils/seedDatabase");

// ── Validate required env vars before anything else ─────────────────────────
const REQUIRED_ENV = ["PORT", "NODE_ENV", "ALLOWED_ORIGINS"];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error("");
  console.error("╔══════════════════════════════════════════════════════╗");
  console.error("║         BodyFit AI — Startup Configuration Error      ║");
  console.error("╠══════════════════════════════════════════════════════╣");
  console.error(`║  Missing required environment variable(s):            ║`);
  missingEnv.forEach((k) => console.error(`║    ✖  ${k.padEnd(48)}║`));
  console.error("╠══════════════════════════════════════════════════════╣");
  console.error("║  Fix:                                                 ║");
  console.error("║    bash setup.sh          (first-time setup)         ║");
  console.error("║    — or —                                             ║");
  console.error("║    cp .env.example server/.env  (then fill values)   ║");
  console.error("╚══════════════════════════════════════════════════════╝");
  console.error("");
  process.exit(1);
}

// ── Connect DB then seed if available ───────────────────────────────────────
connectDB()
  .then(async (dbAvailable) => {
    if (dbAvailable) {
      await seedDatabase().catch((err) => {
        console.error("[startup] Seed failed:", err.message);
      });
    } else {
      console.warn(
        "[startup] Database is unavailable. Server will continue in fallback mode.",
      );
    }
  })
  .catch((err) => {
    console.error("[startup] DB initialization failed:", err.message);
    console.warn("[startup] Continuing without database.");
  });

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers (helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "blob:", "data:"],
        scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for TF.js WASM
        workerSrc: ["blob:"],
        connectSrc: ["'self'"],
      },
    },
  }),
);

// ── CORS — only allow listed origins ────────────────────────────────────────
// Set ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com in .env
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",").map((o) =>
  o.trim(),
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Rate limiting ────────────────────────────────────────────────────────────
// General limiter for all /api routes
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please wait a moment.",
  },
});

// Strict limiter for the heavy measure endpoint
const measureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many measurement requests (max 10/min). Please wait.",
  },
});

const { requireAuth, measureLimiter } = require("./middleware/auth");

app.use("/api", generalLimiter);
// Protect all measurement routes with JWT and strict rate limiting
app.use("/api/v1/measure", requireAuth, measureLimiter); 

// ── Temp directory setup ─────────────────────────────────────────────────────
const TEMP_DIR = path.join(__dirname, "temp");

async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    console.log("[startup] Created temp directory:", TEMP_DIR);
  }
}

// Delete temp files older than 1 hour
async function cleanTempDir() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const cutoffMs = 60 * 60 * 1000; // 1 hour
    let removed = 0;

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stat = await fs.stat(filePath);
        if (Date.now() - stat.mtimeMs > cutoffMs) {
          await fs.unlink(filePath);
          removed++;
        }
      } catch {
        // File already deleted or inaccessible — ignore
      }
    }

    if (removed > 0) {
      console.log(`[cleanup] Removed ${removed} stale temp file(s)`);
    }
  } catch (err) {
    console.error("[cleanup] Error cleaning temp dir:", err.message);
  }
}

// Run cleanup at startup then every 30 minutes
ensureTempDir().then(() => {
  cleanTempDir();
  setInterval(cleanTempDir, 30 * 60 * 1000);
});

// ── Request logging middleware ───────────────────────────────────────────────
app.use((req, _res, next) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  req.requestId = requestId;
  req.startTime = Date.now();
  console.log(`[${requestId}] ${req.method} ${req.path}`);
  next();
});

// ── Health check (outside versioned router, always accessible) ───────────────
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "healthy",
    version: process.env.npm_package_version || "1.0.0",
    timestamp: new Date().toISOString(),
    uptime_s: Math.floor(process.uptime()),
    service: "BodyFit AI Measurement API",
  });
});

// ── Versioned API routes ─────────────────────────────────────────────────────
const v1Router = require("./routes/v1");
app.use("/api/v1", v1Router);

// ── 404 handler — catch unmatched routes ────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route '${req.method} ${req.path}' not found.`,
  });
});

// ── Global error handler — MUST be last, MUST have 4 params ─────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const elapsed = req.startTime ? Date.now() - req.startTime : null;

  // Log with request ID for traceability
  console.error(
    `[${req.requestId || "?"}] ERROR ${statusCode} (${elapsed}ms):`,
    err.message,
  );

  // Never leak stack traces to the client
  res.status(statusCode).json({
    success: false,
    error:
      statusCode < 500
        ? err.message // client errors are safe to show
        : "An internal error occurred. Please try again.",
    ...(process.env.NODE_ENV === "development" && { debug: err.stack }),
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[startup] BodyFit AI server running on port ${PORT}`);
  console.log(`[startup] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[startup] Environment : ${process.env.NODE_ENV}`);
  console.log(`[startup] Allowed origins: ${allowedOrigins.join(", ")}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[shutdown] Received ${signal}. Closing server gracefully…`);
  server.close(() => {
    console.log("[shutdown] HTTP server closed. Exiting.");
    process.exit(0);
  });

  // Force-exit if server hasn't closed after 10 seconds
  setTimeout(() => {
    console.error("[shutdown] Forced exit after timeout.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = app;
