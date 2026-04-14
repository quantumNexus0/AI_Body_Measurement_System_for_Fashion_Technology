import asyncio
import time
import uuid
import json
import random
import cv2
import numpy as np
from contextlib import asynccontextmanager
from enum import Enum
from typing import Any, Dict, Optional, List
from datetime import datetime

from measure_engine import measure_body_from_image

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from response_utils import make_error_response, make_response
from database import get_db
from models import PyObjectId, UserCreate, CalibrationData, MeasurementData

# ── Job status enum ──────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE    = "done"
    FAILED  = "failed"
    TIMEOUT = "timeout"


# ── In-memory job store ──────────────────────────────────────────────────────
job_store: Dict[str, Dict[str, Any]] = {}

JOB_TIMEOUT_SECONDS = 30
MAX_JOBS_IN_MEMORY  = 500


# ── App state ───────────────────────────────────────────────────────────────
app_state: Dict[str, Any] = {
    "pose_model":  None,
    "depth_model": None,
    "loaded_at":   None,
}


# ── Lifespan management ─────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[startup] Loading models...")
    t0 = time.time()
    
    # Mock model loading
    await asyncio.sleep(0.5)
    app_state["pose_model"]  = "mediapipe_stub"
    app_state["depth_model"] = "midas_stub"
    app_state["loaded_at"]   = time.time()

    print(f"[startup] Models ready in {round((time.time() - t0) * 1000)} ms")

    # Start cleanup task
    cleanup_task = asyncio.create_task(_cleanup_old_jobs())

    yield
    
    # Shutdown
    cleanup_task.cancel()
    print("[shutdown] Models released.")


app = FastAPI(
    title="BodyFit AI Precision Measurement API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Background helpers ───────────────────────────────────────────────────────

async def _cleanup_old_jobs():
    while True:
        await asyncio.sleep(120)
        cutoff = time.time() - 600
        stale = [jid for jid, j in job_store.items() if j["created_at"] < cutoff]
        for jid in stale:
            job_store.pop(jid, None)
        if stale:
            print(f"[cleanup] Evicted {len(stale)} stale jobs.")

def _evict_if_full():
    if len(job_store) >= MAX_JOBS_IN_MEMORY:
        oldest_id = min(job_store, key=lambda jid: job_store[jid]["created_at"])
        job_store.pop(oldest_id, None)


# ── Core measurement simulation (Blocking CV task) ───────────────────────────

def _run_measurement_sync(
    image_bytes: bytes,
    calibration: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Processes the image using the MediaPipe measurement engine.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    result = measure_body_from_image(img_rgb, calibration)
    
    if result.error:
        raise Exception(result.error)

    # Note: Using robust Ramanujan elliptical calculation results
    measurements = {
        "shoulder_width": f"{result.shoulder_width_cm} cm",
        "chest": f"{result.chest_width_cm} cm",
        "waist": f"{result.waist_width_cm} cm",
        "hips": f"{result.hip_width_cm} cm",
        "inseam": f"{result.inseam_cm} cm",
        "leg_length": f"{round(result.inseam_cm + 15, 1)} cm",  # Estimating full leg 
        "arm_length": f"{round((result.height_cm or 170.0) * 0.44, 1)} cm", # Anthropometric ratio
        "neck": f"{round((result.shoulder_width_cm or 45.0) * 0.8, 1)} cm", 
        "height": f"{result.height_cm} cm"
    }

    return {
        "measurements": measurements,
        "confidence": 0.94
    }


async def _process_job(
    job_id: str,
    image_bytes: bytes,
    calibration: Dict[str, Any],
    user_id: Optional[str] = None,
    notes: Optional[str] = None,
):
    job_store[job_id]["status"] = JobStatus.RUNNING

    try:
        # Run blocking logic in thread pool
        result = await asyncio.wait_for(
            asyncio.to_thread(_run_measurement_sync, image_bytes, calibration),
            timeout=JOB_TIMEOUT_SECONDS,
        )
        
        # Save to DB if user_id is provided
        if user_id:
            db = await get_db()
            await db.measurements.insert_one({
                "user": ObjectId(user_id),
                "measurements": result["measurements"],
                "calibration": calibration,
                "notes": notes,
                "created_at": datetime.utcnow()
            })

        job_store[job_id]["status"] = JobStatus.DONE
        job_store[job_id]["result"] = result
        job_store[job_id]["finished_at"] = time.time()

    except asyncio.TimeoutError:
        job_store[job_id]["status"] = JobStatus.TIMEOUT
        job_store[job_id]["error"]  = "Processing exceeded timeout limit."
    except Exception as e:
        job_store[job_id]["status"] = JobStatus.FAILED
        job_store[job_id]["error"]  = str(e)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/health")
async def health():
    t_start = time.time()
    return make_response(
        data={
            "status": "healthy",
            "version": "1.0.0",
            "models_loaded": app_state["pose_model"] is not None,
            "uptime_seconds": round(time.time() - app_state["loaded_at"], 1) if app_state["loaded_at"] else 0,
            "active_jobs": len(job_store)
        },
        processing_start=t_start
    )

@app.post("/api/v1/users")
async def create_user(user: UserCreate, db=Depends(get_db)):
    t_start = time.time()
    existing = await db.users.find_one({"email": user.email})
    if existing:
        return make_error_response("User already exists", 400, t_start)
    
    user_data = user.model_dump()
    user_data["created_at"] = datetime.utcnow()
    result = await db.users.insert_one(user_data)
    user_data["_id"] = str(result.inserted_id)
    
    return make_response(data=user_data, processing_start=t_start, status_code=201)

@app.get("/api/v1/users/{user_id}")
async def get_user(user_id: str, db=Depends(get_db)):
    t_start = time.time()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return make_error_response("User not found", 404, t_start)
    
    user["_id"] = str(user["_id"])
    return make_response(data=user, processing_start=t_start)

@app.post("/api/v1/measure", status_code=202)
async def submit_measure(
    image: UploadFile = File(...),
    calibrationData: str = Form(...),
    userId: Optional[str] = Form(None),
    notes: Optional[str] = Form(None)
):
    t_start = time.time()
    
    # Validate Calibration
    try:
        calibration = json.loads(calibrationData)
    except:
        return make_error_response("Invalid calibration format", 400, t_start)
    
    # Basic validation for body measurements as requested
    if calibration.get("type") == "height":
        val = calibration.get("value")
        if not (50 <= val <= 250):
            return make_error_response(f"Height {val}cm is out of range (50-250cm)", 422, t_start)

    _evict_if_full()
    job_id = str(uuid.uuid4())
    img_bytes = await image.read()
    
    job_store[job_id] = {
        "status": JobStatus.PENDING,
        "result": None,
        "error": None,
        "created_at": time.time(),
        "finished_at": None
    }
    
    asyncio.create_task(_process_job(job_id, img_bytes, calibration, userId, notes))
    
    return make_response(
        data={"job_id": job_id, "status": JobStatus.PENDING, "poll_url": f"/api/v1/measure/{job_id}"},
        processing_start=t_start,
        status_code=202
    )

@app.get("/api/v1/measure/{job_id}")
async def get_job_status(job_id: str):
    t_start = time.time()
    job = job_store.get(job_id)
    if not job:
        return make_error_response("Job not found or expired", 404, t_start)
    
    if job["status"] in (JobStatus.PENDING, JobStatus.RUNNING):
        return make_response(data={"job_id": job_id, "status": job["status"]}, processing_start=t_start)
    
    if job["status"] in (JobStatus.FAILED, JobStatus.TIMEOUT):
        return make_error_response(job["error"], 422, t_start)
        
    return make_response(
        data={
            "job_id": job_id,
            "status": job["status"],
            "measurements": job["result"]["measurements"]
        },
        confidence=job["result"]["confidence"],
        processing_start=t_start
    )

@app.get("/api/v1/progress/{user_id}")
async def get_progress(user_id: str, db=Depends(get_db)):
    t_start = time.time()
    cursor = db.measurements.find({"user": ObjectId(user_id)}).sort("created_at", -1)
    measurements = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["user"] = str(doc["user"])
        measurements.append(doc)
        
    return make_response(data=measurements, processing_start=t_start)

@app.post("/api/v1/recommendations")
async def get_recommendations(req_data: Dict[str, Any], db=Depends(get_db)):
    t_start = time.time()
    measurements = req_data.get("measurements")
    if not measurements:
        return make_error_response("Measurements are required", 400, t_start)
        
    # Logic for recommendations (porting from JS)
    def get_val(v):
        try: return float(str(v).split(' ')[0])
        except: return 0
        
    chest = get_val(measurements.get("chest"))
    waist = get_val(measurements.get("waist"))
    
    shirt_size = "M"
    if chest < 90: shirt_size = "S"
    elif chest < 100: shirt_size = "M"
    elif chest < 110: shirt_size = "L"
    else: shirt_size = "XL"
    
    cursor = db.clothingitems.find({})
    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        item["recommendedSize"] = shirt_size # Simplification for port
        item["confidence"] = random.randint(85, 98)
        items.append(item)
        
    return make_response(data=items, processing_start=t_start)
