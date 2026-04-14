"""
calibration.py — Scale calibration utilities for AI Body Measurement System
Supports: A4 paper detection, user-height-based fallback, dual-view fusion
"""

import cv2
import numpy as np
from typing import Optional, Tuple, List
import logging

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────
A4_WIDTH_CM  = 21.0
A4_HEIGHT_CM = 29.7
A4_RATIO     = A4_HEIGHT_CM / A4_WIDTH_CM  # 1.4142…

LETTER_WIDTH_CM  = 21.59
LETTER_HEIGHT_CM = 27.94
LETTER_RATIO     = LETTER_HEIGHT_CM / LETTER_WIDTH_CM  # 1.2941…


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _order_rect_points(pts: np.ndarray) -> np.ndarray:
    """
    Order 4 corner points as [top-left, top-right, bottom-right, bottom-left].
    """
    pts = pts.reshape(4, 2)
    rect = np.zeros((4, 2), dtype="float32")

    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left:     smallest sum
    rect[2] = pts[np.argmax(s)]   # bottom-right: largest sum

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right:    smallest diff
    rect[3] = pts[np.argmax(diff)]  # bottom-left:  largest diff

    return rect


def _four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Perspective-correct a quadrilateral to a flat rectangle."""
    rect = _order_rect_points(pts)
    tl, tr, br, bl = rect

    width_a  = np.linalg.norm(br - bl)
    width_b  = np.linalg.norm(tr - tl)
    max_width = int(max(width_a, width_b))

    height_a  = np.linalg.norm(tr - br)
    height_b  = np.linalg.norm(tl - bl)
    max_height = int(max(height_a, height_b))

    dst = np.array([
        [0,          0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0,          max_height - 1],
    ], dtype="float32")

    M    = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (max_width, max_height))
    return warped


def _is_whitish(image: np.ndarray, contour: np.ndarray) -> bool:
    """
    Check if the region inside a contour is predominantly white/light gray
    (typical for A4/Letter paper).
    """
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, -1)
    mean_val = cv2.mean(cv2.cvtColor(image, cv2.COLOR_RGB2GRAY), mask=mask)[0]
    return mean_val > 160  # paper is bright


# ─── A4 Detection ────────────────────────────────────────────────────────────
def detect_reference_paper(
    image: np.ndarray,
    min_area_fraction: float = 0.02,
    debug: bool = False,
) -> Tuple[Optional[float], Optional[np.ndarray]]:
    """
    Detect an A4 or US Letter sheet of paper in the image.

    Parameters
    ----------
    image : np.ndarray
        RGB image (H×W×3 uint8).
    min_area_fraction : float
        Minimum contour area as a fraction of total image area.
    debug : bool
        If True, returns debug visualisation in logs.

    Returns
    -------
    px_per_cm : float | None
        Pixels per centimetre derived from the detected paper sheet,
        or None if no paper was found.
    corners : np.ndarray | None
        The 4 corner points (x,y) of the detected paper, or None.
    """
    h, w    = image.shape[:2]
    min_area = h * w * min_area_fraction

    # Pre-processing
    gray    = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)

    # Multiple edge-detection thresholds for robustness
    candidates: List[Tuple[float, float, np.ndarray]] = []  # (area, px_per_cm, corners)

    for lo, hi in [(30, 100), (50, 150), (80, 200)]:
        edges = cv2.Canny(blurred, lo, hi)
        # Dilate to close small gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges  = cv2.dilate(edges, kernel, iterations=1)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue

            peri   = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

            if len(approx) != 4:
                continue

            # Must be convex
            if not cv2.isContourConvex(approx):
                continue

            # Must be whitish (paper-coloured)
            if not _is_whitish(image, approx):
                continue

            # Check aspect ratio vs A4 or Letter (portrait or landscape)
            rect  = cv2.minAreaRect(approx)
            rw, rh = rect[1]
            if rw == 0 or rh == 0:
                continue
            ratio = max(rw, rh) / min(rw, rh)

            px_per_cm = None
            if abs(ratio - A4_RATIO) < 0.12:
                px_per_cm = min(rw, rh) / A4_WIDTH_CM
            elif abs(ratio - LETTER_RATIO) < 0.12:
                px_per_cm = min(rw, rh) / LETTER_WIDTH_CM

            if px_per_cm and px_per_cm > 0:
                candidates.append((area, px_per_cm, approx))

    if not candidates:
        logger.debug("No reference paper detected.")
        return None, None

    # Pick the largest qualifying candidate
    candidates.sort(key=lambda x: x[0], reverse=True)
    best_area, best_scale, best_corners = candidates[0]

    logger.info(
        f"Paper detected: area={best_area:.0f}px², scale={best_scale:.3f}px/cm"
    )
    return round(best_scale, 4), best_corners.reshape(4, 2)


def draw_paper_detection(
    image: np.ndarray,
    corners: np.ndarray,
    px_per_cm: float,
) -> np.ndarray:
    """
    Draw a green border around the detected paper and label the scale.
    """
    vis = image.copy()
    pts = corners.astype(np.int32).reshape((-1, 1, 2))
    cv2.polylines(vis, [pts], True, (0, 220, 80), 3)

    cx = int(corners[:, 0].mean())
    cy = int(corners[:, 1].mean())
    cv2.putText(
        vis,
        f"A4 ref: {px_per_cm:.2f} px/cm",
        (cx - 80, cy),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (0, 220, 80),
        2,
        cv2.LINE_AA,
    )
    return vis


# ─── Height-based fallback ───────────────────────────────────────────────────
def scale_from_height(
    landmarks,
    image_h: int,
    known_height_cm: float,
) -> Optional[float]:
    """
    Derive px/cm scale from known user height and pose landmarks.

    Uses nose-to-heel vertical distance as a proxy for standing height.
    Typically underestimates by ~4–6 % due to head above nose, so we
    apply a 1.05 correction factor.
    """
    try:
        import mediapipe as mp
        LM = mp.solutions.pose.PoseLandmark
        nose   = landmarks[LM.NOSE]
        l_heel = landmarks[LM.LEFT_HEEL]
        r_heel = landmarks[LM.RIGHT_HEEL]

        top_y  = nose.y
        bot_y  = max(l_heel.y, r_heel.y)
        span_px = abs(bot_y - top_y) * image_h

        if span_px < 20:
            logger.warning("Height span too small — person likely not full-body in frame.")
            return None

        correction = 1.05  # nose is ~5 % below true top of head
        px_per_cm  = (span_px * correction) / known_height_cm
        return round(px_per_cm, 4)

    except Exception as e:
        logger.error(f"Height-based scale error: {e}")
        return None


# ─── Dual-view scale fusion ──────────────────────────────────────────────────
def fuse_scales(
    front_scale: Optional[float],
    side_scale: Optional[float],
    front_weight: float = 0.6,
) -> Optional[float]:
    """
    Weighted average of front and side scale factors.
    Front view is generally more reliable (0.6 vs 0.4 default).
    """
    if front_scale and side_scale:
        fused = front_scale * front_weight + side_scale * (1 - front_weight)
        return round(fused, 4)
    return front_scale or side_scale


# ─── Pose quality check ──────────────────────────────────────────────────────
def check_pose_quality(landmarks, image_h: int, image_w: int) -> Tuple[bool, str]:
    """
    Validate that the detected pose is suitable for measurement.

    Checks:
    1. Full body visible (nose + both heels in frame)
    2. Person is roughly upright (not tilted >15°)
    3. Both shoulders visible and roughly level

    Returns (is_valid, message).
    """
    try:
        import mediapipe as mp
        LM = mp.solutions.pose.PoseLandmark

        required = [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
                    LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_HEEL, LM.RIGHT_HEEL]

        for lm_id in required:
            lm = landmarks[lm_id]
            if lm.visibility < 0.4:
                return False, f"Body part not clearly visible: {lm_id.name}"
            if lm.x < 0.02 or lm.x > 0.98 or lm.y < 0.02 or lm.y > 0.98:
                return False, f"Body part near frame edge: {lm_id.name}. Move further from camera."

        # Check shoulder tilt
        ls  = landmarks[LM.LEFT_SHOULDER]
        rs  = landmarks[LM.RIGHT_SHOULDER]
        dy  = abs(ls.y - rs.y) * image_h
        dx  = abs(ls.x - rs.x) * image_w + 1e-6
        tilt_deg = np.degrees(np.arctan(dy / dx))
        if tilt_deg > 15:
            return False, f"Person appears tilted ({tilt_deg:.1f}°). Please stand upright facing the camera."

        # Height occupies at least 50 % of frame
        nose   = landmarks[LM.NOSE]
        l_heel = landmarks[LM.LEFT_HEEL]
        span   = abs(l_heel.y - nose.y)
        if span < 0.5:
            return False, "Full body not in frame. Step further back from the camera."

        return True, "Pose quality: OK"

    except Exception as e:
        return False, f"Pose check error: {e}"


# ─── Quick self-test ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.DEBUG)

    if len(sys.argv) < 2:
        print("Usage: python calibration.py <image_path>")
        sys.exit(1)

    img = cv2.imread(sys.argv[1])
    if img is None:
        print("Could not read image.")
        sys.exit(1)

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    scale, corners = detect_reference_paper(img_rgb, debug=True)

    if scale:
        print(f"Detected scale: {scale} px/cm")
        vis = draw_paper_detection(img_rgb, corners, scale)
        out = cv2.cvtColor(vis, cv2.COLOR_RGB2BGR)
        cv2.imwrite("calibration_debug.jpg", out)
        print("Saved calibration_debug.jpg")
    else:
        print("No A4 paper detected in image.")
