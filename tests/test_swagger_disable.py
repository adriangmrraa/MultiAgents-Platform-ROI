"""
Test que verifica que Swagger se deshabilita cuando DEBUG no es true.

Este test valida el comportamiento del Feature S1 (Swagger Conditional Disable)
según la especificación #1092 y el diseño #1093.
"""

import os
import sys
import pytest

# Agregar el path del servicio para imports
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "orchestrator_service")
)


def test_swagger_disabled_by_default(monkeypatch):
    """
    AC-301.1: Con DEBUG= (vacío/no seteado), los endpoints de documentación
    deben estar deshabilitados (docs_url=None, redoc_url=None, openapi_url=None).
    """
    # Asegurar que DEBUG no esté configurado
    monkeypatch.delenv("DEBUG", raising=False)

    # Reiniciar los módulos para que se evalúe nuevamente
    # Como main.py es un módulo con efectos secundarios, usamos importlib para recargar
    if "main" in sys.modules:
        del sys.modules["main"]
    if "orchestrator_service.main" in sys.modules:
        del sys.modules["orchestrator_service.main"]

    # Importar el módulo (esto ejecutará el código de inicialización)
    from orchestrator_service import main

    # Verificar que swagger está deshabilitado
    assert main.app.docs_url is None, f"Expected docs_url=None, got {main.app.docs_url}"
    assert main.app.redoc_url is None, (
        f"Expected redoc_url=None, got {main.app.redoc_url}"
    )
    assert main.app.openapi_url is None, (
        f"Expected openapi_url=None, got {main.app.openapi_url}"
    )


def test_swagger_enabled_with_debug_true(monkeypatch):
    """
    AC-301.3: Con DEBUG=true, los endpoints de documentación deben estar habilitados.
    """
    monkeypatch.setenv("DEBUG", "true")

    # Reiniciar módulos
    if "main" in sys.modules:
        del sys.modules["main"]
    if "orchestrator_service.main" in sys.modules:
        del sys.modules["orchestrator_service.main"]

    # Reimportar
    from orchestrator_service import main

    # Verificar que swagger está habilitado
    assert main.app.docs_url == "/docs", (
        f"Expected docs_url='/docs', got {main.app.docs_url}"
    )
    assert main.app.redoc_url == "/redoc", (
        f"Expected redoc_url='/redoc', got {main.app.redoc_url}"
    )
    assert main.app.openapi_url == "/openapi.json", (
        f"Expected openapi_url='/openapi.json', got {main.app.openapi_url}"
    )


def test_swagger_enabled_with_debug_1(monkeypatch):
    """
    AC-301.4: Con DEBUG=1, los endpoints de documentación deben estar habilitados.
    """
    monkeypatch.setenv("DEBUG", "1")

    # Reiniciar módulos
    if "main" in sys.modules:
        del sys.modules["main"]
    if "orchestrator_service.main" in sys.modules:
        del sys.modules["orchestrator_service.main"]

    # Reimportar
    from orchestrator_service import main

    # Verificar que swagger está habilitado
    assert main.app.docs_url == "/docs", (
        f"Expected docs_url='/docs', got {main.app.docs_url}"
    )


def test_swagger_disabled_with_debug_false(monkeypatch):
    """
    AC-301.2: Con DEBUG=false, los endpoints de documentación deben estar deshabilitados.
    """
    monkeypatch.setenv("DEBUG", "false")

    # Reiniciar módulos
    if "main" in sys.modules:
        del sys.modules["main"]
    if "orchestrator_service.main" in sys.modules:
        del sys.modules["orchestrator_service.main"]

    # Reimportar
    from orchestrator_service import main

    # Verificar que swagger está deshabilitado
    assert main.app.docs_url is None, f"Expected docs_url=None, got {main.app.docs_url}"
    assert main.app.redoc_url is None, (
        f"Expected redoc_url=None, got {main.app.redoc_url}"
    )


def test_swagger_enabled_case_insensitive(monkeypatch):
    """
    E-301.1: DEBUG=True (mixed case) debe habilitar swagger.
    """
    monkeypatch.setenv("DEBUG", "TRUE")

    # Reiniciar módulos
    if "main" in sys.modules:
        del sys.modules["main"]
    if "orchestrator_service.main" in sys.modules:
        del sys.modules["orchestrator_service.main"]

    # Reimportar
    from orchestrator_service import main

    # Verificar que swagger está habilitado
    assert main.app.docs_url == "/docs"


def test_swagger_disabled_with_invalid_value(monkeypatch):
    """
    E-301.2: DEBUG=yes no debe habilitar swagger.
    """
    monkeypatch.setenv("DEBUG", "yes")

    # Reiniciar módulos
    if "main" in sys.modules:
        del sys.modules["main"]
    if "orchestrator_service.main" in sys.modules:
        del sys.modules["orchestrator_service.main"]

    # Reimportar
    from orchestrator_service import main

    # Verificar que swagger está deshabilitado
    assert main.app.docs_url is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
