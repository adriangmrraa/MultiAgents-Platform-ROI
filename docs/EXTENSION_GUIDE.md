# 🛠️ Guía de Extensión para Desarrolladores

Esta guía explica paso a paso cómo agregar nuevas capacidades a Nexus sin romper la arquitectura soberana.

---

## 1. Cómo agregar una nueva herramienta (Tool) al Agente
Las herramientas son funciones Python que la IA puede llamar.

**Paso 1: Definir la función en `agent_service/main.py`**
```python
@tool
async def mi_nueva_herramienta(parametro: str):
    """
    Descripción clara para la IA (esto le dice cuándo usarla).
    """
    # Lógica (ej: llamar a una API externa)
    return "Resultado de la herramienta"
```

**Paso 2: Registrarla en la lista `all_tools`**
Busca la lista `all_tools` en el mismo archivo y agrega tu función.

**Paso 3 (Opcional): Agregarla al Dashboard**
Si quieres que el usuario pueda encenderla/apagarla, edita `admin_routes.py` en el endpoint `GET /tools` y agrégala al array `system_tools`.

---

## 2. Cómo agregar un nuevo campo al Wizard del Agente
Si quieres que el usuario pueda configurar algo nuevo (ej: "Política de Descuentos").

**Paso 1: Editar `DynamicAgentWizard.tsx`**
Busca la constante `AGENT_CONFIG_SCHEMA` y agrega un objeto:
```typescript
{
    key: 'politica_descuentos',
    label: 'Política de Descuentos',
    type: 'textarea',
    defaultValue: 'No dar descuentos sin permiso.'
}
```

**Paso 2: Sincronizar el Backend**
Nexus guarda todo automáticamente en el campo `config` (JSONB). No necesitas cambiar el esquema de la base de datos para campos simples.

---

## 3. Cómo crear una nueva Plantilla (Base Template)
Si quieres un agente que no sea de Ventas (ej: "Agente de Recursos Humanos").

**Paso 1: Editar `agent_service/app/core/agent_templates.py`** (o donde esté la Factory).
- Crea una nueva clase que herede de `BaseTemplate`.
- Define su `system_prompt` base.
- Filtra qué herramientas tiene permitidas esa plantilla.

**Paso 2: Registrar en el frontend**
En `DynamicAgentWizard.tsx`, agrega la clave de tu plantilla al objeto `templates`.

---

## 4. Cómo registrar un nuevo Modelo de IA
Si sale un nuevo modelo (ej: GPT-6) y quieres usarlo.

**Paso 1: Editar `orchestrator_service/app/core/models.py`** (o en `admin_routes.py` -> `MODEL_REGISTRY`).
Agrega el ID técnico del modelo:
```json
{ "id": "gpt-6", "provider": "openai", "tier": "premium" }
```

**Paso 2: Verificación**
El sistema lo mostrará automáticamente en el dropdown de "Modelo de Inteligencia" del Wizard.

---

## 5. Clonación y Re-instalación
Si quieres instalar Nexus en un servidor nuevo:
1.  **Repo**: Clona el código.
2.  **Environment**: Copia el `.env.example` a `.env` y configura el `POSTGRES_DSN` (Supabase).
3.  **Boot**: Ejecuta `docker compose up -d`.
4.  **Auto-Repair**: El sistema detectará que las tablas no existen y ejecutará `migration_steps` en el primer arranque. No necesitas scripts SQL manuales.

**© 2026 Platform AI Solutions - Dev Team**
