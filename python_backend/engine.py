import time
import asyncio
from functools import partial
import numpy as np
import cv2
import torch
import tensorflow as tf
import tensorflow_hub as hub
import math

from models import MeasurementResponse, SingleMeasurement

MOVENET_URL = "https://tfhub.dev/google/movenet/singlepose/thunder/4"

# MoveNet keypoint indices
KP = {
    "nose":0,"left_eye":1,"right_eye":2,"left_ear":3,"right_ear":4,
    "left_shoulder":5,"right_shoulder":6,"left_elbow":7,"right_elbow":8,
    "left_wrist":9,"right_wrist":10,"left_hip":11,"right_hip":12,
    "left_knee":13,"right_knee":14,"left_ankle":15,"right_ankle":16,
}

def _ramanujan(a: float, b: float) -> float:
    """Ellipse perimeter — Ramanujan's second approximation (mm in, mm out)."""
    if a <= 0 or b <= 0:
        return 0.0
    h = (a - b) ** 2 / (a + b) ** 2
    return np.pi * (a + b) * (1 + (3 * h) / (10 + np.sqrt(4 - 3 * h)))

class MeasurementEngine:
    def __init__(self):
        self._movenet = None
        self._midas   = None
        self._midas_transform = None

    async def load_models(self):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_sync)

    def _load_sync(self):
        # Load MoveNet from TF Hub
        self._movenet = hub.load(MOVENET_URL).signatures["serving_default"]
        
        # Load MiDaS from Torch Hub
        self._midas = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", pretrained=True).eval()
        transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        self._midas_transform = transforms.small_transform

    async def process(self, raw_bytes: bytes,
                      calib_type: str, calib_value: float,
                      gender: str) -> MeasurementResponse:
        t0 = time.monotonic()
        loop = asyncio.get_event_loop()
        fn   = partial(self._process_sync, raw_bytes, calib_type, calib_value, gender)
        result = await loop.run_in_executor(None, fn)
        result.processing_ms = int((time.monotonic() - t0) * 1000)
        return result

    def _process_sync(self, raw: bytes, calib_type: str,
                      calib_value: float, gender: str) -> MeasurementResponse:
        img_bgr = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValueError("Could not decode image")

        img_rgb  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        h_px, w_px = img_rgb.shape[:2]

        # 1. MoveNet keypoints
        kps, pose_quality = self._run_movenet(img_rgb)

        if pose_quality < 0.4:
            raise ValueError(f"Pose quality too low ({pose_quality:.2f}). Ensure full-body, front-facing, good lighting.")

        # 2. Scale factor: pixels → mm
        px_per_mm = self._compute_scale(kps, calib_type, calib_value, h_px)

        # 3. MiDaS depth map
        depth_map = self._run_midas(img_rgb)

        # 4. Extract measurements
        return self._extract_results(img_rgb, kps, depth_map, px_per_mm, gender)

    def _run_movenet(self, img_rgb: np.ndarray):
        resized  = tf.image.resize_with_pad(tf.expand_dims(img_rgb, 0), 256, 256)
        inp      = tf.cast(resized, tf.int32)
        outputs  = self._movenet(input=inp)
        raw_kps  = outputs["output_0"].numpy()[0, 0]
        h, w     = img_rgb.shape[:2]
        kps = {name: {"y": float(raw_kps[idx, 0]) * h,
                     "x": float(raw_kps[idx, 1]) * w,
                     "score": float(raw_kps[idx, 2])}
               for name, idx in KP.items()}
        quality  = float(np.mean([kps[k]["score"] for k in ("left_shoulder","right_shoulder","left_hip","right_hip","left_ankle","right_ankle")]))
        return kps, quality

    def _run_midas(self, img_rgb: np.ndarray) -> np.ndarray:
        inp = self._midas_transform(img_rgb).unsqueeze(0)
        with torch.no_grad():
            depth = self._midas(inp).squeeze().numpy()
        depth = cv2.resize(depth, (img_rgb.shape[1], img_rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
        return depth.astype(np.float32)

    def _compute_scale(self, kps, calib_type: str, calib_value: float, h_px: int) -> float:
        if calib_type == "height":
            ls, rs = kps["left_shoulder"], kps["right_shoulder"]
            la, ra = kps["left_ankle"], kps["right_ankle"]
            top_y  = min(ls["y"], rs["y"]) - 20 # head correction
            bot_y  = max(la["y"], ra["y"])
            px_height = max(bot_y - top_y, 1)
            return (calib_value * 10) / px_height
        return 0.1 # default fallback

    def _slice_depth(self, depth_map: np.ndarray, y_px: float, x_left: float, x_right: float) -> float:
        row = int(np.clip(y_px, 0, depth_map.shape[0] - 1))
        xl = int(max(x_left, 0))
        xr = int(min(x_right, depth_map.shape[1] - 1))
        strip = depth_map[max(row-4, 0):row+4, xl:xr]
        return float(np.median(strip)) if strip.size > 0 else 1.0

    def _circumference(self, width_mm: float, depth_relative: float, ref_depth: float, ref_width_mm: float, gender: str) -> float:
        if ref_depth > 0:
            depth_mm = (depth_relative / ref_depth) * ref_width_mm
            depth_mm = np.clip(depth_mm, 0.4 * width_mm, 0.9 * width_mm)
        else:
            ratio = {"m": 0.55, "f": 0.62, "n": 0.58}.get(gender, 0.58)
            depth_mm = width_mm * ratio
        return _ramanujan(width_mm / 2, depth_mm / 2)

    def _extract_results(self, img_rgb, kps, depth_map, px_per_mm: float, gender: str) -> MeasurementResponse:
        def px_dist(a_name: str, b_name: str) -> tuple[float, float]:
            a, b = kps[a_name], kps[b_name]
            return np.hypot(a["x"] - b["x"], a["y"] - b["y"]), min(a["score"], b["score"])

        def m(value_mm: float, conf: float, warn: str = None) -> SingleMeasurement:
            return SingleMeasurement(value_mm=round(value_mm, 1), value_cm=round(value_mm / 10, 2), confidence=round(conf, 3), warning=warn)

        sw_px, sw_conf = px_dist("left_shoulder", "right_shoulder")
        shoulder_mm = sw_px * px_per_mm
        ls, rs = kps["left_shoulder"], kps["right_shoulder"]
        mid_y = (ls["y"] + rs["y"]) / 2
        ref_depth = self._slice_depth(depth_map, mid_y, ls["x"], rs["x"])

        chest_w_mm = shoulder_mm * 0.82
        chest_d_rel = self._slice_depth(depth_map, mid_y + 30, ls["x"], rs["x"])
        chest_mm = self._circumference(chest_w_mm, chest_d_rel, ref_depth, shoulder_mm, gender)

        lh, rh = kps["left_hip"], kps["right_hip"]
        hip_y = (lh["y"] + rh["y"]) / 2
        waist_y = mid_y + (hip_y - mid_y) * 0.55
        waist_px = abs(lh["x"] - rh["x"]) * 0.88
        waist_mm = self._circumference(waist_px * px_per_mm, self._slice_depth(depth_map, waist_y, lh["x"], rh["x"]), ref_depth, shoulder_mm, gender)

        hip_px = abs(lh["x"] - rh["x"])
        hip_mm = self._circumference(hip_px * px_per_mm * 1.05, self._slice_depth(depth_map, hip_y, lh["x"], rh["x"]), ref_depth, shoulder_mm, gender)

        al_px, al_conf = px_dist("left_shoulder", "left_wrist")
        ar_px, ar_conf = px_dist("right_shoulder", "right_wrist")
        arm_mm = max(al_px, ar_px) * px_per_mm

        ll_px, ll_conf = px_dist("left_hip", "left_ankle")
        rl_px, rl_conf = px_dist("right_hip", "right_ankle")
        leg_mm = max(ll_px, rl_px) * px_per_mm

        neck_px, neck_conf = px_dist("left_ear", "right_ear")
        neck_mm = _ramanujan(neck_px * px_per_mm * 1.1 / 2, neck_px * px_per_mm * 0.6 / 2)

        return MeasurementResponse(
            shoulder_width=m(shoulder_mm, sw_conf),
            chest=m(chest_mm, sw_conf),
            waist=m(waist_mm, min(lh["score"], rh["score"])),
            hips=m(hip_mm, min(lh["score"], rh["score"])),
            arm_length=m(arm_mm, max(al_conf, ar_conf)),
            leg_length=m(leg_mm, max(ll_conf, rl_conf)),
            inseam=m(leg_mm - 50, max(ll_conf, rl_conf)),
            neck=m(neck_mm, neck_conf),
            pose_quality=round(float(np.mean([kps[k]["score"] for k in KP])), 3)
        )
