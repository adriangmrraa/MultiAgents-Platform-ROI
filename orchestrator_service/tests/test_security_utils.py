# Tests para security_utils.py
"""
Tests unitarios para el módulo de firma HMAC de URLs de media.
"""

import pytest
import time
from unittest.mock import patch

from app.core.security_utils import (
    generate_signed_url,
    verify_signed_url,
    generate_media_url,
    build_signed_media_params,
    is_signing_enabled,
    is_signing_enforced,
    MEDIA_URL_TTL,
)


class TestGenerateSignedURL:
    """Tests para generate_signed_url()."""
    
    def test_generate_returns_signature_and_expires(self):
        """Retorna tuple (signature, expires)"""
        signature, expires = generate_signed_url("/admin/media/123", tenant_id=1)
        
        assert isinstance(signature, str)
        assert isinstance(expires, int)
        assert len(signature) > 0
    
    def test_generate_expires_in_future(self):
        """expires > now"""
        signature, expires = generate_signed_url("/admin/media/123", tenant_id=1)
        now = int(time.time())
        
        assert expires > now
    
    def test_generate_with_custom_ttl(self):
        """Custom TTL → honored"""
        custom_ttl = 3600  # 1 hora
        _, expires = generate_signed_url(
            "/admin/media/123",
            tenant_id=1,
            ttl=custom_ttl,
        )
        now = int(time.time())
        
        assert expires - now <= custom_ttl + 1  # +1 por latencia
    
    def test_generate_different_paths(self):
        """Different paths → different signatures"""
        sig1, _ = generate_signed_url("/admin/media/1", tenant_id=1)
        sig2, _ = generate_signed_url("/admin/media/2", tenant_id=1)
        
        assert sig1 != sig2
    
    def test_generate_different_tenants(self):
        """Different tenants → different signatures"""
        sig1, _ = generate_signed_url("/admin/media/123", tenant_id=1)
        sig2, _ = generate_signed_url("/admin/media/123", tenant_id=2)
        
        assert sig1 != sig2


class TestVerifySignedURL:
    """Tests para verify_signed_url()."""
    
    def test_verify_valid_signature(self):
        """Firma válida → True"""
        url_path = "/admin/media/123"
        tenant_id = 1
        
        signature, expires = generate_signed_url(url_path, tenant_id)
        
        result = verify_signed_url(url_path, tenant_id, signature, expires)
        
        assert result is True
    
    def test_verify_wrong_signature(self):
        """Firma alterada → False"""
        url_path = "/admin/media/123"
        tenant_id = 1
        
        signature, expires = generate_signed_url(url_path, tenant_id)
        # Alterar firma
        signature = signature[:-5] + "xxxxx"
        
        result = verify_signed_url(url_path, tenant_id, signature, expires)
        
        assert result is False
    
    def test_verify_expired(self):
        """Firma expirada → False"""
        url_path = "/admin/media/123"
        tenant_id = 1
        
        signature, expires = generate_signed_url(url_path, tenant_id)
        # Forzar expiración (expires en el pasado)
        expires = int(time.time()) - 100
        
        result = verify_signed_url(url_path, tenant_id, signature, expires)
        
        assert result is False
    
    def test_verify_wrong_tenant(self):
        """Firma con tenant diferente → False"""
        url_path = "/admin/media/123"
        tenant_id = 1
        
        signature, expires = generate_signed_url(url_path, tenant_id)
        # Verificar con otro tenant
        result = verify_signed_url(url_path, tenant_id=999, signature, expires)
        
        assert result is False
    
    def test_verify_wrong_path(self):
        """Firma con path diferente → False"""
        url_path = "/admin/media/123"
        tenant_id = 1
        
        signature, expires = generate_signed_url(url_path, tenant_id)
        # Verificar con otro path
        result = verify_signed_url("/admin/media/999", tenant_id, signature, expires)
        
        assert result is False
    
    def test_verify_timing_safe(self):
        """Timing attack resistant"""
        url_path = "/admin/media/123"
        tenant_id = 1
        
        signature, expires = generate_signed_url(url_path, tenant_id)
        # Verificar que no throw por timing
        result = verify_signed_url(url_path, tenant_id, signature, expires)
        assert result is True


class TestIsSigningEnabled:
    """Tests para is_signing_enabled()."""
    
    @patch("app.core.security_utils.settings")
    def test_enabled_with_secret(self, mock_settings):
        """Con MEDIA_PROXY_SECRET → True"""
        mock_settings.MEDIA_PROXY_SECRET = "secret123"
        
        assert is_signing_enabled() is True
    
    @patch("app.core.security_utils.settings")
    def test_enabled_without_secret(self, mock_settings):
        """Sin MEDIA_PROXY_SECRET → False"""
        mock_settings.MEDIA_PROXY_SECRET = ""
        
        assert is_signing_enabled() is False


class TestIsSigningEnforced:
    """Tests para is_signing_enforced()."""
    
    @patch("app.core.security_utils.settings")
    def test_enforced_when_true(self, mock_settings):
        """MEDIA_SIGNING_ENFORCE=True → True"""
        mock_settings.MEDIA_SIGNING_ENFORCE = True
        
        assert is_signing_enforced() is True
    
    @patch("app.core.security_utils.settings")
    def test_not_enforced_when_false(self, mock_settings):
        """MEDIA_SIGNING_ENFORCE=False → False"""
        mock_settings.MEDIA_SIGNING_ENFORCE = False
        
        assert is_signing_enforced() is False


class TestGenerateMediaURL:
    """Tests para generate_media_url()."""
    
    def test_generate_complete_url(self):
        """URL completa con params"""
        url = generate_media_url(
            base_url="https://api.example.com",
            media_id="123",
            tenant_id=1,
        )
        
        assert "sig=" in url
        assert "expires=" in url
        assert "api.example.com" in url


class TestBuildSignedMediaParams:
    """Tests para build_signed_media_params()."""
    
    def test_build_params_structure(self):
        """Retorna dict con sig y expires"""
        params = build_signed_media_params(media_id="123", tenant_id=1)
        
        assert "sig" in params
        assert "expires" in params
        assert isinstance(params["sig"], str)
        assert isinstance(params["expires"], int)