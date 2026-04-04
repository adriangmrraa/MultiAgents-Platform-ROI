"""
API Security Middleware
Hardening: request size limits, timeouts, and protection against abuse.
"""

import time
import uuid
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import structlog
import asyncio

logger = structlog.get_logger()

MAX_REQUEST_SIZE = 1_000_000  # 1MB
DEFAULT_TIMEOUT = 30  # seconds


class APISecurityMiddleware(BaseHTTPMiddleware):
    """
    Enforces request size limits and timeouts.
    """

    async def dispatch(self, request: Request, call_next):
        # Check content length
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > MAX_REQUEST_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Payload too large. Maximum size is {MAX_REQUEST_SIZE // 1_000_000}MB.",
                    )
            except ValueError:
                # If content-length is invalid, we can still proceed but log
                logger.warning("invalid_content_length", value=content_length)

        # Also check actual body size for requests without Content-Length
        if request.method in ("POST", "PUT", "PATCH") and not content_length:
            body = await request.body()
            if len(body) > MAX_REQUEST_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body too large. Maximum size is {MAX_REQUEST_SIZE} bytes."}
                )

        # Add timeout handling
        try:
            response = await asyncio.wait_for(
                call_next(request), timeout=DEFAULT_TIMEOUT
            )
            return response
        except asyncio.TimeoutError:
            logger.warning(
                "request_timeout", path=request.url.path, method=request.method
            )
            raise HTTPException(
                status_code=504, detail="Gateway Timeout - request took too long"
            )
        except HTTPException:
            # Re-raise HTTP exceptions (like size limit)
            raise
        except Exception as e:
            # Other exceptions should be handled by global exception handler
            raise


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Adds a unique request ID for tracing.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
