"""
Enhanced Rate Limiting with slowapi and Redis sliding‑window strategy.
Implements per‑tenant, per‑endpoint‑tier rate limiting following OWASP guidelines.
"""

import os
import re
from typing import Optional, Callable
from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

logger = None  # will be set after structlog import

# ------------------------------
# Configuration
# ------------------------------
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")


# ------------------------------
# Endpoint classification
# ------------------------------
def _get_endpoint_tier(path: str) -> str:
    """
    Classify the request path into a rate‑limit tier.
    Returns: 'auth', 'admin', 'api', 'webhook', or 'general'
    """
    # Auth endpoints (login, register, password reset, etc.)
    if path.startswith("/auth/"):
        return "auth"

    # Admin/platform endpoints (super‑user only)
    if path.startswith("/platform/") or path.startswith("/admin/"):
        return "admin"

    # Webhook endpoints (external callbacks – unlimited)
    if path.startswith("/webhook/") or path.startswith("/billing/webhook/"):
        return "webhook"

    # Billing endpoints (treated as general API)
    if path.startswith("/billing/"):
        return "api"

    # Everything else is considered general API
    return "api"


# ------------------------------
# Key function: tenant‑aware
# ------------------------------
def get_rate_limit_key(request: Request) -> str:
    """
    Build a rate‑limit key that includes tenant (if present) and IP.
    Format: 'rate_limit:{tenant_id}:{remote_ip}:{tier}'
    """
    tenant_id = request.headers.get("X-Tenant-ID")
    remote_ip = get_remote_address(request)
    tier = _get_endpoint_tier(request.url.path)

    if tenant_id:
        key = f"rate_limit:tenant:{tenant_id}:ip:{remote_ip}:tier:{tier}"
    else:
        key = f"rate_limit:ip:{remote_ip}:tier:{tier}"

    return key


# ------------------------------
# Dynamic limit string
# ------------------------------
def get_rate_limit_value(request: Request) -> str:
    """
    Return the limit string (e.g., '10/minute') based on endpoint tier.
    """
    tier = _get_endpoint_tier(request.url.path)

    # Map tier to limit (matches spec requirements)
    limits = {
        "auth": "10/minute",
        "admin": "120/minute",
        "api": "60/minute",
        "webhook": None,  # unlimited – skip rate limiting
        "general": "60/minute",
    }

    limit_str = limits.get(tier, limits["general"])
    return limit_str


# ------------------------------
# Exempt paths (skip rate limiting entirely)
# ------------------------------
EXEMPT_PATHS = {
    "/health",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/favicon.ico",
    "/",
}

EXEMPT_PREFIXES = (
    "/webhook/",
    "/billing/webhook/",
    "/public/",  # public SDK endpoints
)


def should_skip_rate_limit(request: Request) -> bool:
    """
    Determine whether the request should bypass rate limiting.
    """
    path = request.url.path
    if path in EXEMPT_PATHS:
        return True
    if any(path.startswith(p) for p in EXEMPT_PREFIXES):
        return True
    # Webhook tier is unlimited
    if _get_endpoint_tier(path) == "webhook":
        return True
    return False


# ------------------------------
# Custom key+limit callable for slowapi
# ------------------------------
def custom_rate_limit_key(request: Request) -> str:
    """
    Combined key+limit callable that slowapi expects when using dynamic limits.
    We'll use a separate dynamic limit function, so this only returns the key.
    """
    return get_rate_limit_key(request)


# ------------------------------
# Rate‑limit exceeded handler
# ------------------------------
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """
    Return a 429 JSON response with Retry‑After header.
    """
    import time
    from fastapi.responses import JSONResponse

    # Calculate retry‑after seconds (default 60)
    retry_after = 60

    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded",
            "retry_after": retry_after,
        },
        headers={"Retry-After": "60"},
    )


# ------------------------------
# Limiter instance
# ------------------------------
limiter = Limiter(
    key_func=custom_rate_limit_key,
    default_limits=["60/minute"],  # sensible fallback; per‑tier limits via explicit decorators
    strategy="sliding-window-counter",  # sliding window algorithm
    storage_uri=REDIS_URL,
    storage_options={"socket_connect_timeout": 5},
    swallow_errors=True,  # fail open on Redis errors
    retry_after="http-date",
    key_prefix="",
    enabled=True,
)


# ------------------------------
# Post‑initialization: exempt certain routes
# ------------------------------
def exempt_webhook_routes(app):
    """
    Apply @limiter.exempt to all routes that match exempt prefixes.
    Must be called after all routes have been added to the app.
    """
    for route in app.routes:
        path = getattr(route, "path", None)
        if path is None:
            continue
        if path in EXEMPT_PATHS or any(path.startswith(p) for p in EXEMPT_PREFIXES):
            if hasattr(route, "endpoint"):
                route.endpoint = limiter.exempt(route.endpoint)
    return app


# ------------------------------
# Helper to attach limiter to FastAPI app
# ------------------------------
def attach_rate_limiter(app):
    """
    Attach the limiter to the FastAPI app, add exception handler,
    and exempt webhook routes.
    """
    # Store limiter in app state (required by slowapi)
    app.state.limiter = limiter

    # Register SlowAPI middleware (required for default_limits to be enforced)
    app.add_middleware(SlowAPIMiddleware)

    # Register rate‑limit exceeded handler
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

    # Exempt webhook routes (must be done after all routes are added)
    # This function should be called after app.include_router for all routers.
    exempt_webhook_routes(app)

    # Log initialization
    global logger
    if logger is None:
        import structlog

        logger = structlog.get_logger()
    logger.info(
        "rate_limiter_attached", strategy="sliding-window-counter", redis_url=REDIS_URL
    )

    return app
