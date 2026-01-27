-- ============================================
-- MIGRACIÓN ADICIONAL: Tipos Faltantes
-- Fecha: 2026-01-27
-- Objetivo: Agregar GOOGLE_API_KEY y META_WHATSAPP_BUSINESS_ACCOUNT_ID
-- ============================================

-- Google AI (Gemini)
INSERT INTO oauth_providers (id, name, display_name) VALUES
(6, 'google', 'Google AI (Gemini)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
(6, 'GOOGLE_API_KEY', 'Google AI API Key', 'Clave de API para Google Gemini (gemini-pro, gemini-1.5-flash)', false, 'password', 'AIza...')
ON CONFLICT (internal_key) DO NOTHING;

-- Meta WhatsApp Business Account ID
INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
(3, 'META_WHATSAPP_BUSINESS_ACCOUNT_ID', 'Meta WhatsApp Business Account ID', 'ID de la cuenta de WhatsApp Business (WABA ID)', false, 'text', '123456789')
ON CONFLICT (internal_key) DO NOTHING;

-- Migrar credenciales existentes de Google
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'GOOGLE_API_KEY')
WHERE credential_type_id IS NULL 
  AND (UPPER(name) LIKE '%GOOGLE%' OR UPPER(name) LIKE '%GEMINI%' OR category = 'google');

-- Verificación
SELECT 
    ct.internal_key,
    ct.display_name,
    COUNT(c.id) AS credential_count
FROM credential_types ct
LEFT JOIN credentials c ON c.credential_type_id = ct.id
GROUP BY ct.id, ct.internal_key, ct.display_name
ORDER BY ct.internal_key;
