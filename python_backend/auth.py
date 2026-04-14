import os
import hmac
from fastapi import Header, HTTPException

# Shared secret between Node.js gateway and Python engine
INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "bodyfit_internal_fallback_secret_32")

async def verify_internal_token(x_internal_token: str = Header(...)):
    """
    Constant-time comparison of the internal service token.
    Ensures that only the Node.js gateway can call the measurement engine.
    """
    if not hmac.compare_digest(x_internal_token, INTERNAL_SECRET):
        raise HTTPException(403, "Forbidden: Invalid internal token")
