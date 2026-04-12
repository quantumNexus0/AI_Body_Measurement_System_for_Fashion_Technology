# BodyFit AI — Service Architecture

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
│                                                                 │
│  ┌──────────────┐       Pose Preview Only (real-time)          │
│  │  TF.js       │  ──── MediaPipe / MoveNet keypoints ──►      │
│  │  MoveNet     │  NO measurements computed here               │
│  └──────────────┘                                               │
│                                                                 │
│  ┌──────────────┐  POST /api/v1/measure  ┌──────────────────┐  │
│  │  React UI    │ ─────────────────────► │  Vite Dev Proxy  │  │
│  │              │ ◄───────────────────── │  :5173 → :3001   │  │
│  └──────────────┘  { job_id, results }  └──────────────────┘  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ HTTP :3001
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              NODE.JS API GATEWAY  (port 3001)                   │
│                                                                 │
│  • CORS enforcement (whitelist: ALLOWED_ORIGINS)                │
│  • Rate limiting (60 req/min general, 10 req/min /measure)      │
│  • Helmet security headers                                       │
│  • Input validation (express-validator)                          │
│  • MongoDB read/write (users, history, recommendations)          │
│  • Forwards image + calibration to Python microservice          │
│                                                                 │
│  Routes:                                                        │
│    GET  /api/health          → liveness check                   │
│    GET  /api/v1/health       → detailed status                  │
│    POST /api/v1/users        → create user                      │
│    GET  /api/v1/users/:id    → get user                         │
│    POST /api/v1/measure      → proxy to Python, save result     │
│    GET  /api/v1/measure/:id  → poll job status (from Python)    │
│    GET  /api/v1/progress/:id → measurement history (MongoDB)    │
│    POST /api/v1/recommendations → size recommendations          │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ HTTP :8000 (PRIVATE — LAN only)
                                   │ Never exposed to the browser
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│           PYTHON MICROSERVICE  (port 8000, FastAPI)             │
│                                                                 │
│  • Async job queue (asyncio, in-memory)                         │
│  • Image processing (Pillow / future: OpenCV + MediaPipe)       │
│  • Pose estimation stub (future: MiDaS depth model)             │
│  • Measurement computation + confidence scoring                  │
│  • Responds with standard { success, data, meta } envelope      │
│                                                                 │
│  Routes (private — called only by Node.js):                     │
│    GET  /api/v1/health              → model + uptime status     │
│    POST /api/v1/measure             → submit job (returns 202)  │
│    GET  /api/v1/measure/{job_id}    → poll job result           │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MONGODB ATLAS / LOCAL                        │
│                                                                 │
│  Collections:  users · measurements · clothingitems            │
│  Accessed by:  Node.js only (via Mongoose)                      │
│  NOT accessed: Python microservice (it returns raw results)     │
└─────────────────────────────────────────────────────────────────┘
```

## Service Responsibilities — Single Source of Truth

| Concern               | Browser (TF.js) | Node.js Gateway | Python Microservice |
|-----------------------|:---------------:|:---------------:|:-------------------:|
| Real-time pose preview | ✅              | ❌              | ❌                  |
| Final measurements     | ❌              | Proxies         | ✅ Computes         |
| CORS enforcement       | N/A             | ✅              | ❌ (private)        |
| Auth / rate limiting   | ❌              | ✅              | ❌                  |
| MongoDB reads/writes   | ❌              | ✅              | ❌                  |
| ML model inference     | ❌              | ❌              | ✅                  |

## Rules

1. **The browser NEVER calls the Python backend directly.**
   The Python service listens on port `8000` but must be firewalled / not
   publicly exposed. All browser traffic goes through Node.js (port `3001`).

2. **TF.js MoveNet is for preview only.**
   Keypoints rendered in the browser are used for UI feedback (alignment
   guide, skeleton overlay). The actual body measurements are computed
   server-side by the Python service.

3. **Node.js is the single API gateway.**
   It owns authentication, rate limiting, CORS, database writes, and
   request tracing. It delegates heavy CV work to Python.

4. **Adding v2 routes does not touch v1.**
   Import a new `routes/v2/index.js` and mount it at `/api/v2` in
   `server/index.js`. The v1 module stays untouched.

## Local Development Setup

```
# Terminal 1 — Python microservice (private)
cd python_backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Node.js API gateway + React frontend
cd ..
npm run dev        # runs Node.js :3001 + Vite :5173 concurrently
```

### Required `.env` (copy from `.env.example`):

```
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/bodyfitai
ALLOWED_ORIGINS=http://localhost:5173
PYTHON_SERVICE_URL=http://localhost:8000
```
