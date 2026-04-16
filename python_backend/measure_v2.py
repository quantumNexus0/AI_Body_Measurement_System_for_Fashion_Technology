# measure_v2.py — rewritten for mediapipe >= 0.10.14 (Tasks API)
import cv2
import math
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import PoseLandmarker

# Download model once:
# curl -o pose_landmarker_full.task \
#   https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task

MODEL_PATH = "pose_landmarker_full.task"

def get_landmarker():
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        output_segmentation_masks=False
    )
    return vision.PoseLandmarker.create_from_options(options)

def process_measurements(image_path: str, calibration: dict) -> dict:
    """
    Returns 8 body measurements in cm given an image and calibration data.
    calibration = {"type": "height", "value": 170, "unit": "cm"}
    """
    landmarker = get_landmarker()
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise ValueError(f"Cannot read image: {image_path}")
    h, w = img_bgr.shape[:2]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

    result = landmarker.detect(mp_image)
    if not result.pose_landmarks:
        raise RuntimeError("No pose detected — ensure full body is visible")

    lm = result.pose_landmarks[0]

    def pt(idx):
        p = lm[idx]
        return np.array([p.x * w, p.y * h])

    # Keypoint indices (MediaPipe Pose 33-point model)
    # 11=L_shoulder, 12=R_shoulder, 23=L_hip, 24=R_hip
    # 25=L_knee, 26=R_knee, 27=L_ankle, 28=R_ankle
    # 13=L_elbow, 14=R_elbow, 15=L_wrist, 16=R_wrist
    # 7=L_ear, 8=R_ear (proxy for neck width)
    # 0=nose

    L_SHOULDER, R_SHOULDER = pt(11), pt(12)
    L_HIP, R_HIP = pt(23), pt(24)
    L_KNEE, R_KNEE = pt(25), pt(26)
    L_ANKLE, R_ANKLE = pt(27), pt(28)
    L_ELBOW, R_ELBOW = pt(13), pt(14)
    L_WRIST, R_WRIST = pt(15), pt(16)
    NOSE = pt(0)

    def dist(a, b):
        return float(np.linalg.norm(a - b))

    # Pixel measurements
    px_shoulder_w   = dist(L_SHOULDER, R_SHOULDER)
    px_body_height  = dist(NOSE, (L_ANKLE + R_ANKLE) / 2)
    px_hip_w        = dist(L_HIP, R_HIP)
    px_arm_L        = dist(L_SHOULDER, L_ELBOW) + dist(L_ELBOW, L_WRIST)
    px_leg_L        = dist(L_HIP, L_KNEE) + dist(L_KNEE, L_ANKLE)
    px_inseam       = dist((L_HIP + R_HIP) / 2, (L_ANKLE + R_ANKLE) / 2)
    px_neck_w       = px_shoulder_w * 0.28   # heuristic

    # Calibration: pixels-per-cm
    cal_type = calibration.get("type", "height")
    cal_value = float(calibration.get("value", 170))
    cal_unit = calibration.get("unit", "cm")
    if cal_unit == "inches":
        cal_value *= 2.54
    # cal_value is now in cm

    if cal_type == "height":
        px_per_cm = px_body_height / cal_value
    else:
        # reference object: cal_value = known width in cm, use shoulder as reference
        px_per_cm = px_shoulder_w / cal_value

    def to_cm(px):
        return round(px / px_per_cm, 1)

    def circumference(width_px, depth_ratio=0.65):
        # Ellipse perimeter approx: π * (3(a+b) - sqrt((3a+b)(a+3b)))
        a = (width_px / px_per_cm) / 2
        b = a * depth_ratio
        h_val = ((a - b) ** 2) / ((a + b) ** 2)
        return round(math.pi * (3*(a+b) - math.sqrt((3*a+b)*(a+3*b))), 1)

    return {
        "shoulder_width": f"{to_cm(px_shoulder_w)} cm",
        "chest":          f"{circumference(px_shoulder_w * 1.1)} cm",
        "waist":          f"{circumference(px_hip_w * 0.82)} cm",
        "hips":           f"{circumference(px_hip_w)} cm",
        "arm_length":     f"{to_cm(px_arm_L)} cm",
        "leg_length":     f"{to_cm(px_leg_L)} cm",
        "inseam":         f"{to_cm(px_inseam)} cm",
        "neck":           f"{circumference(px_neck_w, depth_ratio=0.75)} cm",
    }