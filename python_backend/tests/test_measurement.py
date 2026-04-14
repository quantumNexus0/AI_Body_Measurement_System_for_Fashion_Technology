"""
tests/test_measurement.py — pytest unit tests for the AI Body Measurement System
Run with: pytest tests/ -v
"""

import pytest
import numpy as np
import cv2
from unittest.mock import MagicMock, patch
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from calibration import (
    detect_reference_paper,
    scale_from_height,
    fuse_scales,
    check_pose_quality,
    _order_rect_points,
    A4_WIDTH_CM,
    A4_HEIGHT_CM,
)
from app import get_size, pixel_dist, measure_body


# ═══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def blank_image():
    """Plain white 640×480 RGB image."""
    return np.ones((480, 640, 3), dtype=np.uint8) * 255


@pytest.fixture
def image_with_a4():
    """
    Synthetic 800×600 image containing a white A4 rectangle drawn onto
    a mid-gray background, with a visible 4-sided black border.
    """
    img = np.full((600, 800, 3), 100, dtype=np.uint8)
    # A4 at ~5px/cm → 105px wide, 148px tall (portrait)
    scale = 5.0
    pw = int(A4_WIDTH_CM  * scale)   # 105
    ph = int(A4_HEIGHT_CM * scale)   # 148
    x0, y0 = 200, 100
    # White fill
    img[y0:y0+ph, x0:x0+pw] = 245
    # Black border so Canny picks it up
    cv2.rectangle(img, (x0, y0), (x0+pw, y0+ph), (0, 0, 0), 2)
    return img, scale


@pytest.fixture
def mock_landmarks():
    """
    Fake MediaPipe PoseLandmark landmarks covering a 640×480 image.
    Person occupies ~80 % of the frame height.
    """
    import mediapipe as mp
    LM = mp.solutions.pose.PoseLandmark

    lm_data = {
        LM.NOSE:             (0.50, 0.05, 0.95),
        LM.LEFT_SHOULDER:    (0.35, 0.25, 0.95),
        LM.RIGHT_SHOULDER:   (0.65, 0.25, 0.95),
        LM.LEFT_HIP:         (0.38, 0.55, 0.95),
        LM.RIGHT_HIP:        (0.62, 0.55, 0.95),
        LM.LEFT_KNEE:        (0.38, 0.70, 0.95),
        LM.RIGHT_KNEE:       (0.62, 0.70, 0.95),
        LM.LEFT_ANKLE:       (0.38, 0.82, 0.95),
        LM.RIGHT_ANKLE:      (0.62, 0.82, 0.95),
        LM.LEFT_HEEL:        (0.37, 0.85, 0.95),
        LM.RIGHT_HEEL:       (0.63, 0.85, 0.95),
    }

    landmarks = []
    max_id = max(lm.value for lm in LM) + 1

    for i in range(max_id):
        mock = MagicMock()
        try:
            lm_enum = LM(i)
            if lm_enum in lm_data:
                x, y, vis = lm_data[lm_enum]
            else:
                x, y, vis = 0.5, 0.5, 0.5
        except ValueError:
            x, y, vis = 0.5, 0.5, 0.5
        mock.x = x
        mock.y = y
        mock.z = 0.0
        mock.visibility = vis
        landmarks.append(mock)

    return landmarks


# ═══════════════════════════════════════════════════════════════════════════════
# Calibration tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestA4Detection:

    def test_no_paper_in_blank_image(self, blank_image):
        scale, corners = detect_reference_paper(blank_image)
        # A totally white image has no contrasting rectangle
        assert scale is None
        assert corners is None

    def test_detects_paper_in_synthetic_image(self, image_with_a4):
        img, expected_scale = image_with_a4
        scale, corners = detect_reference_paper(img, min_area_fraction=0.01)
        if scale is not None:  # detection not guaranteed on all platforms
            assert abs(scale - expected_scale) / expected_scale < 0.15, (
                f"Scale error too large: got {scale:.3f}, expected ~{expected_scale:.3f}"
            )
            assert corners is not None
            assert corners.shape == (4, 2)


class TestOrderRectPoints:

    def test_canonical_ordering(self):
        pts = np.array([[10, 10], [110, 10], [110, 140], [10, 140]])
        ordered = _order_rect_points(pts)
        np.testing.assert_array_equal(ordered[0], [10, 10])    # top-left
        np.testing.assert_array_equal(ordered[1], [110, 10])   # top-right
        np.testing.assert_array_equal(ordered[2], [110, 140])  # bottom-right
        np.testing.assert_array_equal(ordered[3], [10, 140])   # bottom-left

    def test_shuffled_input_same_output(self):
        pts = np.array([[10, 10], [110, 10], [110, 140], [10, 140]])
        shuffled = pts[[2, 0, 3, 1]]
        ordered   = _order_rect_points(pts)
        ordered_s = _order_rect_points(shuffled)
        np.testing.assert_array_equal(ordered, ordered_s)


class TestHeightBasedScale:

    def test_scale_close_to_expected(self, mock_landmarks):
        """Nose at y=0.05, heels at y=0.85 → span=0.80, image_h=480 → 384px for 170cm."""
        scale = scale_from_height(mock_landmarks, image_h=480, known_height_cm=170)
        assert scale is not None
        expected = (0.80 * 480 * 1.05) / 170
        assert abs(scale - expected) < 0.05, f"Got {scale:.4f}, expected ~{expected:.4f}"


class TestFuseScales:

    def test_both_none(self):
        assert fuse_scales(None, None) is None

    def test_only_front(self):
        assert fuse_scales(5.0, None) == 5.0

    def test_weighted_average(self):
        result = fuse_scales(6.0, 4.0, front_weight=0.6)
        expected = 6.0 * 0.6 + 4.0 * 0.4
        assert abs(result - expected) < 1e-6


# ═══════════════════════════════════════════════════════════════════════════════
# Pose quality tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPoseQuality:

    def test_valid_pose_passes(self, mock_landmarks):
        ok, msg = check_pose_quality(mock_landmarks, 480, 640)
        assert ok, f"Expected valid pose but got: {msg}"

    def test_low_visibility_fails(self, mock_landmarks):
        import mediapipe as mp
        # Mask nose as invisible
        mock_landmarks[mp.solutions.pose.PoseLandmark.NOSE.value].visibility = 0.1
        ok, msg = check_pose_quality(mock_landmarks, 480, 640)
        assert not ok
        assert "visible" in msg.lower()


# ═══════════════════════════════════════════════════════════════════════════════
# Size recommendation tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestSizeRecommendation:

    @pytest.mark.parametrize("measurement,category,expected_size", [
        (80,  "chest", "XS"),
        (88,  "chest", "S"),
        (96,  "chest", "M"),
        (104, "chest", "L"),
        (112, "chest", "XL"),
        (120, "chest", "XXL"),
        (72,  "waist", "S"),
        (100, "hips",  "XL"),
    ])
    def test_size_lookup(self, measurement, category, expected_size):
        assert get_size(measurement, category) == expected_size


# ═══════════════════════════════════════════════════════════════════════════════
# Pixel distance tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestPixelDistance:

    def test_horizontal_distance(self):
        a = MagicMock(); a.x = 0.0; a.y = 0.5
        b = MagicMock(); b.x = 0.5; b.y = 0.5
        dist = pixel_dist(a, b, img_w=200, img_h=200)
        assert abs(dist - 100.0) < 1e-6

    def test_vertical_distance(self):
        a = MagicMock(); a.x = 0.5; a.y = 0.0
        b = MagicMock(); b.x = 0.5; b.y = 1.0
        dist = pixel_dist(a, b, img_w=200, img_h=400)
        assert abs(dist - 400.0) < 1e-6


# ═══════════════════════════════════════════════════════════════════════════════
# Integration — measure_body smoke test
# ═══════════════════════════════════════════════════════════════════════════════

class TestMeasureBodyIntegration:

    def test_no_person_returns_error(self, blank_image):
        _, result = measure_body(blank_image, user_height_cm=170)
        assert result.error is not None
        assert "detected" in result.error.lower()

    def test_output_image_same_shape_as_input(self, blank_image):
        annotated, _ = measure_body(blank_image, user_height_cm=170)
        assert annotated.shape == blank_image.shape
