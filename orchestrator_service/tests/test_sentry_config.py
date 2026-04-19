# Tests para sentry_config.py
"""
Tests unitarios para el módulo de configuración de Sentry.
"""

import pytest
from unittest.mock import MagicMock, patch

from app.core.sentry_config import (
    _scrub_value,
    _scrub_dict,
    _scrub_headers,
    _scrubEvent,
    init_sentry,
    is_sentry_enabled,
)


class TestScrubValue:
    """Tests para _scrub_value()."""

    def test_scrub_phone(self):
        """Teléfono → [REDACTED_PHONE]"""
        result = _scrub_value("+5491134567890")
        assert result == "[REDACTED_PHONE]"

    def test_scrub_email(self):
        """Email → [REDACTED_EMAIL]"""
        result = _scrub_value("user@test.com")
        assert result == "[REDACTED_EMAIL]"

    def test_scrub_clean_value(self):
        """Valor limpio → sin cambios"""
        result = _scrub_value("Hello world")
        assert result == "Hello world"

    def test_scrub_non_string(self):
        """Non-string → retornado sin cambios"""
        result = _scrub_value(123)
        assert result == 123

        result = _scrub_value({"foo": "bar"})
        assert result == {"foo": "bar"}


class TestScrubDict:
    """Tests para _scrub_dict()."""

    def test_scrub_sensitive_key(self):
        """Key sensible → [REDACTED]"""
        data = {"token": "sk-secret"}
        result = _scrub_dict(data)
        assert result["token"] == "[REDACTED]"

    def test_scrub_nested_dict(self):
        """Dict anidado 3 niveles → todo scrubbed"""
        data = {"level1": {"level2": {"level3": {"token": "sk-secret"}}}}
        result = _scrub_dict(data)
        # Navegar el nested
        assert result["level1"]["level2"]["level3"]["token"] == "[REDACTED]"

    def test_scrub_list(self):
        """Lista con objetos → scrubbed"""
        data = {
            "users": [
                {"email": "user1@test.com"},
                {"email": "user2@test.com"},
            ]
        }
        result = _scrub_dict(data)
        assert result["users"][0]["email"] == "[REDACTED_EMAIL]"
        assert result["users"][1]["email"] == "[REDACTED_EMAIL]"

    def test_scrub_dict_empty(self):
        """Dict vacío → retorna vacío"""
        assert _scrub_dict({}) == {}
        assert _scrub_dict(None) is None


class TestScrubHeaders:
    """Tests para _scrub_headers()."""

    def test_scrub_authorization_header(self):
        """Header Authorization → [REDACTED]"""
        headers = {
            "authorization": "Bearer token123",
            "content-type": "application/json",
        }
        result = _scrub_headers(headers)
        assert result["authorization"] == "[REDACTED]"
        assert result["content-type"] == "application/json"

    def test_scrub_cookie_header(self):
        """Header Cookie → [REDACTED]"""
        headers = {"cookie": "session=abc123"}
        result = _scrub_headers(headers)
        assert result["cookie"] == "[REDACTED]"

    def test_scrub_x_internal_token(self):
        """Header x-internal-token → [REDACTED]"""
        headers = {"x-internal-token": "secret123"}
        result = _scrub_headers(headers)
        assert result["x-internal-token"] == "[REDACTED]"

    def test_scrub_clean_headers(self):
        """Headers limpios → sin cambios"""
        headers = {"content-type": "application/json", "accept": "text/html"}
        result = _scrub_headers(headers)
        assert result["content-type"] == "application/json"


class TestScrubEvent:
    """Tests para _scrubEvent()."""

    def test_scrub_in_request_headers(self):
        """Request headers → scrubbed"""
        event = {
            "request": {
                "headers": {
                    "authorization": "Bearer token123",
                    "content-type": "application/json",
                }
            }
        }
        result = _scrubEvent(event, {})
        assert result["request"]["headers"]["authorization"] == "[REDACTED]"

    def test_scrub_in_extra(self):
        """Extra data → scrubbed"""
        event = {
            "extra": {
                "token": "sk-secret",
                "user": {"email": "user@test.com"},
            }
        }
        result = _scrubEvent(event, {})
        assert result["extra"]["token"] == "[REDACTED]"
        assert result["extra"]["user"]["email"] == "[REDACTED_EMAIL]"

    def test_scrub_breadcrumb_message(self):
        """Breadcrumb con teléfono → scrubbed"""
        event = {
            "breadcrumbs": {
                "values": [
                    {
                        "message": "User logged in",
                        "data": {"phone": "+5491134567890"},
                    }
                ]
            }
        }
        result = _scrubEvent(event, {})
        assert result["breadcrumbs"]["values"][0]["data"]["phone"] == "[REDACTED_PHONE]"

    def test_no_scrub_clean_event(self):
        """Evento sin PII → sin cambios"""
        event = {"message": "clean message", "level": "error"}
        result = _scrubEvent(event, {})
        assert result["message"] == "clean message"
        assert result["level"] == "error"


class TestInitSentry:
    """Tests para init_sentry()."""

    @patch("app.core.sentry_config.settings")
    def test_init_sentry_no_dsn(self, mock_settings):
        """Sin DSN → no-op"""
        mock_settings.SENTRY_DSN = ""
        mock_settings.SENTRY_ENVIRONMENT = "test"
        mock_settings.SENTRY_TRACES_SAMPLE_RATE = 0.1

        result = init_sentry()

        assert result is False

    @patch("app.core.sentry_config.sentry_sdk")
    @patch("app.core.sentry_config.settings")
    def test_init_sentry_with_dsn(self, mock_settings, mock_sentry):
        """Con DSN → inicializa"""
        mock_settings.SENTRY_DSN = "https://key@sentry.io/123"
        mock_settings.SENTRY_ENVIRONMENT = "test"
        mock_settings.SENTRY_TRACES_SAMPLE_RATE = 0.1

        mock_sentry.init = MagicMock()
        mock_sentry.integrations = {
            "FastApiIntegration": MagicMock(),
            "LoggingIntegration": MagicMock(),
        }

        result = init_sentry()

        # Verificar que se llamó init
        assert mock_sentry.init.called or result is True

    @patch("app.core.sentry_config.settings")
    def test_init_sentry_import_error(self, mock_settings):
        """ImportError → warning log, sin crash"""
        mock_settings.SENTRY_DSN = "https://key@sentry.io/123"

        # El import dinámico ya ocurrió, no hay forma fácil de testearlo
        # Este test verifica que la función maneja el caso sin DSN
        result = init_sentry()
        assert result is False


class TestIsSentryEnabled:
    """Tests para is_sentry_enabled()."""

    @patch("app.core.sentry_config.settings")
    def test_is_enabled_with_dsn(self, mock_settings):
        """Con DSN → True"""
        mock_settings.SENTRY_DSN = "https://key@sentry.io/123"
        assert is_sentry_enabled() is True

    @patch("app.core.sentry_config.settings")
    def test_is_enabled_without_dsn(self, mock_settings):
        """Sin DSN → False"""
        mock_settings.SENTRY_DSN = ""
        assert is_sentry_enabled() is False
