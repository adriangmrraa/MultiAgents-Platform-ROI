# Phase 1 Critical Security — Prompt Injection Detection
"""
Módulo de detección de prompt injection bilingüe (ES/EN).

Usa regex precompilado para:
- Latencia cero (sin dependencia de ML/LLM)
- Costo cero
- Predecible y testeable
- Sin dependencias externas

El LLM puede complementar con defensa en su system prompt,
pero esta es la primera capa determinista.
"""

import logging
import re
from typing import Any

# =============================================================================
# PATRONES DE PROMPT INJECTION — Precompiladas como constantes de módulo
# =============================================================================

# =============================================================================
# Patrones en ESPAÑOL (10+ patrones)
# =============================================================================

# Ignorar instrucciones previas
_INJECTION_PATTERN_ES_IGNORE = re.compile(
    r"ignor(?:a|á|e|é)[:.]?\s*(?:las\s+)?(?:instrucciones?\s+)?(?:anteriores?|previas?|del\s+sistema)?",
    re.IGNORECASE,
)

# Modo desarrollador / developer mode
_INJECTION_PATTERN_ES_DEVELOPER = re.compile(
    r"modo\s+desarrollador|developer\s+mode", re.IGNORECASE
)

# Mostrar el prompt del sistema
_INJECTION_PATTERN_ES_SHOW_PROMPT = re.compile(
    r"mostr(?:a|á)[:.]?\s*(?:el\s+)?prompt(?:\s+del\s+sistema)?|dame\s+el\s+system\s+prompt",
    re.IGNORECASE,
)

# Actuá / act as /模拟
_INJECTION_PATTERN_ES_ACT_AS = re.compile(
    r"actu(?:a|á)[:.]?\s*(?:como\s+)?(?:si\s+fueras?|que\s+eres?)|act\s+as\s+if\s+you\s+were",
    re.IGNORECASE,
)

# Olvidar / forget / reset
_INJECTION_PATTERN_ES_FORGET = re.compile(
    r"olvid(?:a|á)[:.]?\s*(?:todo|las|instrucciones?)|forget\s+everything|reset\s+(?:all\s+)?instructions",
    re.IGNORECASE,
)

# Eres / you are /现在是
_INJECTION_PATTERN_ES_YOU_ARE = re.compile(
    r"(?:eres|sois|usted\s+es)[:.]?\s*(?:un\s+)?chatgpt|you\s+are\s+(?:now\s+)?(?:a\s+)?gpt",
    re.IGNORECASE,
)

# Nueva instrucción / nuevos comandos
_INJECTION_PATTERN_ES_NEW_INSTRUCTION = re.compile(
    r"(?:nueva|seguir)\s+instrucción|:new\s+instruction|:new\s+command", re.IGNORECASE
)

# Jailbreak
_INJECTION_PATTERN_ES_JAILBREAK = re.compile(
    r"dame\s+acceso\s+(?:root|admin)|jailbreak", re.IGNORECASE
)

# Desactivar seguridad
_INJECTION_PATTERN_ES_DISABLE_SAFETY = re.compile(
    r"desactiv(?:a|á)|disable\s+(?:safety|filter)|bypass\s+(?:safety|filter)",
    re.IGNORECASE,
)

# Extracción de datos del cliente
_INJECTION_PATTERN_ES_DATA_EXTRACTION = re.compile(
    r"dame\s+(?:los\s+)?datos\s+(?:de\s+)?cliente|dame\s+(?:mi|el)\s+(?:email|phone|teléfono)",
    re.IGNORECASE,
)

# Manipulación de precios
_INJECTION_PATTERN_ES_PRICE_MANIPULATION = re.compile(
    r"cambi(?:a|á)[:.]?\s*el\s+precio|pon(?:e|é)\s+(?:el\s+)?precio\s+en", re.IGNORECASE
)

# Lista de patrones ES
INJECTION_PATTERNS_ES: list[re.Pattern] = [
    _INJECTION_PATTERN_ES_IGNORE,
    _INJECTION_PATTERN_ES_DEVELOPER,
    _INJECTION_PATTERN_ES_SHOW_PROMPT,
    _INJECTION_PATTERN_ES_ACT_AS,
    _INJECTION_PATTERN_ES_FORGET,
    _INJECTION_PATTERN_ES_YOU_ARE,
    _INJECTION_PATTERN_ES_NEW_INSTRUCTION,
    _INJECTION_PATTERN_ES_JAILBREAK,
    _INJECTION_PATTERN_ES_DISABLE_SAFETY,
    _INJECTION_PATTERN_ES_DATA_EXTRACTION,
    _INJECTION_PATTERN_ES_PRICE_MANIPULATION,
]


# =============================================================================
# Patrones en INGLÉS (11+ patrones)
# =============================================================================

_INJECTION_PATTERN_EN_IGNORE = re.compile(
    r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?", re.IGNORECASE
)

_INJECTION_PATTERN_EN_DEVELOPER = re.compile(
    r"(?:developer\s+mode|dev\s+mode)", re.IGNORECASE
)

_INJECTION_PATTERN_EN_SHOW_PROMPT = re.compile(
    r"(?:show|reveal|print)\s+(?:me\s+)?(?:the\s+)?system\s+prompt", re.IGNORECASE
)

_INJECTION_PATTERN_EN_ACT_AS = re.compile(
    r"act\s+(?:as\s+)?(?:if|though)\s+(?:you\s+were?|being)", re.IGNORECASE
)

_INJECTION_PATTERN_EN_FORGET = re.compile(
    r"forget\s+(?:everything|all\s+)|reset\s+(?:all\s+)?(?:instructions?|context)",
    re.IGNORECASE,
)

_INJECTION_PATTERN_EN_YOU_ARE = re.compile(
    r"(?:you\s+are|youar(?:e|ing))[:.]?\s*(?:now\s+)?(?:a\s+)?(?:gpt|chatbot)|now\s+you(?:'re)?\s+a",
    re.IGNORECASE,
)

_INJECTION_PATTERN_EN_SYSTEM_OVERRIDE = re.compile(
    r"system\s+override|override\s+(?:the\s+)?system", re.IGNORECASE
)

_INJECTION_PATTERN_EN_REVEAL_INSTRUCTIONS = re.compile(
    r"reveal\s+(?:your\s+)?instructions?", re.IGNORECASE
)

_INJECTION_PATTERN_EN_NEW_INSTRUCTION = re.compile(
    r"(?:new|following)\s+instruction", re.IGNORECASE
)

_INJECTION_PATTERN_EN_DAN = re.compile(
    r"(?:dan|dan\s+mode|do\s+anything\s+now)", re.IGNORECASE
)

_INJECTION_PATTERN_EN_JAILBREAK = re.compile(r"jailbreak", re.IGNORECASE)

# Lista de patrones EN
INJECTION_PATTERNS_EN: list[re.Pattern] = [
    _INJECTION_PATTERN_EN_IGNORE,
    _INJECTION_PATTERN_EN_DEVELOPER,
    _INJECTION_PATTERN_EN_SHOW_PROMPT,
    _INJECTION_PATTERN_EN_ACT_AS,
    _INJECTION_PATTERN_EN_FORGET,
    _INJECTION_PATTERN_EN_YOU_ARE,
    _INJECTION_PATTERN_EN_SYSTEM_OVERRIDE,
    _INJECTION_PATTERN_EN_REVEAL_INSTRUCTIONS,
    _INJECTION_PATTERN_EN_NEW_INSTRUCTION,
    _INJECTION_PATTERN_EN_DAN,
    _INJECTION_PATTERN_EN_JAILBREAK,
]


# =============================================================================
# CONFIGURACIÓN
# =============================================================================

logger = logging.getLogger(__name__)

# Máximo de inyecciones que reportamos (para evitar spam)
_MAX_DETECTIONS_BEFORE_LOG = 100
_detection_count = 0


# =============================================================================
# FUNCIONES PÚBLICAS
# =============================================================================


def detect_prompt_injection(text: str | None) -> bool:
    """
    Detecta si el texto contiene patrones de prompt injection.

    Args:
        text: Texto a analizar

    Returns:
        True si detecta prompt injection, False si es limpio
    """
    global _detection_count

    if not text:
        return False

    # Normalizar: strip y lowercase para matching
    normalized = text.strip()
    if not normalized:
        return False

    # Check ES patterns
    for pattern in INJECTION_PATTERNS_ES:
        if pattern.search(normalized):
            _log_detection("ES", pattern.pattern)
            return True

    # Check EN patterns
    for pattern in INJECTION_PATTERNS_EN:
        if pattern.search(normalized):
            _log_detection("EN", pattern.pattern)
            return True

    return False


def sanitize_input(text: str | None) -> str:
    """
    Sanitiza el input removiendo potenciales payloads de injection.

    CURRENT: Remueve code fences y normaliza whitespace.
    FUTURE:  puede agregar más sanitización si se descubre nuevo vectors.

    Args:
        text: Texto a sanitizar

    Returns:
        Texto sanitizado
    """
    if not text:
        return ""

    result = text.strip()

    # Remover code fences (```code```)
    result = re.sub(r"```[\s\S]*?```", "", result)
    result = re.sub(r"``[\s\S]*?``", "", result)
    result = re.sub(r"`[^`]+`", "", result)

    # Normalizar whitespace (múltiples espacios -> uno solo)
    result = re.sub(r"\s+", " ", result)

    # Strip de nuevo
    result = result.strip()

    return result


def get_detected_pattern(text: str | None) -> str | None:
    """
    Retorna el patrón específico que matcheó (para logging).

    Args:
        text: Texto a analizar

    Returns:
        Patrón que matcheó, o None si no hay match
    """
    if not text:
        return None

    normalized = text.strip()

    # Check ES
    for pattern in INJECTION_PATTERNS_ES:
        if pattern.search(normalized):
            return pattern.pattern

    # Check EN
    for pattern in INJECTION_PATTERNS_EN:
        if pattern.search(normalized):
            return pattern.pattern

    return None


# =============================================================================
# HELPERS PRIVADOS
# =============================================================================


def _log_detection(lang: str, pattern: str) -> None:
    """Loguea detección de prompt injection (con rate limiting)."""
    global _detection_count

    _detection_count += 1

    # Solo loguear cada 100 detecciones (para evitar spam)
    if _detection_count % _MAX_DETECTIONS_BEFORE_LOG == 0:
        logger.warning(
            "prompt_injection_rate_limit_reached",
            count=_detection_count,
        )


def reset_detection_count() -> None:
    """Resetea el contador de detecciones (para tests)."""
    global _detection_count
    _detection_count = 0
