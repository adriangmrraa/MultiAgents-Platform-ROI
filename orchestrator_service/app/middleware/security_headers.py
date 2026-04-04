"""
Security Headers Middleware
Adds HTTP security headers for protection against XSS, clickjacking, and other OWASP Top 10 attacks.
"""

import os
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.core.config import is_production


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds security headers to all HTTP responses.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # HSTS - Force HTTPS (only in production)
        if is_production():
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        # CSP - Content Security Policy (configurable by environment)
        if is_production():
            # Production: strict CSP
            csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
        else:
            # Development: more permissive (allow eval for debugging)
            csp = "default-src 'self' 'unsafe-eval' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"

        response.headers["Content-Security-Policy"] = csp

        # X-Frame-Options - Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # X-Content-Type-Options
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Referrer-Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )

        # X-XSS-Protection (legacy but still recommended)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        return response
