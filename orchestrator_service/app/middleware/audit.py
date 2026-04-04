"""
Audit Middleware
Logs sensitive HTTP requests for compliance (SOC2, ISO27001).
Captures: who (user_id), what (action), when, from where (IP, user_agent).
"""

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from jose import jwt, JWTError
from typing import Optional, Tuple

from app.core.config import settings
from app.services.audit_logger import audit_logger

logger = structlog.get_logger()

# Map request paths to audit action names
ACTION_MAP = {
    # Authentication
    "/auth/login": "auth.login",
    "/auth/logout": "auth.logout",
    "/auth/register": "auth.register",
    # Billing
    "/billing/change-plan": "billing.plan_changed",
    "/billing/checkout": "billing.checkout",
    "/billing/subscribe": "billing.subscribe",
    "/billing/cancel": "billing.cancel",
    # Tenant management
    "/platform/tenants": "tenant.created",  # POST
    "/platform/tenants/{tenant_id}": "tenant.deleted",  # DELETE
    # Credentials
    "/platform/credentials": "credentials.created",  # POST
    "/platform/credentials/{credential_id}": "credentials.deleted",  # DELETE
    # Data export
    "/data/export": "data.export",
    # Admin actions (prefix)
    "/platform/": "admin.action",
    "/admin/": "admin.action",
}

# Paths that should be audited (exact or prefix)
AUDIT_PATHS_EXACT = {
    "/auth/login",
    "/auth/logout",
    "/auth/register",
    "/billing/change-plan",
    "/billing/checkout",
    "/billing/subscribe",
    "/billing/cancel",
    "/data/export",
}

AUDIT_PATHS_PREFIX = {
    "/platform/",
    "/admin/",
    "/tenants/",
    "/credentials/",
}


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs audit events for sensitive actions.
    """

    def _get_action_from_path(self, path: str, method: str) -> Optional[str]:
        """Determine audit action based on path and HTTP method."""
        # Exact matches first
        if path in ACTION_MAP:
            return ACTION_MAP[path]

        # Prefix matches
        for prefix, action in ACTION_MAP.items():
            if prefix.endswith("/") and path.startswith(prefix):
                return action

        # Default mapping based on path patterns
        if path.startswith("/platform/tenants") and method == "POST":
            return "tenant.created"
        if path.startswith("/platform/tenants") and method == "DELETE":
            return "tenant.deleted"
        if path.startswith("/platform/credentials") and method == "POST":
            return "credentials.created"
        if path.startswith("/platform/credentials") and method == "DELETE":
            return "credentials.deleted"

        return None

    def _should_audit(self, path: str) -> bool:
        """Check if the request path should be audited."""
        if path in AUDIT_PATHS_EXACT:
            return True
        for prefix in AUDIT_PATHS_PREFIX:
            if path.startswith(prefix):
                return True
        return False

    def _extract_user_from_token(
        self, request: Request
    ) -> Optional[Tuple[str, Optional[int]]]:
        """
        Extract user_id and tenant_id from JWT token.
        Returns (user_id, tenant_id) or (None, None).
        """
        # Try cookie first
        token = request.cookies.get("access_token")
        if not token:
            # Try Authorization header
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            return None, None

        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY.get_secret_value(), algorithms=["HS256"]
            )
            user_uuid = payload.get("sub")
            if not user_uuid:
                return None, None

            # Tenant ID is not stored in token; would need DB lookup.
            # We'll return only user_id for now.
            return user_uuid, None
        except JWTError:
            return None, None

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip non-audited paths early
        path = request.url.path
        if not self._should_audit(path):
            return await call_next(request)

        # Extract client IP and user agent
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")

        # Determine action
        action = self._get_action_from_path(path, request.method)
        if not action:
            # No specific action mapped, use generic
            action = f"http.{request.method.lower()}.{path.replace('/', '.')}"

        # Process request
        response = await call_next(request)

        # Adjust action based on response status for login
        if path == "/auth/login":
            if response.status_code == 200:
                action = "auth.login"
            else:
                action = "auth.login_failed"

        # Extract user info from token (if any)
        user_id, tenant_id = self._extract_user_from_token(request)

        # Prepare details
        details = {
            "method": request.method,
            "path": path,
            "status_code": response.status_code,
            "query_params": dict(request.query_params),
        }

        # Log the audit event
        await audit_logger.log(
            user_id=user_id,
            tenant_id=tenant_id,
            action=action,
            ip_address=ip,
            user_agent=user_agent,
            details=details,
        )

        return response
