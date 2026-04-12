from pydantic import BaseModel, Field, EmailStr, ConfigDict, BeforeValidator
from typing import List, Optional, Dict, Annotated, Any
from datetime import datetime
from bson import ObjectId

# Pydantic V2 compatible ObjectId handling
def validate_object_id(v: Any) -> str:
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]

class UserBase(BaseModel):
    name: str
    email: EmailStr
    gender: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None

class UserCreate(UserBase):
    pass

class UserInDB(UserBase):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CalibrationData(BaseModel):
    type: str # 'height' or 'reference'
    value: float
    unit: str = "cm"

class MeasurementData(BaseModel):
    shoulder_width: Optional[str] = None
    chest: Optional[str] = None
    waist: Optional[str] = None
    hips: Optional[str] = None
    arm_length: Optional[str] = None
    leg_length: Optional[str] = None
    inseam: Optional[str] = None
    neck: Optional[str] = None

class MeasurementInDB(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user: PyObjectId
    measurements: MeasurementData
    calibration: CalibrationData
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ClothingItemInDB(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    category: str
    brand: str
    sizes: List[str]
    price: str
    image: str
    fit: str
    material: str
    rating: float = 4.5
    reviews: int = 0
