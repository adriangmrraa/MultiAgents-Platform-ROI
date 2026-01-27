-- ============================================
-- MIGRACIÓN: Arquitectura de Credenciales v2
-- Fecha: 2026-01-27
-- Objetivo: Eliminar dependencia del nombre de credencial ingresado por el usuario
-- ============================================

-- ============================================
-- PASO 1: Crear Tabla de Proveedores OAuth
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PASO 2: Crear Tabla de Tipos de Credenciales
-- ============================================
CREATE TABLE IF NOT EXISTS credential_types (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES oauth_providers(id),
    internal_key VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    description TEXT,
    is_required BOOLEAN DEFAULT false,
    field_type VARCHAR(20) DEFAULT 'text',
    placeholder TEXT,
    validation_regex TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PASO 3: Seed de Proveedores
-- ============================================
INSERT INTO oauth_providers (id, name, display_name) VALUES
(1, 'openai', 'OpenAI'),
(2, 'chatwoot', 'Chatwoot'),
(3, 'meta', 'Meta (Facebook/Instagram/WhatsApp)'),
(4, 'ycloud', 'YCloud'),
(5, 'tiendanube', 'Tienda Nube')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PASO 4: Seed de Tipos de Credenciales
-- ============================================

-- OpenAI
INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
(1, 'OPENAI_API_KEY', 'OpenAI API Key', 'Clave de API para acceder a modelos GPT (gpt-4o, gpt-4o-mini)', true, 'password', 'sk-proj-...')
ON CONFLICT (internal_key) DO NOTHING;

-- Chatwoot
INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
(2, 'CHATWOOT_API_TOKEN', 'Chatwoot API Token', 'Token de acceso personal de Chatwoot', true, 'password', 'Obtén esto en Chatwoot > Profile Settings > Access Token'),
(2, 'CHATWOOT_BASE_URL', 'Chatwoot Base URL', 'URL de tu instancia de Chatwoot', true, 'text', 'https://app.chatwoot.com'),
(2, 'CHATWOOT_ACCOUNT_ID', 'Chatwoot Account ID', 'ID de tu cuenta en Chatwoot (número)', true, 'text', '12345'),
(2, 'CHATWOOT_BOT_TOKEN', 'Chatwoot Bot Token', 'Token del bot de Chatwoot (opcional)', false, 'password', '')
ON CONFLICT (internal_key) DO NOTHING;

-- Meta
INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
(3, 'META_USER_ACCESS_TOKEN', 'Meta User Access Token', 'Token de usuario de larga duración (60 días)', true, 'password', 'Obtenido automáticamente vía OAuth'),
(3, 'META_PAGE_ACCESS_TOKEN', 'Meta Page Access Token', 'Token de página de Facebook', false, 'password', ''),
(3, 'META_INSTAGRAM_TOKEN', 'Meta Instagram Token', 'Token de Instagram Business', false, 'password', ''),
(3, 'META_WHATSAPP_TOKEN', 'Meta WhatsApp Token', 'Token de WhatsApp Business', false, 'password', ''),
(3, 'META_APP_ID', 'Meta App ID', 'ID de tu aplicación de Meta', false, 'text', '123456789'),
(3, 'META_APP_SECRET', 'Meta App Secret', 'Secreto de tu aplicación de Meta', false, 'password', '')
ON CONFLICT (internal_key) DO NOTHING;

-- YCloud
INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
(4, 'YCLOUD_API_KEY', 'YCloud API Key', 'Clave de API para YCloud (WhatsApp)', false, 'password', '')
ON CONFLICT (internal_key) DO NOTHING;

-- Tienda Nube
INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
(5, 'TIENDANUBE_STORE_ID', 'Tienda Nube Store ID', 'ID de tu tienda en Tienda Nube', false, 'text', '123456'),
(5, 'TIENDANUBE_ACCESS_TOKEN', 'Tienda Nube Access Token', 'Token de acceso de Tienda Nube', false, 'password', '')
ON CONFLICT (internal_key) DO NOTHING;

-- ============================================
-- PASO 5: Modificar Tabla credentials (si no existe la columna)
-- ============================================

-- Verificar si credential_type_id ya existe (el error indica que SÍ existe)
-- Solo agregar user_label si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credentials' AND column_name = 'user_label'
    ) THEN
        ALTER TABLE credentials ADD COLUMN user_label VARCHAR(255);
    END IF;
END $$;

-- Agregar columnas adicionales si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credentials' AND column_name = 'is_valid'
    ) THEN
        ALTER TABLE credentials ADD COLUMN is_valid BOOLEAN DEFAULT true;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credentials' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE credentials ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credentials' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE credentials ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- ============================================
-- PASO 6: Migrar Datos Existentes
-- ============================================

-- OpenAI: Mapear todas las credenciales que contengan "OPENAI" o "OPEN AI" en el nombre
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'OPENAI_API_KEY')
WHERE credential_type_id IS NULL 
  AND (
      UPPER(name) LIKE '%OPENAI%' 
      OR UPPER(name) LIKE '%OPEN AI%' 
      OR category = 'openai'
  );

-- Chatwoot API Token
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'CHATWOOT_API_TOKEN')
WHERE credential_type_id IS NULL 
  AND name = 'CHATWOOT_API_TOKEN';

-- Chatwoot Base URL
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'CHATWOOT_BASE_URL')
WHERE credential_type_id IS NULL 
  AND name = 'CHATWOOT_BASE_URL';

-- Chatwoot Account ID
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'CHATWOOT_ACCOUNT_ID')
WHERE credential_type_id IS NULL 
  AND name = 'CHATWOOT_ACCOUNT_ID';

-- Chatwoot Bot Token
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'CHATWOOT_BOT_TOKEN')
WHERE credential_type_id IS NULL 
  AND name = 'CHATWOOT_BOT_TOKEN';

-- YCloud
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'YCLOUD_API_KEY')
WHERE credential_type_id IS NULL 
  AND (UPPER(name) LIKE '%YCLOUD%' OR category = 'ycloud');

-- Tienda Nube
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'TIENDANUBE_STORE_ID')
WHERE credential_type_id IS NULL 
  AND name = 'TIENDANUBE_STORE_ID';

UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'TIENDANUBE_ACCESS_TOKEN')
WHERE credential_type_id IS NULL 
  AND name = 'TIENDANUBE_ACCESS_TOKEN';

-- Meta (si existen)
UPDATE credentials 
SET credential_type_id = (SELECT id FROM credential_types WHERE internal_key = 'META_USER_ACCESS_TOKEN')
WHERE credential_type_id IS NULL 
  AND (UPPER(name) LIKE '%META%' OR category = 'meta');

-- ============================================
-- PASO 7: Copiar nombre original a user_label
-- ============================================
UPDATE credentials 
SET user_label = name 
WHERE user_label IS NULL;

-- ============================================
-- PASO 8: Crear Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(credential_type_id);
CREATE INDEX IF NOT EXISTS idx_credentials_valid ON credentials(is_valid);
CREATE INDEX IF NOT EXISTS idx_credentials_tenant_type ON credentials(tenant_id, credential_type_id);

-- ============================================
-- PASO 9: Verificación Post-Migración
-- ============================================

-- Ver credenciales migradas
SELECT 
    c.id,
    c.tenant_id,
    ct.internal_key,
    ct.display_name,
    c.user_label,
    c.name AS old_name,
    c.category,
    c.is_valid
FROM credentials c
LEFT JOIN credential_types ct ON c.credential_type_id = ct.id
ORDER BY c.tenant_id, ct.internal_key;

-- Ver credenciales SIN tipo asignado (requieren atención manual)
SELECT 
    id,
    tenant_id,
    name,
    category,
    scope
FROM credentials
WHERE credential_type_id IS NULL;

-- ============================================
-- PASO 10: (OPCIONAL) Hacer credential_type_id NOT NULL
-- ============================================
-- SOLO ejecutar esto DESPUÉS de verificar que todas las credenciales tienen tipo asignado
-- ALTER TABLE credentials ALTER COLUMN credential_type_id SET NOT NULL;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================
