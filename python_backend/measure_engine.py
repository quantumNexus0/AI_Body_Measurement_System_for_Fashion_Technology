import cv2
import numpy as np
import mediapipe as mp
import math
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any

mp_pose = mp.solutions.pose

@dataclass
class MeasurementResult:
    height_cm:         Optional[float] = None
    shoulder_width_cm: Optional[float] = None
    chest_width_cm:    Optional[float] = None
    waist_width_cm:    Optional[float] = None
    hip_width_cm:      Optional[float] = None
    inseam_cm:         Optional[float] = None
    scale_px_per_cm:   Optional[float] = None
    calibration_used:  str = "user height"
    error:             Optional[str] = None


def pixel_dist(lm_a, lm_b, img_w: int, img_h: int) -> float:
    ax, ay = lm_a.x * img_w, lm_a.y * img_h
    bx, by = lm_b.x * img_w, lm_b.y * img_h
    return math.sqrt((ax - bx)**2 + (ay - by)**2)

def ellipse_perimeter_ramanujan(a: float, b: float) -> float:
    """
    Ramanujan's approximation for the perimeter of an ellipse.
    a: semi-major axis
    b: semi-minor axis
    """
    return math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b)))


def measure_body_from_image(
    image: np.ndarray,
    calibration: Dict[str, Any]
) -> MeasurementResult:
    """
    Run pose estimation on an RGB image (H×W×3 uint8).
    Extracts physically accurate measurements using Ramanujan's elliptical model.
    """
    result = MeasurementResult()
    h, w = image.shape[:2]

    # Handle calibration
    user_height_cm = 170.0
    if calibration.get("type") == "height":
        val = calibration.get("value")
        if val:
            # If unit is inches, convert to cm
            unit = calibration.get("unit", "cm")
            user_height_cm = float(val) if unit == "cm" else float(val) * 2.54

    # Run MediaPipe Pose
    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        min_detection_confidence=0.5,
    ) as pose:
        res = pose.process(image)

    if not res.pose_landmarks:
        result.error = "No person detected in the image."
        return result

    lms = res.pose_landmarks.landmark
    LM = mp_pose.PoseLandmark

    # Derive scale from known user height (nose to heel proxy)
    nose = lms[LM.NOSE]
    l_heel = lms[LM.LEFT_HEEL]
    r_heel = lms[LM.RIGHT_HEEL]
    
    bot_y = max(l_heel.y, r_heel.y)
    height_px = abs(bot_y - nose.y) * h

    if height_px < 20:
        result.error = "Person is too small in the frame or fully occluded."
        return result

    # Add 5% correction to account for top of head above nose
    correction = 1.05
    scale = (height_px * correction) / user_height_cm
    result.scale_px_per_cm = round(scale, 3)

    # Calculate actual metric lengths
    result.height_cm = round(height_px * correction / scale, 1)

    # Shoulder Width
    ls, rs = lms[LM.LEFT_SHOULDER], lms[LM.RIGHT_SHOULDER]
    shoulder_px = pixel_dist(ls, rs, w, h)
    result.shoulder_width_cm = round(shoulder_px / scale, 1)

    # Chest Circumference using Elliptical Model
    # Assumes chest ratio depth is ~75% of front width (anatomical average)
    chest_width = result.shoulder_width_cm * 0.85 # slightly narrower than shoulders
    chest_depth = chest_width * 0.75
    a = chest_width / 2.0
    b = chest_depth / 2.0
    result.chest_width_cm = round(ellipse_perimeter_ramanujan(a, b), 1)

    # Waist Circumference
    lh, rh = lms[LM.LEFT_HIP], lms[LM.RIGHT_HIP]
    waist_lx = ls.x + (lh.x - ls.x) * 0.5
    waist_rx = rs.x + (rh.x - rs.x) * 0.5
    waist_width_px = abs(waist_lx - waist_rx) * w
    waist_width = waist_width_px / scale
    
    # Anatomical waist ratio depth ~68% of width
    waist_depth = waist_width * 0.68
    a_waist = waist_width / 2.0
    b_waist = waist_depth / 2.0
    result.waist_width_cm = round(ellipse_perimeter_ramanujan(a_waist, b_waist), 1)

    # Hip Circumference
    # Adjust for anatomical hip being wider than the joint landmarks 
    hip_px = pixel_dist(lh, rh, w, h)
    hip_width = (hip_px / scale) * 1.15 # expand by 15% due to joint location
    
    # Hip depth ratio ~ 80% (glutes)
    hip_depth = hip_width * 0.80
    a_hip = hip_width / 2.0
    b_hip = hip_depth / 2.0
    result.hip_width_cm = round(ellipse_perimeter_ramanujan(a_hip, b_hip), 1)

    # Inseam
    l_ankle = lms[LM.LEFT_ANKLE]
    inseam_px = abs(lh.y - l_ankle.y) * h
    result.inseam_cm = round(inseam_px / scale, 1)

    return result
