import os
import time
import tempfile
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware

from models import MeasurementResponse, SizeRecommendation
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
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type", "x-internal-token"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}

# ── V1 Route (legacy) ─────────────────────────────────────────────────────────
@app.post("/measure", response_model=MeasurementResponse)
async def measure(
    image: UploadFile = File(...),
    calibration_type: str = Form(...),
    calibration_value: float = Form(...),
    gender: str = Form("n"),
    _: str = Depends(verify_internal_token),
):
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Unsupported image type")

    raw = await image.read()
    try:
        result = await engine.process(raw, calibration_type, calibration_value, gender)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(500, "Internal processing error")

    return result

# ── V2 Measure Route ──────────────────────────────────────────────────────────
@app.post("/api/v2/measure")
async def measure_v2(
    image: UploadFile = File(...),
    height_cm: float = Form(170.0),
    unit: str = Form("cm"),
    _: str = Depends(verify_internal_token),
):
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Unsupported image type")

    raw = await image.read()

    # Write bytes to a temp file since measure_v2 now uses cv2.imread
    suffix = ".jpg" if "jpeg" in (image.content_type or "") else ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        t0 = time.monotonic()
        calibration = {"type": "height", "value": height_cm, "unit": unit}
        result = process_measurements(tmp_path, calibration)
        result["processing_ms"] = int((time.monotonic() - t0) * 1000)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error(f"V2 Processing error: {e}")
        raise HTTPException(500, "Internal processing error")
    finally:
        os.unlink(tmp_path)

    return result

# ── V2 Recommendation Route ───────────────────────────────────────────────────
@app.post("/api/v2/recommend", response_model=SizeRecommendation)
async def recommend(
    payload: dict = Body(...),
    _: str = Depends(verify_internal_token),
):
    measurements = payload.get("measurements", {})
    brand = payload.get("brand", "standard")
    garment_type = payload.get("garment_type", "top")

    if not measurements:
        raise HTTPException(400, "measurements field is required")

    try:
        # Parse measurement values from either string "94.5 cm" or numeric formats
        processed_m = {}
        for k, v in measurements.items():
            if isinstance(v, dict):
                processed_m[k] = float(v.get("value") or v.get("value_cm", 0))
            elif isinstance(v, str):
                # e.g. "94.5 cm" → 94.5
                processed_m[k] = float(v.split()[0])
            else:
                processed_m[k] = float(v)

        return size_engine.recommend(processed_m, brand, garment_type)
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        raise HTTPException(400, f"Recommendation failed: {e}")
