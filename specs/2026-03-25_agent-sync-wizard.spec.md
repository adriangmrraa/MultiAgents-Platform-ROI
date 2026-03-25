# SPEC: Sincronizacion Agente ↔ Wizard

## Fecha: 2026-03-25
## Prioridad: P0 — Sin esto el onboarding es decorativo
## Problema: El agente creado por /complete usa prompt generico, no el refinado del wizard

---

## PROBLEMA ACTUAL

1. El usuario conversa con Nova → genera system prompt detallado → toca "Refinar con IA" → obtiene prompt profesional
2. Toca "Activar Agente" → llama `/admin/onboarding-wizard/complete`
3. El endpoint crea el agente con `system_prompt_template = "Eres un asistente virtual de ventas."` (hardcodeado)
4. El prompt refinado se guarda en `onboarding_progress.system_prompt_draft` pero NUNCA se usa para el agente
5. El agente responde genérico, sin las reglas, tono, ni diccionario que configuró el usuario

---

## SOLUCION

### 1. `/complete` usa el system_prompt_draft real

```python
# ANTES (roto):
system_prompt = "Eres un asistente virtual de ventas."

# DESPUES (correcto):
system_prompt = progress["system_prompt_draft"]  # El prompt real del wizard
if not system_prompt or len(system_prompt) < 50:
    system_prompt = "Eres un asistente virtual de ventas."  # Fallback solo si vacio
```

### 2. El agente se crea con tools habilitadas

```python
# ANTES:
enabled_tools = ["search_specific_products", "search_by_category", ...]

# DESPUES (igual pero asegurar que estan):
enabled_tools = [
    "search_specific_products",
    "search_by_category",
    "browse_general_storefront",
    "orders",
    "derivhumano"
]
```

### 3. El agente se crea con knowledge_sources

Si el usuario selecciono colecciones en el paso 6, guardarlas en el agente:
```python
knowledge_sources = progress["step_data"].get("knowledge_sources", [])
```

### 4. El frontend guarda el prompt ANTES de llamar /complete

El `activateAgent` ya hace esto (guarda `system_prompt_draft` via PUT) pero hay que verificar que llega.

### 5. Bidireccional: wizard puede editar agente existente

Si el usuario vuelve al wizard despues de crear el agente:
- Cargar el system_prompt del agente existente en el textarea
- Al "Activar" de nuevo, ACTUALIZAR el agente existente (UPDATE, no INSERT)
- No crear agentes duplicados

---

## ARCHIVOS A MODIFICAR

- `orchestrator_service/app/routes/onboarding_wizard_routes.py` — `/complete` endpoint
- `frontend_react/src/views/OnboardingWizard.tsx` — `activateAgent` flow

---

## CRITERIOS DE ACEPTACION

- [ ] El agente creado por /complete usa el system_prompt_draft del wizard
- [ ] El agente tiene enabled_tools con las 5 tools standard
- [ ] El agente tiene knowledge_sources si el usuario selecciono colecciones
- [ ] Si el usuario vuelve al wizard, puede editar y RE-activar sin duplicar
- [ ] El prompt del agente es el refinado, no "Eres un asistente virtual"
- [ ] El agente funciona en produccion (responde por WhatsApp/IG con el prompt real)
