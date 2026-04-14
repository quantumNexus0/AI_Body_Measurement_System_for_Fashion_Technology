import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from models import MeasurementResponse
from engine import MeasurementEngine
from auth import verify_internal_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine: MeasurementEngine | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("Loading MoveNet + MiDaS models...")
    engine = MeasurementEngine()
    await engine.load_models()
    logger.info("Models ready.")
    yield
    engine = None

app = FastAPI(title="BodyFit Measurement Engine", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=[os.getenv("NODE_ORIGIN", "http://localhost:3001")],
    allow_methods=["POST"],
    allow_headers=["Authorization", "Content-Type", "x-internal-token"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": engine is not None}

@app.post("/measure", response_model=MeasurementResponse)
async def measure(
    image: UploadFile = File(...),
    calibration_type: str = Form(...),   # "height" | "reference"
    calibration_value: float = Form(...), # cm
    gender: str = Form("n"),              # "m" | "f" | "n"
    _: str = Depends(verify_internal_token),
):
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Unsupported image type")
    
    # Optional file size check
    # if image.size and image.size > 20 * 1024 * 1024:
    #     raise HTTPException(400, "Image too large (max 20 MB)")

    raw = await image.read()
    try:
        result = await engine.process(raw, calibration_type,
                                       calibration_value, gender)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"Processing error: {str(e)}")
        raise HTTPException(500, "Internal processing error")
    
    return result
