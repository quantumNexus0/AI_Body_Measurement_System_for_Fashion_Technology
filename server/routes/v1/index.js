const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const http = require("http");
const https = require("https");

const userController = require("../../controllers/userController");
const measureController = require("../../controllers/measureController");
const {
  calibrationValidator,
  measurementValidator,
} = require("../../middleware/validator");

// ── Multer — keep image in memory for forwarding to Python ───────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB (matches Python limit)
});

// ── Python microservice proxy helper ─────────────────────────────────────────
// Node.js calls Python privately; the browser never hits :8000 directly.

const PYTHON_URL = new URL(
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000",
);

/**
 * Forward a multipart request to the Python microservice and pipe the
 * response back. Uses only built-in `http` / `https` — no extra deps.
 */
async function callPython(path, bodyBuffer, contentType) {
  return new Promise((resolve, reject) => {
    const lib = PYTHON_URL.protocol === "https:" ? https : http;
    const options = {
      hostname: PYTHON_URL.hostname,
      port: PYTHON_URL.port || (PYTHON_URL.protocol === "https:" ? 443 : 80),
      path,
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "Content-Length": bodyBuffer.length,
      },
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, body: Buffer.concat(chunks) }),
      );
    });

    req.on("error", reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// ── v1 Health check ──────────────────────────────────────────────────────────
router.get("/health", async (req, res) => {
  // Attempt to fetch Python microservice health (optional, non-blocking)
  let pythonStatus = { reachable: false };
  try {
    const lib = PYTHON_URL.protocol === "https:" ? https : http;
    const pyHealth = await new Promise((resolve, reject) => {
      lib
        .get(`${PYTHON_URL.origin}/api/v1/health`, (r) => {
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch {
              resolve({ reachable: true, raw: true });
            }
          });
        })
        .on("error", reject);
    });
    pythonStatus = { reachable: true, ...pyHealth.data };
  } catch {
    pythonStatus = {
      reachable: false,
      reason: "Python microservice unreachable",
    };
  }

  res.json({
    success: true,
    version: "v1",
    uptime: Math.floor(process.uptime()) + "s",
    timestamp: new Date().toISOString(),
    python_microservice: pythonStatus,
  });
});

// ── Users ────────────────────────────────────────────────────────────────────
router.post("/users", measurementValidator, userController.createUser);
router.get("/users/:id", userController.getUser);

// ── Measurements — Node validates, then proxies image to Python ──────────────
router.post(
  "/measure",
  upload.single("image"),
  calibrationValidator,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No image provided",
        });
      }

      let calibrationData;
      try {
        calibrationData =
          typeof req.body.calibrationData === "string"
            ? JSON.parse(req.body.calibrationData || "{}")
            : req.body.calibrationData || {};
      } catch {
        return res.status(400).json({
          success: false,
          error: "Invalid calibration data",
        });
      }

      if (!calibrationData.value || calibrationData.value <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid calibration data",
        });
      }

      if (!process.env.PYTHON_SERVICE_URL) {
        return res.status(503).json({
          success: false,
          error:
            "Python microservice is not configured (PYTHON_SERVICE_URL missing).",
        });
      }

      const processedImage = await sharp(req.file.buffer)
        .resize(800, 800, { fit: "inside" })
        .normalize()
        .toBuffer();

      // Re-assemble the multipart body to forward to Python.
      const boundary = `----NodeGatewayBoundary${Date.now()}`;
      const CRLF = "\r\n";
      const parts = [];

      // Image field
      parts.push(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="image"; filename="${req.file.originalname}"${CRLF}` +
          `Content-Type: ${req.file.mimetype}${CRLF}${CRLF}`,
      );
      parts.push(processedImage);
      parts.push(CRLF);

      // calibrationData field
      const calibrationStr =
        typeof req.body.calibrationData === "string"
          ? req.body.calibrationData
          : JSON.stringify(req.body.calibrationData);

      parts.push(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="calibrationData"${CRLF}${CRLF}` +
          `${calibrationStr}${CRLF}`,
      );

      // Optional userId + notes
      for (const field of ["userId", "notes"]) {
        if (req.body[field]) {
          parts.push(
            `--${boundary}${CRLF}` +
              `Content-Disposition: form-data; name="${field}"${CRLF}${CRLF}` +
              `${req.body[field]}${CRLF}`,
          );
        }
      }

      parts.push(`--${boundary}--${CRLF}`);

      const bodyBuffer = Buffer.concat(
        parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, "utf8"))),
      );
      const contentType = `multipart/form-data; boundary=${boundary}`;

      const { status, body } = await callPython(
        "/api/v1/measure",
        bodyBuffer,
        contentType,
      );

      // Forward Python's response envelope verbatim back to the browser
      res.status(status).set("Content-Type", "application/json").send(body);
    } catch (err) {
      console.error(`[${req.requestId}] Python proxy error:`, err.message);
      res.status(502).json({
        success: false,
        error: "Could not reach the measurement service. Please try again.",
      });
    }
  },
);

// Poll job status — forward directly to Python
router.get("/measure/:jobId", async (req, res) => {
  try {
    const lib = PYTHON_URL.protocol === "https:" ? https : http;
    const pyRes = await new Promise((resolve, reject) => {
      lib
        .get(`${PYTHON_URL.origin}/api/v1/measure/${req.params.jobId}`, (r) => {
          const chunks = [];
          r.on("data", (c) => chunks.push(c));
          r.on("end", () =>
            resolve({ status: r.statusCode, body: Buffer.concat(chunks) }),
          );
        })
        .on("error", reject);
    });
    res
      .status(pyRes.status)
      .set("Content-Type", "application/json")
      .send(pyRes.body);
  } catch {
    res
      .status(502)
      .json({ success: false, error: "Measurement service unreachable." });
  }
});

// ── Progress history — served from MongoDB by Node.js ───────────────────────
router.get("/progress/:userId", measureController.getUserProgress);

// ── Recommendations ──────────────────────────────────────────────────────────
router.post(
  "/recommendations",
  measurementValidator,
  measureController.getRecommendations,
);

module.exports = router;
