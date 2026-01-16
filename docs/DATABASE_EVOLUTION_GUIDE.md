# 🧬 Database Evolution Guide (Nexus v5.1 - Sovereign Saga)

Este documento define la **Filosofía de Gestión de Datos** para la plataforma. En Nexus v5.1, la base de datos no solo es la fuente de verdad, sino también el **Búnker de Soberanía**.

---

## 1. Filosofía de Evolución "Self-Healing"

Protocol Omega elimina la necesidad de archivos de migración manuales externos. El sistema implementa un **Mecanismo de Auto-Reparación** en tiempo de arranque que garantiza que el esquema sea siempre el esperado.

### Ciclo de Vida del Arranque (Main.py)
Cada vez que el orquestador inicia:
1.  **Auditoría de Tablas**: Verifica la existencia de `tenants`, `tools`, `business_assets` y `credentials`.
2.  **Reparación de Columnas**: Si falta algún campo crítico (ej. `category` en credentials), el sistema lo inyecta automáticamente.
3.  **Sedimentación de Datos**: Migra variables de entorno a la tabla `credentials` si es la primera ejecución.

---

## 2. El Búnker de Credenciales (Estructura Soberana)

La tabla `credentials` es el corazón de la v5.1. Implementa **Unicidad Multi-Tenant** y soporte para UUIDs.

**Esquema de Credenciales (v5.1)**:
```sql
CREATE TABLE IF NOT EXISTS credentials (
    id_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id SERIAL, -- Legacy support
    name TEXT NOT NULL,
    value TEXT NOT NULL, -- encrypted AES-256
    category TEXT DEFAULT 'general', -- openai, google, smtp, etc.
    scope TEXT DEFAULT 'global', -- global o tenant
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Protocolo de Unicidad Omega
Para manejar la concurrencia multi-tenant, aplicamos restricciones quirúrgicas:
- **Tenant Unique**: `UNIQUE (name, tenant_id)` permite que el Inquilino A y el B tengan claves llamadas "API Key" sin conflictos.
- **Global Unique**: Se utiliza un **Índice Parcial** que garantiza que los nombres globales sean únicos solo donde `tenant_id IS NULL`.

---

## 3. Definiciones de Tablas Core (SSOT)

### `business_assets` (Protocol Omega)
El almacén persistente de toda la inteligencia de negocio generada.
```sql
CREATE TABLE IF NOT EXISTS business_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL, -- Phone or Store ID
    asset_type VARCHAR(50) NOT NULL, -- branding, scripts, visuals, roi
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE
);
```

### `chat_conversations` (Omnichannel UUID)
```sql
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    channel VARCHAR(32) NOT NULL, 
    channel_source VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
    display_name VARCHAR(255),
    meta JSONB DEFAULT '{}', -- Extended Context
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `agents` (Configuración de IA)
```sql
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    name TEXT NOT NULL,
    role TEXT DEFAULT 'sales',
    model_provider TEXT DEFAULT 'openai',
    model_version TEXT DEFAULT 'gpt-4o',
    temperature FLOAT DEFAULT 0.3,
    system_prompt_template TEXT NOT NULL,
    enabled_tools JSONB DEFAULT '[]',
    channels JSONB DEFAULT '["whatsapp", "instagram", "facebook"]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `tools` (Armería Táctica)
```sql
CREATE TABLE IF NOT EXISTS tools (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id), -- NULL for Global
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL, -- http, internal
    description TEXT,
    prompt_injection TEXT, -- Tactical instructions
    response_guide TEXT,   -- Extraction protocol
    config JSONB DEFAULT '{}',
    service_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, name)
);
```

---

## 4. Identificadores y Migración

### UUID vs Integers
- **Nuevas Tablas Estratégicas**: Deben usar `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` para escalabilidad global.
- **Agentes & Herramientas**: Se utiliza `SERIAL` (Integer) para garantizar la compatibilidad con secuencias heredadas.

### Guía de Migración Sagrada
1.  **Modelo SQLAlchemy**: Edita el archivo en `app/models/`.
2.  **Migración Proactiva**: Agrega el bloque SQL en `migration_steps` dentro de `main.py` usando `DO $$ BEGIN ... END $$;`.
3.  **Default Values**: Asegura que las nuevas columnas tengan `DEFAULT` o sean `NULLABLE`.
4.  **Reinicio**: Inicia el orquestador y verifica los logs de `[ALCHEMIST] Schema repair completed`.

---

## 5. Troubleshooting y Seguridad

### Error: `Relation "X" does not exist`
*   **Causa**: El modelo no se importó en `main.py` antes de `Base.metadata.create_all`.
*   **Solución**: Agrega `from app.models import X` en las importaciones de `main.py`.

### Reset Industrial (Uso en Desarrollo/Despliegue)
Si necesitas limpiar la plataforma por completo para iniciar un nuevo despliegue desde cero:
```sql
TRUNCATE TABLE 
    users, tenants, credentials, agents, tools, business_assets, 
    chat_conversations, chat_messages, chat_media, customers, system_events 
RESTART IDENTITY CASCADE;
```
*Este comando borra todos los datos y resetea los IDs a 1.*

### Soberanía
Las credenciales de la tienda se destruyen permanentemente al eliminar el tenant.

---

**© 2026 Platform AI Solutions - Sovereign Data Engineering**
