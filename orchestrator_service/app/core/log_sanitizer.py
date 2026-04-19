# Phase 1 Critical Security — Log Sanitizer
"""
Módulo de sanitización de logs para prevenir filtraciones de datos sensibles.

Patrones soportados:
- OPENAI_API_KEY (sk-...)
- STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
- SUPABASE_SERVICE_KEY (eyJ...)
- ENCRYPTION_KEY
- MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET
- ADMIN_TOKEN
- INTERNAL_API_TOKEN

Todos los regex están precompilados como constantes de módulo para máximo rendimiento.
"""

import logging
import re
from typing import Any

# =============================================================================
# PATRONES DE SANITIZACIÓN — Precompiladas como constantes de módulo
# =============================================================================

# API Keys y tokens (genéricos)
_API_KEY_PATTERN = re.compile(r"sk-(?:[-\w]+)?[a-zA-Z0-9]{20,}")
_BEARER_TOKEN_PATTERN = re.compile(
    r"Bearer\s+(?:eyJ[a-zA-Z0-9_-]+\.?[a-zA-Z0-9_-]+\.?[a-zA-Z0-9_-]*)", re.IGNORECASE
)
_JSON_SECRET_PATTERN = re.compile(
    r"(?:['\"])(?:token|api[_-]?key|secret|password|access[_-]?token|auth[_-]?token)(?:['\"]\s*:\s*['\"])([a-zA-Z0-9_\-]{20,})(?:['\"])",
    re.IGNORECASE,
)

# OpenAI
_OPENAI_API_KEY_PATTERN = re.compile(r"OPENAI_API_KEY\s*=\s*sk-[a-zA-Z0-9]+")

# Stripe
_STRIPE_SECRET_KEY_PATTERN = re.compile(
    r"STRIPE_(?:SECRET|WEBHOOK)_KEY\s*=\s*sk_(?:live|test)_[a-zA-Z0-9]+", re.IGNORECASE
)
_STRIPE_WEBHOOK_SECRET_PATTERN = re.compile(r"whsec_[a-zA-Z0-9]+")

# Supabase
_SUPABASE_SERVICE_KEY_PATTERN = re.compile(
    r"EYJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+"
)

# Encryption
_ENCRYPTION_KEY_PATTERN = re.compile(
    r"ENCRYPTION_KEY\s*=\s*[\"']?([a-zA-Z0-9_\-]{32,})[\"']?", re.IGNORECASE
)

# MercadoPago
_MP_ACCESS_TOKEN_PATTERN = re.compile(
    r"MP_ACCESS_TOKEN\s*=\s*[\"']?TEST-[a-zA-Z0-9]+-[\"']?", re.IGNORECASE
)
_MP_WEBHOOK_SECRET_PATTERN = re.compile(
    r"MP_WEBHOOK_SECRET\s*=\s*[\"']?[a-zA-Z0-9_\-]+[\"']?", re.IGNORECASE
)

# Admin & Internal
_ADMIN_TOKEN_PATTERN = re.compile(
    r"ADMIN_TOKEN\s*=\s*[\"']?([a-zA-Z0-9_\-]{20,})[\"']?", re.IGNORECASE
)
_INTERNAL_API_TOKEN_PATTERN = re.compile(
    r"INTERNAL_API_TOKEN\s*=\s*[\"']?([a-zA-Z0-9_\-]{20,})[\"']?", re.IGNORECASE
)

# Lista de patrones para sanitización (Pattern → Replacement)
_SANITIZE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (_OPENAI_API_KEY_PATTERN, "[REDACTED_OPENAI]"),
    (_STRIPE_SECRET_KEY_PATTERN, "[REDACTED_STRIPE]"),
    (_STRIPE_WEBHOOK_SECRET_PATTERN, "[REDACTED_STRIPE]"),
    (_SUPABASE_SERVICE_KEY_PATTERN, "[REDACTED_SUPABASE]"),
    (_ENCRYPTION_KEY_PATTERN, "[REDACTED_ENCRYPTION]"),
    (_MP_ACCESS_TOKEN_PATTERN, "[REDACTED_MP]"),
    (_MP_WEBHOOK_SECRET_PATTERN, "[REDACTED_MP]"),
    (_ADMIN_TOKEN_PATTERN, "[REDACTED_ADMIN]"),
    (_INTERNAL_API_TOKEN_PATTERN, "[REDACTED_INTERNAL]"),
    (_API_KEY_PATTERN, "[REDACTED_API_KEY]"),
    (_BEARER_TOKEN_PATTERN, "[REDACTED_BEARER]"),
    (_JSON_SECRET_PATTERN, r'\1"[REDACTED]"\3'),
]

# =============================================================================
# FUNCIONES PÚBLICAS
# =============================================================================


def sanitize_message(message: str) -> str:
    """
    Sanitiza todos los datos sensibles de un mensaje de log.

    Args:
        message: El mensaje a sanitizar

    Returns:
        El mensaje con todos los secretos reemplazados por [REDACTED]
    """
    if not message:
        return message

    result = message
    for pattern, replacement in _SANITIZE_PATTERNS:
        result = pattern.sub(replacement, result)

    return result


def sanitize_value(value: str) -> str:
    """
    Sanitiza un valor individual (para uso en estructuras de datos).

    Alias de sanitize_message para contextos donde el nombre es más claro.
    """
    return sanitize_message(value)


def sanitize_dict(
    data: dict[str, Any], keys_to_sanitize: list[str] | None = None
) -> dict[str, Any]:
    """
    Sanitiza valores específicos en un diccionario.

    Args:
        data: Diccionario a sanitizar
        keys_to_sanitize: Lista de claves a sanitizar (None = todas)

    Returns:
        Copia del diccionario con valores sanitizados
    """
    if not data:
        return data

    result = dict(data)
    for key, value in result.items():
        if keys_to_sanitize and key not in keys_to_sanitize:
            continue
        if isinstance(value, str):
            result[key] = sanitize_message(value)

    return result


# =============================================================================
# LOGGING FILTER
# =============================================================================


class SensitiveDataFilter(logging.Filter):
    """
    Filter de logging que sanitiza todos los mensajes antes de ser emitidos.

    Instalar con install_log_sanitizer().
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """
        Sanitiza el mensaje y argumentos del LogRecord.

        Args:
            record: El LogRecord a filtrar

        Returns:
            True (siempre permite el log)
        """
        # Sanitizar msg (el mensaje principal)
        if record.msg and isinstance(record.msg, str):
            record.msg = sanitize_message(record.msg)

        # Sanitizar args (parámetros de formateo)
        if record.args:
            # args puede ser tuple (formateo con %) o dict (formateo con {})
            if isinstance(record.args, tuple):
                sanitized_args = []
                for arg in record.args:
                    if isinstance(arg, str):
                        sanitized_args.append(sanitize_message(arg))
                    else:
                        sanitized_args.append(arg)
                record.args = tuple(sanitized_args)
            elif isinstance(record.args, dict):
                sanitized_args = {}
                for key, value in record.args.items():
                    if isinstance(value, str):
                        sanitized_args[key] = sanitize_message(value)
                    else:
                        sanitized_args[key] = value
                record.args = sanitized_args

        return True


# =============================================================================
# INSTALACIÓN
# =============================================================================


def install_log_sanitizer() -> None:
    """
    Instala el SensitiveDataFilter en el root logger.

    Debe llamarse DESPUÉS de logging.basicConfig().
    """
    root_logger = logging.getLogger()

    # Verificar si ya está instalado
    for f in root_logger.filters:
        if isinstance(f, SensitiveDataFilter):
            # Ya instalado, no duplicar
            return

    # Agregar filter al root logger
    root_logger.addFilter(SensitiveDataFilter())


def is_installed() -> bool:
    """
    Verifica si el log sanitizer ya está instalado.

    Returns:
        True si el filter está presente en el root logger
    """
    root_logger = logging.getLogger()
    return any(isinstance(f, SensitiveDataFilter) for f in root_logger.filters)
