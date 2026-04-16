import io
import math
import uuid
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import mediapipe as mp
from pydantic import BaseModel
from typing import Optional

# ── MediaPipe Setup ──────────────────────────────────────────────────────────
mp_pose = mp.solutions.pose

class CalibrationData(BaseModel):
    type: str  # 'height' or 'reference'
    value: float
    unit: str  # 'cm' or 'inches'

def px_dist(a, b, img_w, img_h):
    """Euclidean distance between normalized landmarks in pixel space."""
    return math.sqrt(((a.x - b.x) * img_w) ** 2 + ((a.y - b.y) * img_h) ** 2)

def ellipse_circumference(width_cm: float, depth_ratio: float = 0.72) -> float:
    """Ramanujan approximation for ellipse circumference."""
    a = width_cm / 2
    b = a * depth_ratio
    h = ((a - b) ** 2) / ((a + b) ** 2)
    return math.pi * (a + b) * (1 + (3 * h) / (10 + math.sqrt(4 - 3 * h)))

async def process_measurements(
    contents: bytes,
    height_cm: float = 170.0,
    unit: str = "cm",
):
    pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
    img_w, img_h = pil_img.size
    img_np = np.array(pil_img)

    if unit == "inches":
        height_cm = height_cm * 2.54

    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        enable_segmentation=False,
        min_detection_confidence=0.5,
    ) as pose:
        results = pose.process(img_np)

    if not results.pose_landmarks:
        raise ValueError("No person detected in image. Ensure full body is visible.")

    lm = results.pose_landmarks.landmark

    # Compute pixels-per-cm from detected body height vs known height
    nose_y = lm[mp_pose.PoseLandmark.NOSE].y * img_h
    left_ankle_y = lm[mp_pose.PoseLandmark.LEFT_ANKLE].y * img_h
    right_ankle_y = lm[mp_pose.PoseLandmark.RIGHT_ANKLE].y * img_h
    foot_y = max(left_ankle_y, right_ankle_y)
    body_height_px = foot_y - nose_y
    
    # 0.93 = head-to-ankle / full height ratio
    pixels_per_cm = body_height_px / (height_cm * 0.93)

    def to_cm(px): return round(px / pixels_per_cm, 1)

    # 1. Shoulder width
    ls = lm[mp_pose.PoseLandmark.LEFT_SHOULDER]
    rs = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER]
    shoulder_px = px_dist(ls, rs, img_w, img_h)
    shoulder_cm = to_cm(shoulder_px)

    # 2. Hip width
    lh = lm[mp_pose.PoseLandmark.LEFT_HIP]
    rh = lm[mp_pose.PoseLandmark.RIGHT_HIP]
    hip_px = px_dist(lh, rh, img_w, img_h)
    hip_cm = to_cm(hip_px)

    # 3. Arm length (shoulder -> elbow -> wrist)
    le = lm[mp_pose.PoseLandmark.LEFT_ELBOW]
    lw = lm[mp_pose.PoseLandmark.LEFT_WRIST]
    re = lm[mp_pose.PoseLandmark.RIGHT_ELBOW]
    rw = lm[mp_pose.PoseLandmark.RIGHT_WRIST]
    left_arm_px = px_dist(ls, le, img_w, img_h) + px_dist(le, lw, img_w, img_h)
    right_arm_px = px_dist(rs, re, img_w, img_h) + px_dist(re, rw, img_w, img_h)
    arm_cm = to_cm((left_arm_px + right_arm_px) / 2)

    # 4. Leg length (hip -> knee -> ankle)
    lk = lm[mp_pose.PoseLandmark.LEFT_KNEE]
    la = lm[mp_pose.PoseLandmark.LEFT_ANKLE]
    rk = lm[mp_pose.PoseLandmark.RIGHT_KNEE]
    ra = lm[mp_pose.PoseLandmark.RIGHT_ANKLE]
    left_leg_px = px_dist(lh, lk, img_w, img_h) + px_dist(lk, la, img_w, img_h)
    right_leg_px = px_dist(rh, rk, img_w, img_h) + px_dist(rk, ra, img_w, img_h)
    leg_cm = to_cm((left_leg_px + right_leg_px) / 2)

    # 5. Derived measurements
    chest_cm = round(ellipse_circumference(shoulder_cm * 1.15), 1)
    waist_cm = round(ellipse_circumference(shoulder_cm * 0.72), 1)
    hip_circ_cm = round(ellipse_circumference(hip_cm * 1.05), 1)
    inseam_cm = round(leg_cm * 0.88, 1)
    neck_cm = round(ellipse_circumference(shoulder_cm * 0.38, 0.85), 1)

    # Confidence scores
    key_landmarks = [ls, rs, lh, rh, lk, rk, la, ra]
    avg_visibility = sum(l.visibility for l in key_landmarks) / len(key_landmarks)

    return {
        "session_id": str(uuid.uuid4()),
        "measurements": {
            "shoulder_width": {"value": shoulder_cm, "unit": "cm"},
            "chest": {"value": chest_cm, "unit": "cm"},
            "waist": {"value": waist_cm, "unit": "cm"},
            "hips": {"value": hip_circ_cm, "unit": "cm"},
            "arm_length": {"value": arm_cm, "unit": "cm"},
            "leg_length": {"value": leg_cm, "unit": "cm"},
            "inseam": {"value": inseam_cm, "unit": "cm"},
            "neck": {"value": neck_cm, "unit": "cm"},
        },
        "pixels_per_cm": round(pixels_per_cm, 2),
        "overall_confidence": round(avg_visibility * 100, 1),
        "model": "mediapipe-blazepose-heavy",
    }
