# 🧠 Guía de Desarrollo de Agentes (Nexus v3)

El **Agent Service** es el componente inteligente de la plataforma. Esta guía explica cómo extender sus capacidades.

---

## 1. Anatomía de una Respuesta (Protocolo Omega)

A diferencia de un chatbot simple, nuestros agentes no devuelven texto plano. Devuelven un objeto estructurado `OrchestratorResponse`:

```json
{
  "messages": [
    {
      "text": "Hola, ¿cómo puedo ayudarte?",
      "metadata": {
        "agent_outcome": "Usuario saludó. Responder amablemente.",
        "intermediate_steps": ["Tool(search_products) -> Found 0 items"]
      }
    }
  ]
}
```

*   **Text**: Lo que ve el usuario en WhatsApp.
*   **Metadata**: Lo que ve el administrador en el "Thinking Log" (UI). **Crucial para depuración.**

---

## 2. Creación de Nuevas Herramientas (Tools)

Las herramientas se definen en `agent_service/main.py`.

### Pasos para crear una Tool:
1.  Definir la función asíncrona decorada con `@tool`.
2.  Usar el contexto global `ctx` para obtener credenciales (`ctx.store_id`, `ctx.token`).
3.  Manejar errores internamente y devolver un string descriptivo (el LLM leerá este error).

```python
@tool
async def check_stock(product_id: str):
    """Checks stock level using the API."""
    try:
        # Lógica de llamada a Tienda Nube Service
        return f"Stock: 50 unidades" 
    except Exception as e:
        return f"Error revisando stock: {e}"
```

---

## 3. Configuración de Modelos

El modelo se selecciona dinámicamente según la configuración del Agente en la BD (tabla `agents`).
*   **Provider**: `openai` (Standard), `anthropic` (Future).
*   **Model**: `gpt-4o`, `gpt-4o-mini` (Recomendado por velocidad/costo).
*   **Temperature**: Controla la creatividad.

---

## 4. Human Handoff (Derivación)

Si el agente detecta frustración o solicitud explícita, usa la herramienta `derivhumano`.
*   Esto inserta un marcador `HUMAN_HANDOFF_REQUESTED` en la respuesta.
*   El **Orchestrator** intercepta este marcador y:
    1.  Detiene al bot.
    2.  Cambia el estado de la conversación a `human_override`.
    3.  Envía email de alerta (si está configurado).

---

> **Tip de Desarrollo**: Si cambias la definición de una herramienta, reinicia el `agent_service` para que LangChain reconstruya el esquema de funciones de OpenAI.
