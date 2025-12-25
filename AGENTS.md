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
        return f"Stock: 50 unidades"
    except Exception as e:
        return f"Error revisando stock: {e}"
```

---

### 3. Nexus Business Engine Agents (v3.2)
*Estos agentes son 100% Apátridas (Stateless). Reciben su contexto completo del Orquestador en cada invocación.*

*   **Branding Agent**: Extrae ADN visual (HTML/CSS) -> Crea Manual de Marca.
*   **Scriptwriter Agent**: LLM + System Prompt -> Genera Guiones de Venta (Email, WhatsApp).
*   **Visual Artist Agent**: Genera conceptos visuales para RRSS basados en inventario/fechas.
### 5. The Librarian (RAG Agent)
*   **Role**: Knowledge Keeper.
*   **Source**: `tiendanube_service` (`/tools/productsall`).
*   **Process (Smart RAG)**:
    1.  **Fetch**: Get raw catalog JSON.
    2.  **Transform**: `gpt-4o-mini` rewrites product as "Semantic Document" (SEO-optimized).
    3.  **Index**: Store in `ChromaDB` (Persistent) with Tenant ID.
*   **Output**: High-precision vector retrieval for "Search Specific Products".
*   **Deep Research Agent (ROI)**: Analiza competencia y sugiere estrategia de precios.
*   **Post-Venta & Memoria Agent**: Se nutre de conversaciones pasadas (con autorización) y del catálogo indexado (RAG) para fidelizar clientes y resolver dudas sin alucinaciones.

---

## 4. Configuración de Modelos

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
