# Phase 1 Critical Security — Sentry Error Tracking
"""
Módulo de configuración de Sentry con scrubbing de PII.

Características:
- Import dinámico de sentry_sdk (opcional, no bloquea si no está instalado)
- Scrubbing de headers sensibles
- Scrubbing de datos extra (teléfonos, emails, API keys)
- Scrubbing de breadcrumbs
"""

import logging
import re
from typing import Any

from app.core.config import settings

# =============================================================================
# CONFIGURACIÓN
# =============================================================================

logger = logging.getLogger(__name__)

# Patrones de PII precompilados
_PHONE_PATTERN = re.compile(
    r"\+?[0-9]{1,3}[-.\s]?\(?[0-9]{1,4}\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}"
)
_EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Headers sensibles (se scrubbean completamente)
_SENSITIVE_HEADERS: set[str] = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "x-internal-token",  # Platform AI Solutions específico
    "x-auth-token",
}

# Keys en extra data que se scrubbean
_SENSITIVE_EXTRA_KEYS: set[str] = {
    "token",
    "api_key",
    "secret",
    "password",
    "access_token",
    "refresh_token",
    "authorization",
    "credential",
    "key",
}

# =============================================================================
# SCRUBBING DE PII
# =============================================================================


def _scrub_value(value: Any) -> Any:
    """
    Scrub un valor individual, retornando [REDACTED_TYPE] si contiene PII.
    """
    if not isinstance(value, str):
        return value

    # Check for phone
    if _PHONE_PATTERN.search(value):
        return "[REDACTED_PHONE]"

    # Check for email
    if _EMAIL_PATTERN.search(value):
        return "[REDACTED_EMAIL]"

    return value


def _scrub_dict(data: dict[str, Any], depth: int = 0) -> dict[str, Any]:
    """
    Recursively scrub PII from dict, including nested dicts and lists.

    Args:
        data: Dictionary to scrub
        depth: Current recursion depth (max 5 to prevent infinite loops)

    Returns:
        Scrubbed dictionary
    """
    if depth > 5:
        return data

    result = {}
    for key, value in data.items():
        key_lower = key.lower()

        # Check if this key should be fully redacted
        if key_lower in _SENSITIVE_EXTRA_KEYS:
            result[key] = "[REDACTED]"
            continue

        # Recurse into nested dicts
        if isinstance(value, dict):
            result[key] = _scrub_dict(value, depth + 1)
        # Recurse into lists
        elif isinstance(value, list):
            result[key] = [
                _scrub_dict(item, depth + 1)
                if isinstance(item, dict)
                else _scrub_value(item)
                for item in value
            ]
        # Scrub scalar values
        else:
            result[key] = _scrub_value(value)

    return result


def _scrub_headers(headers: dict[str, str]) -> dict[str, str]:
    """
    Scrub sensitive headers from request/response.
    """
    if not headers:
        return headers

    result = dict(headers)
    for header in _SENSITIVE_HEADERS:
        if header in result:
            result[header] = "[REDACTED]"

    return result


def _scrubEvent(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any]:
    """
    Callback de before_send para scrubbear PII antes de enviar a Sentry.

    Args:
        event: Evento de Sentry a scrubbear
        hint: Hint con información adicional (request, etc.)

    Returns:
        Evento scrubbed
    """
    try:
        # Scrub request data
        if "request" in event:
            request_data = event.get("request", {})

            # Scrub headers
            if "headers" in request_data:
                request_data["headers"] = _scrub_headers(request_data["headers"])

            # Scrub cookies
            if "cookies" in request_data:
                request_data["cookies"] = "[REDACTED]"

            # Scrub data (POST body)
            if "data" in request_data and isinstance(request_data["data"], dict):
                request_data["data"] = _scrub_dict(request_data["data"])

            event["request"] = request_data

        # Scrub extra (custom context)
        if "extra" in event and isinstance(event["extra"], dict):
            event["extra"] = _scrub_dict(event["extra"])

        # Scrub breadcrumbs
        if "breadcrumbs" in event and isinstance(event["breadcrumbs"], dict):
            breadcrumbs = event["breadcrumbs"]
            if "values" in breadcrumbs and isinstance(breadcrumbs["values"], list):
                for crumb in breadcrumbs["values"]:
                    if not isinstance(crumb, dict):
                        continue
                    # Scrub message
                    if "message" in crumb and isinstance(crumb["message"], str):
                        crumb["message"] = _scrub_value(crumb["message"])
                    # Scrub data
                    if "data" in crumb and isinstance(crumb["data"], dict):
                        crumb["data"] = _scrub_dict(crumb["data"])

    except Exception as e:
        logger.warning("sentry_scrub_failed", error=str(e))

    return event


# =============================================================================
# INICIALIZACIÓN
# =============================================================================


def init_sentry() -> bool:
    """
    Inicializa Sentry con PII scrubbing.

    Returns:
        True si Sentry se inicializó correctamente, False si no-op o falló
    """
    dsn = settings.SENTRY_DSN

    if not dsn:
        # No DSN = noop (desarrollo)
        logger.info("sentry_disabled_no_dsn")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import (
            LoggingIntegration as SentryLoggingIntegration,
        )
    except ImportError:
        logger.warning("sentry_sdk_not_installed")
        return False

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            integrations=[
                FastApiIntegration(),
                SentryLoggingIntegration(
                    event_level="warning",
                    level="info",
                ),
            ],
            before_send=_scrubEvent,
            # No enviar PII
            send_default_pii=False,
            # Timeout para evitar bloqueos
            request_bucketsize=100,
        )
        logger.info(
            "sentry_initialized",
            environment=settings.SENTRY_ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        )
        return True

    except Exception as e:
        logger.warning("sentry_init_failed", error=str(e))
        return False


def is_sentry_enabled() -> bool:
    """
    Verifica si Sentry está configurado y habilitado.
    """
    return bool(settings.SENTRY_DSN)
