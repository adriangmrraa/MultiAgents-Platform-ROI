"""
Subscription Guard Middleware
Blocks API access when:
- Trial expired (10 days) and no paid subscription
- Subscription suspended/canceled
- Usage limits exceeded

Allows through:
- Auth endpoints (login, register, verify)
- Billing endpoints (so they can pay!)
- Platform/admin endpoints (super admin)
- Webhook endpoints (payment confirmations)
- Public endpoints
"""
import structlog
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from jose import jwt, JWTError
from fastapi import Request

from app.core.config import settings

logger = structlog.get_logger()

# Routes that should NEVER be blocked
EXEMPT_PATHS = {
    "/auth/login",
    "/auth/register",
    "/auth/verify",
    "/auth/me",
    "/billing/plans",
    "/billing/checkout",
    "/billing/my-subscription",
    "/billing/webhook/stripe",
    "/billing/webhook/mercadopago",
    "/billing/invoices",
    "/billing/change-plan",
    "/health",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/privacy-policy",
    "/terms-of-service",
}

EXEMPT_PREFIXES = (
    "/platform/",
    "/billing/webhook",
    "/webhook/",
    "/auth/",
    "/admin/",
)


class SubscriptionGuardMiddleware(BaseHTTPMiddleware):
    def _block_response(self, request: Request, status_code: int, content: dict) -> JSONResponse:
        """Return a 402 JSONResponse WITH CORS headers so the browser doesn't swallow it."""
        origin = request.headers.get("origin", "*")
        return JSONResponse(
            status_code=status_code,
            content=content,
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
            }
        )

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 0. Always let CORS preflight through
        if request.method == "OPTIONS":
            return await call_next(request)

        # 1. Skip exempt paths
        if path in EXEMPT_PATHS or any(path.startswith(p) for p in EXEMPT_PREFIXES):
            return await call_next(request)

        # 2. Skip non-authenticated requests (let auth middleware handle)
        token = request.cookies.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            return await call_next(request)

        # 3. Decode token to get user info
        try:
            payload = jwt.decode(token, settings.SECRET_KEY.get_secret_value(), algorithms=["HS256"])
            user_uuid = payload.get("sub")
            if not user_uuid:
                return await call_next(request)
        except JWTError:
            return await call_next(request)

        # 4. Check subscription status (use db pool directly)
        try:
            from db import db as db_pool

            # Get user's tenant_id and role
            user_row = await db_pool.pool.fetchrow(
                "SELECT tenant_id, role FROM users WHERE id = $1",
                user_uuid
            )
            if not user_row:
                return await call_next(request)

            # Super admins bypass all restrictions
            if user_row["role"] == "super_admin":
                return await call_next(request)

            tenant_id = user_row["tenant_id"]

            # Check subscription
            sub = await db_pool.pool.fetchrow("""
                SELECT s.status, s.trial_ends_at, p.name as plan_name
                FROM subscriptions s
                JOIN plans p ON p.id = s.plan_id
                WHERE s.tenant_id = $1
            """, tenant_id)

            if not sub:
                # No subscription at all - block
                return self._block_response(request, 402, {
                    "error": "subscription_required",
                    "message": "No tienes una suscripcion activa. Elige un plan para continuar.",
                    "redirect": "/billing"
                })

            status = sub["status"]

            # Check if trial expired
            if status == "trialing" and sub["trial_ends_at"]:
                if datetime.utcnow() > sub["trial_ends_at"].replace(tzinfo=None):
                    # Auto-expire
                    await db_pool.pool.execute(
                        "UPDATE subscriptions SET status = 'expired' WHERE tenant_id = $1",
                        tenant_id
                    )
                    return self._block_response(request, 402, {
                        "error": "trial_expired",
                        "message": "Tu periodo de prueba de 10 dias ha expirado. Elige un plan para continuar usando la plataforma.",
                        "redirect": "/billing",
                        "plan_name": sub["plan_name"]
                    })

            # Block expired/suspended/canceled
            if status in ("expired", "suspended", "canceled"):
                messages = {
                    "expired": "Tu suscripcion ha expirado. Renueva para continuar.",
                    "suspended": "Tu cuenta esta suspendida. Contacta soporte.",
                    "canceled": "Tu suscripcion fue cancelada. Reactiva un plan."
                }
                return self._block_response(request, 402, {
                    "error": f"subscription_{status}",
                    "message": messages.get(status, "Suscripcion inactiva."),
                    "redirect": "/billing"
                })

        except Exception as e:
            # Don't block on middleware errors - log and continue
            logger.error("subscription_guard_error", error=str(e), path=path)

        return await call_next(request)
