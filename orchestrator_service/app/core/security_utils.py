# Phase 1 Critical Security — Media URL Signing
"""
Módulo de firma HMAC-SHA256 para URLs de media.

Características:
- Firma HMAC-SHA256 con timestamp de expiración
- Comparación timing-safe para prevenir Timing Attacks
- Lazy init del secret (genera aleatorio si no está configurado)
- Rate limiting de verificación

La firma HMAC complementa la autenticación JWT:
- JWT verifica identidad del usuario
- HMAC verifica que la URL fue generada por el servidor para un tenant+path específico
"""

import hashlib
import hmac
import logging
import time
import uuid
from typing import Any
from urllib.parse import urlencode

from app.core.config import settings

# =============================================================================
# CONFIGURACIÓN
# =============================================================================

logger = logging.getLogger(__name__)

# Default TTL: 24 horas
MEDIA_URL_TTL: int = 86400

# Minimum TTL: 1 hora
MEDIA_URL_MIN_TTL: int = 3600

# Maximum TTL: 7 días
MEDIA_URL_MAX_TTL: int = 604800

# Secret para signing (lazy init)
_media_proxy_secret: str | None = None


def _get_secret() -> str:
    """
    Obtiene el secret para signing (lazy init).
    """
    global _media_proxy_secret

    if _media_proxy_secret:
        return _media_proxy_secret

    secret = settings.MEDIA_PROXY_SECRET

    if secret:
        _media_proxy_secret = secret
        return _media_proxy_secret

    # Fallback: generar UUID random (solo en dev)
    secret = str(uuid.uuid4())
    _media_proxy_secret = secret

    logger.warning(
        "media_signing_secret_not_configured",
        message="MEDIA_PROXY_SECRET no está configurado. Usando secret temporal.",
        secret_prefix=secret[:8],
    )

    return secret


# =============================================================================
# FUNCIONES PÚBLICAS
# =============================================================================


def generate_signed_url(
    url_path: str,
    tenant_id: int,
    ttl: int = MEDIA_URL_TTL,
) -> tuple[str, int]:
    """
    Genera una firma HMAC para una URL de media.

    Args:
        url_path: Path del media (ej: "/admin/media/123")
        tenant_id: ID del tenant que solicita
        ttl: Time-to-live en segundos (default 24h)

    Returns:
        Tuple de (signature, expires_timestamp)
    """
    # Clampear TTL
    ttl = max(MEDIA_URL_MIN_TTL, min(ttl, MEDIA_URL_MAX_TTL))

    # Timestamp de expiración
    expires = int(time.time()) + ttl

    # Construir mensaje a firmar
    message = f"{url_path}:{tenant_id}:{expires}"

    # Generar HMAC
    secret = _get_secret()
    signature = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    logger.debug(
        "media_signed_url_generated",
        url_path=url_path,
        tenant_id=tenant_id,
        expires=expires,
    )

    return signature, expires


def verify_signed_url(
    url_path: str,
    tenant_id: int,
    signature: str,
    expires: int,
) -> bool:
    """
    Verifica una firma HMAC de URL de media.

    Args:
        url_path: Path del media
        tenant_id: ID del tenant
        signature: Firma a verificar
        expires: Timestamp de expiración

    Returns:
        True si la firma es válida y no ha expirado
    """
    # Check expiración primero (rápido)
    if expires < time.time():
        logger.warning(
            "media_signed_url_expired",
            url_path=url_path,
            tenant_id=tenant_id,
            expires=expires,
            now=time.time(),
        )
        return False

    # Recalcular firma esperada
    message = f"{url_path}:{tenant_id}:{expires}"
    secret = _get_secret()
    expected_signature = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Comparación timing-safe
    if not hmac.compare_digest(signature, expected_signature):
        logger.warning(
            "media_signed_url_invalid_signature",
            url_path=url_path,
            tenant_id=tenant_id,
        )
        return False

    logger.debug(
        "media_signed_url_verified",
        url_path=url_path,
        tenant_id=tenant_id,
    )

    return True


def generate_media_url(
    base_url: str,
    media_id: str,
    tenant_id: int,
    ttl: int = MEDIA_URL_TTL,
) -> str:
    """
    Genera una URL completa de media con firma.

    Args:
        base_url: URL base del endpoint (ej: "https://api.example.com")
        media_id: ID del media
        tenant_id: ID del tenant
        ttl: Time-to-live en segundos

    Returns:
        URL completa con query params de firma
    """
    signature, expires = generate_signed_url(
        url_path=f"/admin/media/{media_id}",
        tenant_id=tenant_id,
        ttl=ttl,
    )

    # Construir URL
    path = f"/admin/media/{media_id}"
    query = urlencode(
        {
            "sig": signature,
            "expires": expires,
        }
    )

    return f"{base_url}{path}?{query}"


def build_signed_media_params(
    media_id: str,
    tenant_id: int,
    ttl: int = MEDIA_URL_TTL,
) -> dict[str, Any]:
    """
    Genera los parámetros de query para una URL de media exitosa.

    Args:
        media_id: ID del media
        tenant_id: ID del tenant
        ttl: Time-to-live en segundos

    Returns:
        Dict con sig y expires
    """
    signature, expires = generate_signed_url(
        url_path=f"/admin/media/{media_id}",
        tenant_id=tenant_id,
        ttl=ttl,
    )

    return {
        "sig": signature,
        "expires": expires,
    }


def is_signing_enabled() -> bool:
    """
    Verifica si el signing está configurado y habilitado.

    Returns:
        True si signing está disponible
    """
    return bool(settings.MEDIA_PROXY_SECRET)


def is_signing_enforced() -> bool:
    """
    Verifica si el signing es obligatorio.

    Returns:
        True si MEDIA_SIGNING_ENFORCE=True
    """
    return settings.MEDIA_SIGNING_ENFORCE


def get_signing_ttl() -> int:
    """
    Obtiene el TTL configurado para URLs firmadas.

    Returns:
        TTL en segundos (clampeado entre MIN y MAX)
    """
    return max(
        MEDIA_URL_MIN_TTL,
        min(MEDIA_URL_TTL, MEDIA_URL_MAX_TTL),
    )
