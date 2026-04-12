import time
from typing import Any, Optional
from fastapi.responses import JSONResponse

# Model Version constant
MODEL_VERSION = "1.0.0"

def make_response(
    data: Any,
    error: Optional[str] = None,
    confidence: Optional[float] = None,
    processing_start: Optional[float] = None,
    status_code: int = 200,
) -> JSONResponse:
    """
    Build a standard JSON envelope for every API response.
    """
    processing_time_ms = (
        int((time.time() - processing_start) * 1000)
        if processing_start is not None
        else None
    )

    envelope = {
        "success": error is None,
        "data": data,
        "error": error,
        "meta": {
            "processing_time_ms": processing_time_ms,
            "model_version": MODEL_VERSION,
            "confidence": round(confidence, 4) if confidence is not None else None,
        },
    }

    return JSONResponse(content=envelope, status_code=status_code)

def make_error_response(
    message: str,
    status_code: int = 400,
    processing_start: Optional[float] = None,
) -> JSONResponse:
    """Shorthand for returning an error envelope."""
    return make_response(
        data=None,
        error=message,
        processing_start=processing_start,
        status_code=status_code,
    )
