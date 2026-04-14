import cv2
import torch
import numpy as np
import mediapipe as mp
import math
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any, List

mp_pose = mp.solutions.pose

@dataclass
class MeasurementResult:
    shoulder_width_mm: float = 0
    chest_mm: float = 0
    waist_mm: float = 0
    hips_mm: float = 0
    height_mm: float = 0
    confidence: float = 0
    warnings: List[str] = None

class DepthAwareCircumference:
    def __init__(self, depth_model, transform, device):
        self.midas = depth_model
        self.transform = transform
        self.device = device

    def get_relative_depth(self, img: np.ndarray, y_pct: float) -> float:
        # y_pct: 0.0 = top, 1.0 = bottom of image
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        input_batch = self.transform(img_rgb).to(self.device)
        with torch.no_grad():
            depth = self.midas(input_batch).squeeze().cpu().numpy()
        
        # Scaling back to original image size
        depth_rescaled = cv2.resize(depth, (img.shape[1], img.shape[0]))
        row = int(y_pct * img.shape[0])
        strip = depth_rescaled[max(0, row-5):min(img.shape[0], row+5), :]
        return float(np.median(strip))

    def calculate_circumference(self, width_mm: float, depth_relative: float, ref_depth: float, known_width_mm: float) -> float:
        # Scale relative MiDaS depth to real mm based on a known reference (e.g. shoulder width)
        depth_mm = (depth_relative / ref_depth) * known_width_mm
        a, b = width_mm / 2, depth_mm / 2
        h = (a - b)**2 / (a + b)**2
        return np.pi * (a + b) * (1 + (3 * h) / (10 + math.sqrt(4 - 3 * h)))

class DualImageMeasurer:
    def __init__(self):
        self.device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
        print(f"[AI] Initializing MiDaS on {self.device}...")
        
        self.depth_model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
        self.depth_model.to(self.device).eval()
        
        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        self.transform = midas_transforms.small_transform
        
        self.depth_scaler = DepthAwareCircumference(self.depth_model, self.transform, self.device)

        self.pose = mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            min_detection_confidence=0.5
        )

    def _get_landmarks_and_scale(self, img: np.ndarray, height_cm: float) -> Tuple[Any, float]:
        h, w = img.shape[:2]
        res = self.pose.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        if not res.pose_landmarks:
            return None, 0
        lms = res.pose_landmarks.landmark
        LM = mp_pose.PoseLandmark
        
        height_px = abs(max(lms[LM.LEFT_HEEL].y, lms[LM.RIGHT_HEEL].y) - lms[LM.NOSE].y) * h * 1.05
        scale = height_px / (height_cm * 10)
        return lms, scale

    def measure(self, front_img: np.ndarray, side_img: Optional[np.ndarray], height_cm: float) -> MeasurementResult:
        lms_f, scale = self._get_landmarks_and_scale(front_img, height_cm)
        if not lms_f:
            return MeasurementResult(warnings=["No person detected"])

        h, w = front_img.shape[:2]
        LM = mp_pose.PoseLandmark
        
        shoulder_width_mm = math.sqrt((lms_f[LM.LEFT_SHOULDER].x*w - lms_f[LM.RIGHT_SHOULDER].x*w)**2 + (lms_f[LM.LEFT_SHOULDER].y*h - lms_f[LM.RIGHT_SHOULDER].y*h)**2) / scale
        hip_width_mm = math.sqrt((lms_f[LM.LEFT_HIP].x*w - lms_f[LM.RIGHT_HIP].x*w)**2 + (lms_f[LM.LEFT_HIP].y*h - lms_f[LM.RIGHT_HIP].y*h)**2) / scale

        # Use shoulder center depth as reference
        shoulder_y_pct = (lms_f[LM.LEFT_SHOULDER].y + lms_f[LM.RIGHT_SHOULDER].y) / 2
        ref_depth = self.depth_scaler.get_relative_depth(front_img, shoulder_y_pct)
        
        chest_depth_rel = self.depth_scaler.get_relative_depth(front_img, shoulder_y_pct + 0.05)
        waist_depth_rel = self.depth_scaler.get_relative_depth(front_img, (shoulder_y_pct + lms_f[LM.LEFT_HIP].y)/2)
        hip_depth_rel = self.depth_scaler.get_relative_depth(front_img, lms_f[LM.LEFT_HIP].y)

        return MeasurementResult(
            shoulder_width_mm=round(shoulder_width_mm, 1),
            chest_mm=round(self.depth_scaler.calculate_circumference(shoulder_width_mm*0.85, chest_depth_rel, ref_depth, shoulder_width_mm), 1),
            waist_mm=round(self.depth_scaler.calculate_circumference(shoulder_width_mm*0.82, waist_depth_rel, ref_depth, shoulder_width_mm), 1),
            hips_mm=round(self.depth_scaler.calculate_circumference(hip_width_mm*1.1, hip_depth_rel, ref_depth, shoulder_width_mm), 1),
            height_mm=height_cm * 10,
            confidence=float(np.mean([lms_f[i].visibility for i in range(33)])),
            warnings=[]
        )

_measurer = None
def get_measurer():
    global _measurer
    if _measurer is None:
        _measurer = DualImageMeasurer()
    return _measurer

def measure_body_from_image(image: np.ndarray, calibration: Dict[str, Any]) -> Any:
    height_cm = calibration.get("value", 170)
    res = get_measurer().measure(image, None, height_cm)
    return {
        "height_cm": res.height_mm / 10,
        "shoulder_width_cm": res.shoulder_width_mm / 10,
        "chest_width_cm": res.chest_mm / 10,
        "waist_width_cm": res.waist_mm / 10,
        "hip_width_cm": res.hips_mm / 10,
        "confidence": res.confidence,
        "warnings": res.warnings
    }
