from pydantic import BaseModel, Field
from typing import Optional

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
