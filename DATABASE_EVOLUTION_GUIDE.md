# 🧬 Database Evolution Guide (Nexus v3 - Protocol Omega)

Este documento define la **Filosofía de Gestión de Datos** para la plataforma. En Nexus v3, la base de datos es la **Única Fuente de Verdad (SSOT)**.

---

## 1. Filosofía "Schema Drift Prevention"

El "Schema Drift" ocurre cuando el código espera una columna que la base de datos no tiene. Protocol Omega resuelve esto con una estrategia de **Auto-Reparación en Tiempo de Arranque**.

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

**Protocol Omega estandariza el uso de UUIDs.**

*   **Nuevas Tablas**: Deben usar `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
*   **Tablas Legacy**: Se mantienen como están para no romper compatibilidad, pero sus referencias nuevas deben respetar el tipo original.

---

## 4. Troubleshooting de DB

### Error: `Relation "X" does not exist`
*   **Causa**: El modelo no se importó en `main.py` antes de `Base.metadata.create_all`.
*   **Solución**: Agrega `from app.models import X` en las importaciones de `main.py`.

### Error: `NotNullViolation`
*   **Causa**: Agregaste una columna obligatoria a una tabla con datos existentes.
*   **Solución**: Haz la columna `nullable=True` o asigna un `DEFAULT`.

---

**© 2025 Platform AI Solutions - Data Engineering**
