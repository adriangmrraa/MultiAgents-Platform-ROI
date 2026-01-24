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
Para que un nuevo tipo de agente sea funcional, requiere una configuración en tres puntos (Triple-Point Touch):

**Paso 1: Backend de Inteligencia (`agent_service/app/core/agent_templates.py`)**
- Crea una nueva clase (ej: `SupportTemplate`) que herede de `BaseAgentTemplate`.
- Implementa `get_system_role()` y `get_core_instructions()`.
- Registra la clave en `AgentTemplateFactory`.

**Paso 2: Backend de Orquestación (`orchestrator_service/app/api/agents.py`)**
- Agrega la misma clave al diccionario `AGENT_TEMPLATES`.
- Define los `fields` por defecto (Tone, Rules) para que el Wizard se rellene solo al elegirla.

**Paso 3: Frontend (`DynamicAgentWizard.tsx`)**
- Agrega la clave al componente `getIconForTemplate` para que tenga un icono visual.

---

## 4. Reglas de Persistencia (Wizard Logic)
> [!CAUTION]
> **El Error del Bucle (The Persistence Trap):**
> Al editar la función `handleSubmit` en el Wizard, **NUNCA** pongas el `...formData` al final del objeto de carga (`payload`).
> **Correcto:** `const payload = { ...formData, system_prompt_template: 'NUEVO', ... }`
> Si el spread va al final, los datos viejos que vienen de la base de datos "pisarán" las ediciones que el usuario hizo en ese instante.

### Cómo agregar nuevos campos sin Migraciones SQL
Nexus utiliza una columna de tipo `JSONB` llamada `config` en la tabla `agents`.
Cualquier campo nuevo que agregues a `AGENT_CONFIG_SCHEMA` en el frontend se guardará automáticamente dentro de ese JSON. No necesitas tocar la base de datos para agregar preferencias, links o políticas nuevas.

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

## 5. Resolución de Identidad (Sovereign Security)
> [!IMPORTANT]
> **La Regla de Oro del Tenant ID:**
> En el backend, **NUNCA** confíes en el `tenant_id` que viene en la memoria del objeto `current_user`. Debido a la evolución del sistema, ese campo puede contener un UUID (string), pero la base de datos (tablas `agents`, `tenants`) usa **INTEGERS**.
> 
> **Cómo hacerlo bien:**
> Siempre busca el ID real en la tabla `users` antes de cualquier consulta SQL:
> ```python
> user_row = await db.pool.fetchrow("SELECT tenant_id FROM users WHERE id = $1", current_user.id)
> tenant_id = user_row['tenant_id']
> # Ahora usa tenant_id (Integer) en tu query
> ```
> Omitir este paso hará que los agentes o datos del usuario "desaparezcan" de la interfaz.

---

## 6. Clonación y Re-instalación
Si quieres instalar Nexus en un servidor nuevo:
1.  **Repo**: Clona el código.
2.  **Environment**: Copia el `.env.example` a `.env` y configura el `POSTGRES_DSN` (Supabase).
3.  **Boot**: Ejecuta `docker compose up -d`.
4.  **Auto-Repair**: El sistema detectará que las tablas no existen y ejecutará `migration_steps` en el primer arranque. No necesitas scripts SQL manuales.

**© 2026 Platform AI Solutions - Dev Team**
