from pydantic import BaseModel, Field
from typing import Optional, List, Dict

class SingleMeasurement(BaseModel):
    value_mm: float
    value_cm: float
    confidence: float = Field(ge=0.0, le=1.0)
    warning: Optional[str] = None

class MeasurementResponse(BaseModel):
    shoulder_width: SingleMeasurement
    chest:          SingleMeasurement
    waist:          SingleMeasurement
    hips:           SingleMeasurement
    arm_length:     SingleMeasurement
    leg_length:     SingleMeasurement
    inseam:         SingleMeasurement
    neck:           SingleMeasurement
    pose_quality:   float
    processing_ms:  int = 0

class V2Measurement(BaseModel):
    value: float
    unit: str = "cm"

class MeasurementResponseV2(BaseModel):
    session_id: str
    measurements: Dict[str, V2Measurement]
    pixels_per_cm: float
    overall_confidence: float
    model: str = "mediapipe-blazepose-heavy"
    processing_ms: int = 0

class SizeRecommendation(BaseModel):
    primary_size: str
    alternative_size: str
    fit_notes: str
    specific_recommendations: List[str]
    size_chart: Dict[str, str]
    confidence: float
