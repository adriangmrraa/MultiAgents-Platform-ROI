from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import structlog
import time
from db import redis_client

logger = structlog.get_logger()

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sovereign Quota Enforcer.
    Limits requests per tenant to prevent saturation.
    Limit: 600 RPM (Requests Per Minute).
    """
    async def dispatch(self, request: Request, call_next):
        # 1. Identify Tenant (Header or inferred)
        # We rely on X-Tenant-ID header if present (standard in our gateway/frontend)
        # OR fallback to global limit if not present?
        # For Admin routes, we might key by User ID (but that requires decoding token, expensive here)
        # Let's check typical traffic headers. 
        # If no identification, we might skip or use IP.
        
        tenant_id = request.headers.get("X-Tenant-ID")
        
        # If path is public (like webhooks), we definitely need limiting.
        # Use simple keying for now.
        if not tenant_id:
             # Try to peek path?
             # If completely anonymous and no tenant, maybe limiting by IP is safer.
             # But prompt asked for "Rate Limiting por Inquilino".
             # If we can't identify tenant, we pass (or limit globally).
             return await call_next(request)

        key = f"rate_limit:tenant:{tenant_id}"
        limit = 600
        window = 60 # seconds

        try:
            # Atomic Increment
            current = await redis_client.incr(key)
            if current == 1:
                await redis_client.expire(key, window)
            
            if current > limit:
                logger.warning("rate_limit_exceeded", tenant_id=tenant_id, current=current)
                return JSONResponse(
                    status_code=429,
                    content={"error": "Too Many Requests", "detail": "Tenant Quota Exceeded (600 RPM)"}
                )
                
        except Exception as e:
            # Fail open if Redis allows (don't block traffic if rate limiter fails)
            logger.error("rate_limiter_error", error=str(e))
            
        return await call_next(request)
