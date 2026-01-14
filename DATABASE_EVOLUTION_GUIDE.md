# 🧬 Database Evolution Guide (Nexus v5.0 - Protocol Omega)

Este documento define la **Filosofía de Gestión de Datos** para la plataforma. En Nexus v5, la base de datos es la **Única Fuente de Verdad (SSOT)**.

---

## 1. Filosofía "Schema Drift Prevention"

El "Schema Drift" ocurre cuando el código espera una columna que la base de datos no tiene. Protocol Omega resuelve esto con una estrategia de **Auto-Reparación en Tiempo de Arranque**.

### El Ciclo de Vida del Arranque (Main.py)
Cada vez que el orquestador inicia:
1.  **Import**: Carga todos los modelos de `app/models/__init__.py`.
2.  **Inspect**: Verifica si existen las tablas críticas (`tenants`, `tools`, `business_assets`).
3.  **Repair (Migration Steps)**:
    *   Si falta la columna `customer_id` en `chat_conversations` -> La crea.
    *   Si falta la tabla `business_assets` -> La crea con PK UUID.

---

## 2. Guía de Migración Sagrada (Los 4 Pasos)

Si necesitas agregar un nuevo campo a la base de datos, **NO crees un archivo .sql manual**. Sigue este protocolo:

### Paso 1: Actualizar el Modelo Pydantic/SQLAlchemy
Edita el archivo en `app/models/`.

```python
class Tenant(Base):
    # ... campos existentes ...
    # [NUEVO] Agrega el campo con valor por defecto o nullable
    new_feature_flag: Mapped[bool] = mapped_column(Boolean, default=False)
```

### Paso 2: Agregar Paso de Migración en `main.py`
En la lista `migration_steps`, agrega la sentencia SQL defensiva (`IF NOT EXISTS`).

```python
migration_steps = [
    # ... pasos anteriores ...
    """
    DO $$ 
    BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='new_feature_flag') THEN 
            ALTER TABLE tenants ADD COLUMN new_feature_flag BOOLEAN DEFAULT FALSE; 
        END IF; 
    END $$;
    """
]
```

### Paso 3: Reiniciar el Orquestador
Al reiniciar, el log mostrará: `[MIGRATION] Applying step...`.

### Paso 4: Validar
Consulta la base de datos para confirmar que la columna existe.

---

## 3. Identificadores (UUID vs Integers)

*   **Tablas Protocol Omega**: Deben usar `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (ej. `business_assets`, `chat_conversations`).
*   **Agentes & Herramientas (Legacy/Order)**: Se utiliza `SERIAL` (Integer) para facilitar la gestión secuencial.

---

## 4. Troubleshooting de DB

### Error: `Relation "X" does not exist`
*   **Causa**: El modelo no se importó en `main.py` antes de `Base.metadata.create_all`.
*   **Solución**: Agrega `from app.models import X` en las importaciones de `main.py`.

## Schema Strategy: "The Maintenance Robot" (v5.0)

Instead of traditional migration files (`alembic`, etc.), the Orchestrator implements a **Self-Healing Mechanism** on startup (`lifespan` in `main.py`).

### Active Drift Prevention
1.  **Check**: Does `business_assets` exist?
2.  **Repair**: If not, `CREATE TABLE` with UUID PK.
3.  This ensures "Ghost Tables" never crash the system in Production.

### Core Tables
*   `tenants` (Config & Credentials)
*   `business_assets` (Generated content, cached JSONB)
*   `chat_conversations` (History - Omnichannel UUID)

**Definición de Business Assets (Protocol Omega)**:
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

**Definición de Conversaciones (Nexus v4.4)**:
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

**Definición de Agentes (Nexus v5.0)**:
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

---

## 4. Estrategia de Protección de Datos (Safe Detach)

En la v5.1, hemos pasado de una política de "Borrado en Cascada" a **"Limpieza por Lógica"**.

### El Problema del Cascade
Antes, al borrar un `tenant`, se borraban todos los `users` asociados. Esto causaba frustración si el usuario quería conservar su perfil para una nueva aventura.

### La Solución (Protocolo Soberano)
- **Store Deletion**: Borra Agentes, Assets y Config.
- **User Survival**: El backend ejecuta un `UPDATE users SET tenant_id = NULL` antes de proceder.
- **Beneficio**: El usuario mantiene su `email`, `password_hash`, `is_verified` y `full_name`.

---

## 5. Jerarquía RBAC (Role-Based Access Control)

La base de datos ahora distingue entre dos clases soberanas de usuarios:

| Rol | Alcance | Descripción |
| :--- | :--- | :--- |
| `super_admin` | Global | Acceso a métricas de infraestructura y torre de control de plataforma. |
| `owner` | Tenant | Acceso a sus propios agentes, chats y Business Forge. |

---

**© 2025 Platform AI Solutions - Sovereign Data Engineering**

### El Ciclo de Vida del Arranque (Main.py)
Cada vez que el orquestador inicia:
1.  **Import**: Carga todos los modelos de `app/models/__init__.py`.
2.  **Inspect**: Verifica si existen las tablas críticas (`tenants`, `tools`, `credentials`).
3.  **Repair (Migration Steps)**:
    *   Si falta la columna `customer_id` en `chat_conversations` -> La crea.
    *   Si falta la columna `openai_api_key` en `tenants` -> La inyecta.
    *   Si la tabla `credentials` tiene el esquema viejo -> Ejecuta `ALTER TABLE` para agregar `scope`, `category`, etc.

---

## 2. Guía de Migración Sagrada (Los 4 Pasos)

Si necesitas agregar un nuevo campo a la base de datos, **NO crees un archivo .sql manual**. Sigue este protocolo:

### Paso 1: Actualizar el Modelo Pydantic/SQLAlchemy
Edita el archivo en `app/models/`.

```python
class Tenant(Base):
    # ... campos existentes ...
    # [NUEVO] Agrega el campo con valor por defecto o nullable
    new_feature_flag: Mapped[bool] = mapped_column(Boolean, default=False)
```

### Paso 2: Agregar Paso de Migración en `main.py`
En la lista `migration_steps`, agrega la sentencia SQL defensiva (`IF NOT EXISTS`).

```python
migration_steps = [
    # ... pasos anteriores ...
    """
    DO $$ 
    BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='new_feature_flag') THEN 
            ALTER TABLE tenants ADD COLUMN new_feature_flag BOOLEAN DEFAULT FALSE; 
        END IF; 
    END $$;
    """
]
```

### Paso 3: Reiniciar el Orquestador
Al reiniciar, el log mostrará: `[MIGRATION] Applying step...`.

### Paso 4: Validar
Consulta la base de datos para confirmar que la columna existe.

---

## 3. Identificadores (UUID vs Integers)

*   **Nuevas Tablas Estratégicas**: Deben usar `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` para escalabilidad global.
*   **Agentes & Herramientas (Nexus v4.6)**: Se utiliza `SERIAL` (Integer) para garantizar la compatibilidad con secuencias heredadas y facilitar la gestión manual desde el panel administrativo en entornos de MVP.

---

## 4. Troubleshooting de DB

### Error: `Relation "X" does not exist`
*   **Causa**: El modelo no se importó en `main.py` antes de `Base.metadata.create_all`.
*   **Solución**: Agrega `from app.models import X` en las importaciones de `main.py`.

## Schema Strategy: "The Maintenance Robot" (v3.2)

Instead of traditional migration files (`alembic`, etc.), the Orchestrator implements a **Self-Healing Mechanism** on startup (`lifespan` in `main.py`).

### Active Drift Prevention
1.  **Check**: Does `business_assets` exist?
2.  **Repair**: If not, `CREATE TABLE` with UUID PK.
3.  **Heal**: If exists but missing `tenant_id` or `content`, `ALTER TABLE ADD COLUMN`.
4.  This ensures "Ghost Tables" never crash the system in Production.

### Core Tables
*   `tenants` (Config & Credentials)
*   `business_assets` (Generated content, cached JSONB)
*   `chat_conversations` / `chat_messages` (History - Omnichannel UUID)

**Definición de Conversaciones (Nexus v4.4)**:
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

**Definición de Herramientas (Nexus v4.6)**:
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

**Definición de Agentes (Nexus v4.6)**:
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

---

**© 2025 Platform AI Solutions - Data Engineering**
