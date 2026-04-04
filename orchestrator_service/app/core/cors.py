"""
CORS validation utilities for security hardening (RF‑007).
"""

import logging
from typing import List, Optional
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)


def validate_cors_origin(
    origin: Optional[str], allowed_origins: Optional[List[str]] = None
) -> Optional[str]:
    """
    Validate that the given origin is present in the allowed origins list.

    Returns the origin unchanged if allowed, otherwise returns None.
    Logs a warning if the allowed_origins list contains the wildcard '*'.
    """
    if allowed_origins is None:
        allowed_origins = settings.CORS_ALLOWED_ORIGINS

    if not origin:
        return None

    # Safety: ensure allowed_origins is a list
    if not isinstance(allowed_origins, list):
        logger.warning(
            "CORS allowed_origins is not a list, rejecting all origins",
            allowed_origins=allowed_origins,
        )
        return None

    # Warn about wildcard usage (security risk)
    if "*" in allowed_origins:
        logger.warning(
            "CORS allowed_origins contains wildcard '*'; this is insecure and should be removed in production",
            allowed_origins=allowed_origins,
        )
        # In production we could raise an exception, but for compatibility we continue.
        # However, we must NOT return "*" as the validated origin when credentials are allowed.
        # The caller should handle this case appropriately (e.g., avoid setting allow_credentials).
        # For validation, treat "*" as "allow any origin" and pass through.
        return origin

    # Exact match
    if origin in allowed_origins:
        return origin

    # Optional: support schema‑agnostic matching (http vs https) if needed.
    # Not implemented; only exact matches are accepted.

    logger.debug(
        "CORS origin not allowed", origin=origin, allowed_origins=allowed_origins
    )
    return None


def get_validated_origin_header(
    request_origin: Optional[str], allowed_origins: Optional[List[str]] = None
) -> dict:
    """
    Return a dict with the appropriate CORS headers for a response,
    or an empty dict if the origin is not allowed.
    """
    validated = validate_cors_origin(request_origin, allowed_origins)
    if validated:
        return {
            "Access-Control-Allow-Origin": validated,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}
