import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from models import MeasurementResponse, MeasurementResponseV2, SizeRecommendation
from engine import MeasurementEngine
from measure_v2 import process_measurements
from size_engine import SizeRecommendationEngine
from auth import verify_internal_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = MeasurementEngine()
size_engine = SizeRecommendationEngine()

app = FastAPI(title="BodyFit Measurement Engine V2")

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

@app.post("/api/v2/measure", response_model=MeasurementResponseV2)
async def measure_v2(
    image: UploadFile = File(...),
    height_cm: float = Form(170.0),
    unit: str = Form("cm"),
    _: str = Depends(verify_internal_token),
):
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Unsupported image type")
    
    raw = await image.read()
    try:
        t0 = time.monotonic()
        result = await process_measurements(raw, height_cm, unit)
        result["processing_ms"] = int((time.monotonic() - t0) * 1000)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"V2 Processing error: {str(e)}")
        raise HTTPException(500, "Internal processing error")
    
    return result

@app.post("/api/v2/recommend", response_model=SizeRecommendation)
async def recommend(
    measurements: dict,
    brand: str = "standard",
    garment_type: str = "top",
    _: str = Depends(verify_internal_token),
):
    try:
        # Extract numeric values from measurements if they are in the V2 object-like format
        # Or if they are coming from the V1 SingleMeasurement format
        processed_m = {}
        for k, v in measurements.items():
            if isinstance(v, dict) and "value" in v:
                processed_m[k] = v["value"]
            elif isinstance(v, dict) and "value_cm" in v:
                processed_m[k] = v["value_cm"]
            else:
                processed_m[k] = float(v)
        
        return size_engine.recommend(processed_m, brand, garment_type)
    except Exception as e:
        logger.error(f"Recommendation error: {str(e)}")
        raise HTTPException(400, f"Recommendation failed: {str(e)}")
