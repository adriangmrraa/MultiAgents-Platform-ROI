# Análisis y Propuesta: Arquitectura Robusta de Credenciales
**Fecha**: 2026-01-27 02:10 AM (UTC-3)  
**Basado en**: Spec `2026-01-27_agent-channel-connection.spec.md` + Diagnostic Report + Deep Research  
**Objetivo**: Eliminar dependencia del nombre de credencial ingresado por el usuario

---

## 🔴 Problema Crítico Identificado

### Issue Actual: Dependencia del Nombre de Usuario
**Situación**: El sistema actual depende del valor que el usuario escribe en el campo "Nombre" al crear una credencial en el Dashboard.

**Ejemplo del problema**:
- Usuario crea credencial con nombre: `OPEN AI CODEXY PRUEBAS`
- Código busca: `OPENAI_API_KEY`
- **Resultado**: Credencial no encontrada → Motor de IA falla silenciosamente

**Por qué es insólito**:
- El usuario final NO sabe que debe escribir exactamente `OPENAI_API_KEY`
- Es un detalle técnico de implementación que NO debería ser visible
- Viola el principio de "Separation of Concerns" (UI vs Backend)

---

## 📊 Análisis de Documentos

### 1. Spec `2026-01-27_agent-channel-connection.spec.md`

**Hallazgos**:
- Define `OPENAI_API_KEY` como credencial crítica (línea 105)
- Asume que el nombre es estándar y conocido por el código
- No contempla variaciones de nombre ingresadas por el usuario

**Cita relevante** (Sección 3, Regla 3):
```
SI tenant NO tiene OPENAI_API_KEY
ENTONCES loggear error "Credencial OpenAI faltante para tenant {tenant_id}"
```

### 2. Diagnostic Report `DIAGNOSTIC_REPORT_2026-01-27.md`

**Hallazgos**:
- Identifica que la credencial se llama `OPEN AI CODEXY PRUEBAS` en lugar de `OPENAI_API_KEY`
- Confirma que el código busca el nombre exacto `OPENAI_API_KEY`
- Propone renombrar manualmente la credencial (solución temporal)

**Causa raíz confirmada** (Sección 9, Causa #1):
> "La credencial se llama `OPEN AI CODEXY PRUEBAS` en lugar de `OPENAI_API_KEY`. El código busca específicamente `OPENAI_API_KEY` en `main.py` y `admin_routes.py`"

---

## 🔬 Deep Research: Best Practices OAuth2 & Multi-Tenant

### Hallazgos de la Investigación

#### 1. Esquema de Credenciales Recomendado (Meta OAuth2)

**Fuente**: Stack Overflow + Meta Developer Docs + Medium (OAuth2 Best Practices 2024)

**Tablas recomendadas**:
1. **`oauth_providers`**: Define los proveedores (Meta, Google, etc.)
2. **`oauth_connections`**: Almacena tokens por tenant
3. **`credential_types`**: Catálogo de tipos de credenciales

**Esquema propuesto**:
```sql
-- Tabla de proveedores OAuth (catálogo global)
CREATE TABLE oauth_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,  -- 'meta', 'google', 'openai'
    display_name VARCHAR(100),          -- 'Meta (Facebook/Instagram)'
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de tipos de credenciales (catálogo global)
CREATE TABLE credential_types (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES oauth_providers(id),
    internal_key VARCHAR(100) UNIQUE NOT NULL,  -- 'OPENAI_API_KEY', 'META_ACCESS_TOKEN'
    display_name VARCHAR(100),                   -- 'OpenAI API Key', 'Meta Access Token'
    description TEXT,
    is_required BOOLEAN DEFAULT false,
    field_type VARCHAR(20) DEFAULT 'text',      -- 'text', 'textarea', 'password'
    placeholder TEXT,
    validation_regex TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de credenciales (datos por tenant)
CREATE TABLE credentials (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    credential_type_id INTEGER REFERENCES credential_types(id),  -- FK al tipo
    user_label VARCHAR(255),                    -- Nombre que el usuario le pone (opcional)
    value TEXT NOT NULL,                        -- Valor encriptado
    scope VARCHAR(50) DEFAULT 'tenant',         -- 'tenant', 'global'
    expires_at TIMESTAMPTZ,                     -- Para tokens OAuth
    is_valid BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,         -- Scopes, permisos, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, credential_type_id, scope)  -- Un tipo por tenant/scope
);

-- Índices
CREATE INDEX idx_credentials_tenant ON credentials(tenant_id);
CREATE INDEX idx_credentials_type ON credentials(credential_type_id);
CREATE INDEX idx_credentials_valid ON credentials(is_valid);
```

#### 2. Meta OAuth: Columnas Específicas

**Fuente**: Facebook Graph API Documentation

Para almacenar tokens de Meta correctamente:
```sql
-- Tabla específica para conexiones Meta (opcional, si necesitas más detalle)
CREATE TABLE meta_connections (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    credential_id INTEGER REFERENCES credentials(id),  -- FK a la credencial principal
    
    -- User Token (Long-Lived, 60 días)
    user_access_token TEXT,                    -- Encriptado
    user_token_expires_at TIMESTAMPTZ,
    
    -- Page Tokens (pueden ser múltiples)
    page_tokens JSONB DEFAULT '[]'::jsonb,     -- [{"page_id": "123", "token": "...", "expires_at": "..."}]
    
    -- Instagram Business Account
    instagram_business_account_id VARCHAR(100),
    instagram_access_token TEXT,               -- Encriptado
    
    -- WhatsApp Business Account (WABA)
    whatsapp_business_account_id VARCHAR(100),
    whatsapp_phone_number_id VARCHAR(100),
    whatsapp_access_token TEXT,                -- Encriptado
    
    -- Metadata
    facebook_user_id VARCHAR(100),
    scopes TEXT[],                             -- ['pages_show_list', 'instagram_basic', ...]
    last_refreshed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)  -- Un tenant = una conexión Meta
);
```

#### 3. Principios de Seguridad (2024)

**Fuentes**: Medium + Security Boulevard + Stack Exchange

1. **Encryption at Rest**: Todos los tokens deben estar encriptados en la DB
2. **Short-Lived Access + Refresh Tokens**: Tokens de acceso cortos (60 min), refresh tokens largos (60 días)
3. **Token Revocation**: Invalidar inmediatamente en logout, cambio de contraseña, o desautorización
4. **Secure Transmission**: HTTPS/TLS siempre
5. **Least Privilege**: Solo los scopes necesarios
6. **Server-Side Management**: Intercambio de tokens SOLO en backend
7. **Monitoring**: Logs de uso anómalo de tokens

---

## 💡 Solución Propuesta: Arquitectura de 3 Capas

### Capa 1: Catálogo de Tipos (Global, Inmutable)

**Tabla**: `credential_types`

**Propósito**: Define TODOS los tipos de credenciales que el sistema soporta.

**Datos de seed** (insertar al inicializar la DB):
```sql
INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder) VALUES
-- OpenAI
(1, 'OPENAI_API_KEY', 'OpenAI API Key', 'Clave de API para acceder a modelos GPT', true, 'password', 'sk-proj-...'),

-- Chatwoot
(2, 'CHATWOOT_API_TOKEN', 'Chatwoot API Token', 'Token de acceso personal de Chatwoot', true, 'password', 'Obtén esto en Chatwoot > Profile Settings'),
(2, 'CHATWOOT_BASE_URL', 'Chatwoot Base URL', 'URL de tu instancia de Chatwoot', true, 'text', 'https://app.chatwoot.com'),
(2, 'CHATWOOT_ACCOUNT_ID', 'Chatwoot Account ID', 'ID de tu cuenta en Chatwoot', true, 'text', '12345'),
(2, 'CHATWOOT_BOT_TOKEN', 'Chatwoot Bot Token', 'Token del bot (opcional)', false, 'password', ''),

-- Meta
(3, 'META_USER_ACCESS_TOKEN', 'Meta User Access Token', 'Token de usuario de larga duración (60 días)', true, 'password', ''),
(3, 'META_PAGE_ACCESS_TOKEN', 'Meta Page Access Token', 'Token de página de Facebook', false, 'password', ''),
(3, 'META_INSTAGRAM_TOKEN', 'Meta Instagram Token', 'Token de Instagram Business', false, 'password', ''),
(3, 'META_WHATSAPP_TOKEN', 'Meta WhatsApp Token', 'Token de WhatsApp Business', false, 'password', ''),

-- YCloud
(4, 'YCLOUD_API_KEY', 'YCloud API Key', 'Clave de API para YCloud (WhatsApp)', false, 'password', '');
```

### Capa 2: Credenciales del Tenant (Datos)

**Tabla**: `credentials`

**Cambio clave**: Agregar `credential_type_id` (FK a `credential_types`)

**Migración**:
```sql
-- 1. Agregar nueva columna
ALTER TABLE credentials 
ADD COLUMN IF NOT EXISTS credential_type_id INTEGER REFERENCES credential_types(id);

-- 2. Agregar columna para label del usuario
ALTER TABLE credentials 
ADD COLUMN IF NOT EXISTS user_label VARCHAR(255);

-- 3. Migrar datos existentes (mapear 'name' a 'credential_type_id')
UPDATE credentials 
SET credential_type_id = (
    SELECT id FROM credential_types WHERE internal_key = 'OPENAI_API_KEY'
)
WHERE name LIKE '%OPENAI%' OR name LIKE '%OPEN AI%' OR category = 'openai';

UPDATE credentials 
SET credential_type_id = (
    SELECT id FROM credential_types WHERE internal_key = 'CHATWOOT_API_TOKEN'
)
WHERE name = 'CHATWOOT_API_TOKEN';

-- (Repetir para cada tipo de credencial)

-- 4. Copiar el nombre original a user_label
UPDATE credentials SET user_label = name WHERE user_label IS NULL;

-- 5. Hacer NOT NULL después de migrar
ALTER TABLE credentials ALTER COLUMN credential_type_id SET NOT NULL;

-- 6. Eliminar columna 'name' (ya no se usa)
-- ALTER TABLE credentials DROP COLUMN name;  -- Opcional, mantenerla por compatibilidad
```

### Capa 3: Código de Acceso (Backend)

**Cambio en `app/core/credentials.py`**:

**ANTES** (frágil):
```python
async def get_tenant_credential(tenant_id: int, category: str, name: str) -> Optional[str]:
    query = """
        SELECT value FROM credentials 
        WHERE tenant_id = $1 AND category = $2 AND name = $3
        LIMIT 1
    """
    encrypted_value = await db.pool.fetchval(query, tenant_id, category, name)
    # ...
```

**DESPUÉS** (robusto):
```python
async def get_tenant_credential_by_type(tenant_id: int, internal_key: str) -> Optional[str]:
    """
    Obtiene una credencial por su internal_key (ej: 'OPENAI_API_KEY').
    El nombre que el usuario le puso (user_label) es irrelevante.
    """
    query = """
        SELECT c.value 
        FROM credentials c
        JOIN credential_types ct ON c.credential_type_id = ct.id
        WHERE c.tenant_id = $1 
          AND ct.internal_key = $2
          AND c.is_valid = true
        ORDER BY c.created_at DESC
        LIMIT 1
    """
    encrypted_value = await db.pool.fetchval(query, tenant_id, internal_key)
    
    if not encrypted_value:
        return None
    
    from utils import decrypt_password
    return decrypt_password(encrypted_value)
```

**Uso en el código**:
```python
# ANTES (frágil)
openai_key = await get_tenant_credential(tenant_id, "openai", "OPENAI_API_KEY")

# DESPUÉS (robusto)
openai_key = await get_tenant_credential_by_type(tenant_id, "OPENAI_API_KEY")
```

---

## 🎨 Cambios en el Frontend

### Dashboard: Crear Credencial

**ANTES** (confuso para el usuario):
```tsx
<input 
    type="text" 
    placeholder="Nombre de la credencial" 
    // Usuario escribe: "OPEN AI CODEXY PRUEBAS" ❌
/>
```

**DESPUÉS** (intuitivo):
```tsx
// 1. Selector de tipo (dropdown)
<select onChange={(e) => setSelectedType(e.target.value)}>
    <option value="">Selecciona el tipo de credencial</option>
    {credentialTypes.map(type => (
        <option key={type.id} value={type.id}>
            {type.display_name} {type.is_required && '(Requerido)'}
        </option>
    ))}
</select>

// 2. Label opcional (solo para organización del usuario)
<input 
    type="text" 
    placeholder="Etiqueta (opcional, ej: 'Mi API Key de Pruebas')" 
    value={userLabel}
    onChange={(e) => setUserLabel(e.target.value)}
/>

// 3. Valor de la credencial
<input 
    type={selectedType?.field_type === 'password' ? 'password' : 'text'}
    placeholder={selectedType?.placeholder}
    value={value}
    onChange={(e) => setValue(e.target.value)}
/>
```

**Payload al backend**:
```json
{
    "credential_type_id": 1,  // ID del tipo (ej: OPENAI_API_KEY)
    "user_label": "Mi API Key de Pruebas",  // Opcional
    "value": "sk-proj-abc123...",
    "scope": "tenant"
}
```

---

## 📋 Plan de Migración Completo

### Paso 1: Crear Tablas de Catálogo

```sql
-- Ejecutar en PostgreSQL
CREATE TABLE oauth_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE credential_types (
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

-- Seed de proveedores
INSERT INTO oauth_providers (name, display_name) VALUES
('openai', 'OpenAI'),
('chatwoot', 'Chatwoot'),
('meta', 'Meta (Facebook/Instagram/WhatsApp)'),
('ycloud', 'YCloud'),
('tiendanube', 'Tienda Nube');

-- Seed de tipos de credenciales (ver sección anterior)
```

### Paso 2: Migrar Tabla `credentials`

```sql
-- Agregar nuevas columnas
ALTER TABLE credentials 
ADD COLUMN IF NOT EXISTS credential_type_id INTEGER REFERENCES credential_types(id),
ADD COLUMN IF NOT EXISTS user_label VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Migrar datos existentes
UPDATE credentials c
SET credential_type_id = ct.id
FROM credential_types ct
WHERE ct.internal_key = 'OPENAI_API_KEY'
  AND (c.name LIKE '%OPENAI%' OR c.name LIKE '%OPEN AI%' OR c.category = 'openai');

UPDATE credentials c
SET credential_type_id = ct.id
FROM credential_types ct
WHERE ct.internal_key = 'CHATWOOT_API_TOKEN'
  AND c.name = 'CHATWOOT_API_TOKEN';

UPDATE credentials c
SET credential_type_id = ct.id
FROM credential_types ct
WHERE ct.internal_key = 'CHATWOOT_BASE_URL'
  AND c.name = 'CHATWOOT_BASE_URL';

UPDATE credentials c
SET credential_type_id = ct.id
FROM credential_types ct
WHERE ct.internal_key = 'CHATWOOT_ACCOUNT_ID'
  AND c.name = 'CHATWOOT_ACCOUNT_ID';

-- Copiar nombre original a user_label
UPDATE credentials SET user_label = name WHERE user_label IS NULL;

-- Hacer NOT NULL
ALTER TABLE credentials ALTER COLUMN credential_type_id SET NOT NULL;

-- Crear índices
CREATE INDEX idx_credentials_type ON credentials(credential_type_id);
CREATE INDEX idx_credentials_valid ON credentials(is_valid);
```

### Paso 3: Actualizar Backend

**Archivo**: `app/core/credentials.py`

Agregar nueva función:
```python
async def get_tenant_credential_by_type(tenant_id: int, internal_key: str) -> Optional[str]:
    # (Ver código en sección anterior)
```

**Archivo**: `orchestrator_service/main.py`

Reemplazar todas las llamadas:
```python
# ANTES
openai_key = await get_tenant_credential(t_id, "openai", "OPENAI_API_KEY")

# DESPUÉS
openai_key = await get_tenant_credential_by_type(t_id, "OPENAI_API_KEY")
```

### Paso 4: Actualizar Frontend

**Archivo**: `frontend_react/src/views/Settings.tsx`

1. Agregar endpoint para obtener tipos de credenciales:
   ```typescript
   const { data: credentialTypes } = useQuery('/admin/credential-types');
   ```

2. Cambiar formulario de creación (ver sección "Cambios en el Frontend")

### Paso 5: Crear Endpoint de Tipos

**Archivo**: `orchestrator_service/admin_routes.py`

```python
@router.get("/credential-types", dependencies=[Depends(verify_admin_token)])
async def get_credential_types():
    """
    Retorna el catálogo de tipos de credenciales disponibles.
    """
    query = """
        SELECT 
            ct.id,
            ct.internal_key,
            ct.display_name,
            ct.description,
            ct.is_required,
            ct.field_type,
            ct.placeholder,
            op.name AS provider_name,
            op.display_name AS provider_display_name
        FROM credential_types ct
        LEFT JOIN oauth_providers op ON ct.provider_id = op.id
        ORDER BY op.name, ct.display_name
    """
    rows = await db.pool.fetch(query)
    return [dict(row) for row in rows]
```

---

## ✅ Beneficios de la Nueva Arquitectura

1. **Robustez**: El código NUNCA depende del input del usuario
2. **UX Mejorada**: El usuario selecciona de un dropdown en lugar de escribir
3. **Validación**: Se puede validar que existan las credenciales requeridas
4. **Escalabilidad**: Agregar nuevos tipos de credenciales es trivial (solo INSERT en `credential_types`)
5. **Auditoría**: Se puede rastrear qué tipos de credenciales tiene cada tenant
6. **Migración Suave**: La columna `name` puede mantenerse por compatibilidad

---

## 🔄 Compatibilidad Retroactiva

Para no romper código existente durante la transición:

```python
async def get_tenant_credential(tenant_id: int, category: str, name: str) -> Optional[str]:
    """
    DEPRECATED: Usar get_tenant_credential_by_type() en su lugar.
    Mantenido por compatibilidad retroactiva.
    """
    # Intentar por internal_key primero
    value = await get_tenant_credential_by_type(tenant_id, name)
    if value:
        return value
    
    # Fallback al método antiguo
    query = """
        SELECT value FROM credentials 
        WHERE tenant_id = $1 AND category = $2 AND name = $3
        LIMIT 1
    """
    encrypted_value = await db.pool.fetchval(query, tenant_id, category, name)
    # ...
```

---

## 📊 Comparación: Antes vs Después

| Aspecto | ANTES (Frágil) | DESPUÉS (Robusto) |
|---------|----------------|-------------------|
| **Nombre de credencial** | Usuario escribe texto libre | Usuario selecciona de catálogo |
| **Búsqueda en código** | `WHERE name = 'OPENAI_API_KEY'` | `WHERE internal_key = 'OPENAI_API_KEY'` |
| **Validación** | Ninguna | Tipo debe existir en catálogo |
| **Error si mal escrito** | Credencial no encontrada (silencioso) | Imposible (dropdown) |
| **Agregar nuevo tipo** | Documentar en wiki | INSERT en `credential_types` |
| **Label personalizado** | No soportado | `user_label` opcional |

---

## 🎯 Próximos Pasos Recomendados

1. **Inmediato** (Hoy):
   - Ejecutar migración de esquema (Paso 1 y 2)
   - Actualizar función `get_tenant_credential_by_type` (Paso 3)
   - Probar con credencial OpenAI existente

2. **Corto Plazo** (Esta Semana):
   - Actualizar frontend con dropdown de tipos (Paso 4 y 5)
   - Migrar todas las llamadas a `get_tenant_credential_by_type`
   - Crear tests automatizados

3. **Medio Plazo** (Este Mes):
   - Implementar tabla `meta_connections` para Meta OAuth
   - Agregar validación de regex en frontend
   - Documentar nuevos tipos de credenciales

---

**Última actualización**: 2026-01-27 02:10 AM (UTC-3)  
**Autor**: Antigravity (Deep Research + Spec Architect)  
**Prioridad**: 🔴 CRÍTICA  
**Impacto**: Elimina dependencia frágil del input del usuario
