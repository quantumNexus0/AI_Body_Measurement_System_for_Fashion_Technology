"""
engine.py — V2 adapter
Wraps the MediaPipe Tasks-based measure_v2.process_measurements so that the
legacy /measure endpoint still works without TensorFlow or PyTorch.
"""
import os
import time
import math
import asyncio
import tempfile
from functools import partial

import cv2
import numpy as np

from models import MeasurementResponse, SingleMeasurement
from measure_v2 import process_measurements


class MeasurementEngine:
    """
    Thin async wrapper around measure_v2.process_measurements.
    Kept for backwards-compat with the /measure V1 route.
    """

    async def process(
        self,
        raw_bytes: bytes,
        calib_type: str,
        calib_value: float,
        gender: str,
    ) -> MeasurementResponse:
        t0 = time.monotonic()
        loop = asyncio.get_event_loop()
        fn = partial(self._process_sync, raw_bytes, calib_type, calib_value, gender)
        result = await loop.run_in_executor(None, fn)
        result.processing_ms = int((time.monotonic() - t0) * 1000)
        return result

    def _process_sync(
        self,
        raw: bytes,
        calib_type: str,
        calib_value: float,
        gender: str,
    ) -> MeasurementResponse:
        # Write upload bytes to tempfile for cv2.imread
        suffix = ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name

        try:
            calibration = {
                "type": calib_type,
                "value": calib_value,
                "unit": "cm",
            }
            raw_result = process_measurements(tmp_path, calibration)
        finally:
            os.unlink(tmp_path)

        # Convert "94.5 cm" string values → SingleMeasurement objects
        def parse(val_str: str, conf: float = 0.80) -> SingleMeasurement:
            try:
                val_cm = float(str(val_str).split()[0])
            except (ValueError, IndexError):
                val_cm = 0.0
            return SingleMeasurement(
                value_mm=round(val_cm * 10, 1),
                value_cm=round(val_cm, 2),
                confidence=conf,
            )

        return MeasurementResponse(
            shoulder_width=parse(raw_result.get("shoulder_width", "0")),
            chest=parse(raw_result.get("chest", "0")),
            waist=parse(raw_result.get("waist", "0")),
            hips=parse(raw_result.get("hips", "0")),
            arm_length=parse(raw_result.get("arm_length", "0")),
            leg_length=parse(raw_result.get("leg_length", "0")),
            inseam=parse(raw_result.get("inseam", "0")),
            neck=parse(raw_result.get("neck", "0")),
            pose_quality=0.85,
        )
