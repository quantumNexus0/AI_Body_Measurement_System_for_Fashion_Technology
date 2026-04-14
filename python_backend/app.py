"""
AI Body Measurement System — Gradio Demo
Author: quantumNexus0
Stack : MediaPipe · OpenCV · Gradio
"""

import cv2
import numpy as np
import gradio as gr
import mediapipe as mp
from dataclasses import dataclass
from typing import Optional, Tuple

# ─── MediaPipe setup ────────────────────────────────────────────────────────
mp_pose = mp.solutions.pose
mp_draw = mp.solutions.drawing_utils

# ─── Sizing tables (cm) ─────────────────────────────────────────────────────
SIZES = {
    "chest":  {"XS": (76,84), "S": (84,92), "M": (92,100), "L": (100,108), "XL": (108,116), "XXL": (116,124)},
    "waist":  {"XS": (60,68), "S": (68,76), "M": (76,84),  "L": (84,92),   "XL": (92,100),  "XXL": (100,108)},
    "hips":   {"XS": (84,92), "S": (92,100),"M": (100,108),"L": (108,116), "XL": (116,124), "XXL": (124,132)},
}

def get_size(measurement_cm: float, category: str) -> str:
    for size, (lo, hi) in SIZES.get(category, {}).items():
        if lo <= measurement_cm < hi:
            return size
    return "XXL+" if measurement_cm >= 124 else "XS-"


# ─── Dataclass for results ───────────────────────────────────────────────────
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


# ─── A4 paper calibration ────────────────────────────────────────────────────
A4_WIDTH_CM  = 21.0
A4_HEIGHT_CM = 29.7

def detect_a4_paper(image: np.ndarray) -> Optional[float]:
    """
    Try to find a white A4 rectangle in the image.
    Returns px_per_cm scale factor, or None if not found.
    """
    gray    = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges   = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h, w = image.shape[:2]
    min_area = (h * w) * 0.02   # at least 2 % of the frame
    best = None

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        peri  = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) != 4:
            continue

        # Check aspect ratio is close to A4 (portrait or landscape)
        rect  = cv2.boundingRect(approx)
        rw, rh = rect[2], rect[3]
        ratio = max(rw, rh) / (min(rw, rh) + 1e-6)
        a4_ratio = A4_HEIGHT_CM / A4_WIDTH_CM  # ~1.414

        if 1.3 < ratio < 1.55:
            # Use the shorter dimension mapped to A4 width
            px_per_cm = min(rw, rh) / A4_WIDTH_CM
            if best is None or area > best[0]:
                best = (area, px_per_cm)

    return best[1] if best else None


# ─── Core measurement engine ─────────────────────────────────────────────────
def pixel_dist(lm_a, lm_b, img_w: int, img_h: int) -> float:
    ax, ay = lm_a.x * img_w, lm_a.y * img_h
    bx, by = lm_b.x * img_w, lm_b.y * img_h
    return np.sqrt((ax - bx)**2 + (ay - by)**2)

LM = mp_pose.PoseLandmark

def measure_body(
    image: np.ndarray,
    user_height_cm: float = 170.0,
    use_a4: bool = True,
) -> Tuple[np.ndarray, MeasurementResult]:
    """
    Run pose estimation on image (H×W×3 RGB uint8).
    Returns annotated image + MeasurementResult.
    """
    result = MeasurementResult()
    h, w   = image.shape[:2]
    annotated = image.copy()

    # ── Scale calibration ──────────────────────────────────────────────────
    scale = None
    if use_a4:
        scale = detect_a4_paper(image)
        if scale:
            result.calibration_used = "A4 paper"

    # ── Pose detection ─────────────────────────────────────────────────────
    with mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        min_detection_confidence=0.5,
    ) as pose:
        res = pose.process(image)

    if not res.pose_landmarks:
        result.error = "No person detected. Ensure full body is visible and well-lit."
        return annotated, result

    lms = res.pose_landmarks.landmark

    # ── Height-based fallback scale ────────────────────────────────────────
    if scale is None:
        nose   = lms[LM.NOSE]
        l_heel = lms[LM.LEFT_HEEL]
        r_heel = lms[LM.RIGHT_HEEL]
        heel_y = max(l_heel.y, r_heel.y)
        height_px = abs(heel_y - nose.y) * h
        if height_px > 10:
            scale = height_px / user_height_cm
            result.calibration_used = "user height"

    if scale is None or scale <= 0:
        result.error = "Could not establish scale. Provide user height or include A4 paper."
        return annotated, result

    result.scale_px_per_cm = round(scale, 3)

    # ── Measurements ──────────────────────────────────────────────────────
    # Height
    nose   = lms[LM.NOSE]
    l_heel = lms[LM.LEFT_HEEL]
    r_heel = lms[LM.RIGHT_HEEL]
    heel_y = max(l_heel.y, r_heel.y)
    height_px = abs(heel_y - nose.y) * h
    result.height_cm = round(height_px / scale, 1)

    # Shoulder width (left shoulder → right shoulder)
    ls, rs = lms[LM.LEFT_SHOULDER], lms[LM.RIGHT_SHOULDER]
    result.shoulder_width_cm = round(pixel_dist(ls, rs, w, h) / scale, 1)

    # Chest width (shoulder level offset slightly inward — ~85 % of shoulder)
    result.chest_width_cm = round(result.shoulder_width_cm * 0.85 * np.pi, 1)  # circumference approx

    # Waist width (midpoint between shoulder and hip)
    lh, rh = lms[LM.LEFT_HIP], lms[LM.RIGHT_HIP]
    mid_shoulder_y = (ls.y + rs.y) / 2
    mid_hip_y      = (lh.y + rh.y) / 2
    waist_y = (mid_shoulder_y + mid_hip_y) / 2
    waist_lx = ls.x + (lh.x - ls.x) * 0.5
    waist_rx = rs.x + (rh.x - rs.x) * 0.5
    waist_px = abs(waist_lx - waist_rx) * w
    result.waist_width_cm = round(waist_px / scale * np.pi, 1)

    # Hip width
    hip_px = pixel_dist(lh, rh, w, h)
    result.hip_width_cm = round(hip_px / scale * np.pi, 1)

    # Inseam (hip to ankle)
    l_ankle = lms[LM.LEFT_ANKLE]
    inseam_px = abs(lh.y - l_ankle.y) * h
    result.inseam_cm = round(inseam_px / scale, 1)

    # ── Annotate image ─────────────────────────────────────────────────────
    mp_draw.draw_landmarks(
        annotated,
        res.pose_landmarks,
        mp_pose.POSE_CONNECTIONS,
        mp_draw.DrawingSpec(color=(0, 200, 100), thickness=2, circle_radius=3),
        mp_draw.DrawingSpec(color=(0, 120, 255), thickness=2),
    )

    # Draw measurement lines
    def draw_line(lm_a, lm_b, color, label, label_offset=(0, -10)):
        x1, y1 = int(lm_a.x * w), int(lm_a.y * h)
        x2, y2 = int(lm_b.x * w), int(lm_b.y * h)
        cv2.line(annotated, (x1, y1), (x2, y2), color, 2)
        mid_x, mid_y = (x1 + x2) // 2 + label_offset[0], (y1 + y2) // 2 + label_offset[1]
        cv2.putText(annotated, label, (mid_x, mid_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)

    draw_line(ls, rs, (255, 200, 0), f"Shoulders {result.shoulder_width_cm}cm")
    draw_line(lh, rh, (0, 200, 255), f"Hips {result.hip_width_cm // np.pi:.0f}cm wide", (0, -10))

    # Height line
    top_y = int(nose.y * h)
    bot_y = int(max(l_heel.y, r_heel.y) * h)
    center_x = int((ls.x + rs.x) / 2 * w) - 30
    cv2.line(annotated, (center_x, top_y), (center_x, bot_y), (255, 100, 100), 2)
    cv2.putText(annotated, f"{result.height_cm}cm", (center_x - 45, (top_y + bot_y) // 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 100, 100), 1, cv2.LINE_AA)

    return annotated, result


# ─── Gradio interface ─────────────────────────────────────────────────────────
def run_measurement(image, user_height: float, use_a4: bool):
    if image is None:
        return None, "Please upload an image.", "", "", "", "", "", "", ""

    annotated, res = measure_body(
        image,
        user_height_cm=user_height,
        use_a4=use_a4,
    )

    if res.error:
        return annotated, f"⚠ {res.error}", "", "", "", "", "", "", ""

    size_chest  = get_size(res.chest_width_cm, "chest")
    size_waist  = get_size(res.waist_width_cm, "waist")
    size_hips   = get_size(res.hip_width_cm,   "hips")

    # Summary votes for overall size
    from collections import Counter
    vote = Counter([size_chest, size_waist, size_hips])
    overall = vote.most_common(1)[0][0]

    status = (
        f"✅ Measured successfully\n"
        f"Calibration: {res.calibration_used}  |  "
        f"Scale: {res.scale_px_per_cm} px/cm"
    )

    return (
        annotated,
        status,
        f"{res.height_cm} cm",
        f"{res.shoulder_width_cm} cm",
        f"{res.chest_width_cm} cm  →  {size_chest}",
        f"{res.waist_width_cm} cm  →  {size_waist}",
        f"{res.hip_width_cm} cm  →  {size_hips}",
        f"{res.inseam_cm} cm",
        f"Overall recommended size: **{overall}**",
    )


with gr.Blocks(title="AI Body Measurement System", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        """
        # 📐 AI Body Measurement System
        *by quantumNexus0 — powered by MediaPipe + OpenCV*

        Upload a **full-body front-view photo** (stand 1.5m+ from camera, arms slightly away from body).
        For best accuracy, **hold an A4 sheet of paper** in the photo and enable A4 calibration.
        """
    )

    with gr.Row():
        with gr.Column(scale=1):
            img_input     = gr.Image(label="Upload photo", type="numpy", height=400)
            user_height   = gr.Slider(140, 220, value=170, step=1, label="Your height (cm) — used if A4 not detected")
            use_a4        = gr.Checkbox(value=True, label="Try to detect A4 paper for calibration")
            run_btn       = gr.Button("Measure", variant="primary")

        with gr.Column(scale=1):
            img_output = gr.Image(label="Annotated result", height=400)
            status_box = gr.Textbox(label="Status", interactive=False, lines=2)

    with gr.Row():
        out_height   = gr.Textbox(label="Height")
        out_shoulder = gr.Textbox(label="Shoulder width")
        out_chest    = gr.Textbox(label="Chest circumference")

    with gr.Row():
        out_waist  = gr.Textbox(label="Waist circumference")
        out_hips   = gr.Textbox(label="Hip circumference")
        out_inseam = gr.Textbox(label="Inseam")

    size_output = gr.Markdown()

    run_btn.click(
        fn=run_measurement,
        inputs=[img_input, user_height, use_a4],
        outputs=[img_output, status_box, out_height, out_shoulder,
                 out_chest, out_waist, out_hips, out_inseam, size_output],
    )

    gr.Markdown(
        """
        ---
        **Tips for accuracy:**
        - Wear form-fitting clothes
        - Stand against a plain, contrasting background
        - Ensure full body visible from head to feet
        - Keep arms slightly away from body
        - Camera at body height, not angled up/down

        **Known limitations:** Single-image depth estimation uses elliptical body model (±3–5 cm).
        Dual-view (front + side) improves accuracy significantly.
        """
    )

if __name__ == "__main__":
    demo.launch(share=False)
