# 🧠 Guía de Desarrollo de Agentes (Nexus v3.3)

El **Agent Service** es el núcleo de inteligencia "Apátrida" (Stateless) de la plataforma. Diseñado bajo el **Protocolo Omega**, escala horizontalmente y procesa cada solicitud de forma aislada, recibiendo todo el contexto necesario del Orquestador.

---

## 1. Arquitectura Apátrida (Stateless Logic)

El Agente no mantiene memoria entre turnos. Cada solicitud (`POST /v1/agent/execute`) contiene:

*   **Tenant Context**: Quién es la tienda, su catálogo y su Prompt del Sistema.
*   **Credentials**: Claves de API (OpenAI, Tienda Nube) inyectadas dinámicamente.
*   **Chat History**: Los últimos N mensajes de la conversación.

### Inyección de Contexto (ContextVars)

Para que las Tools funcionen sin pasar credenciales explícitamente en cada función, usamos `contextvars` de Python. Esto garantiza que cada hilo de ejecución ("Think Loop") tenga sus propias credenciales aisladas.

```python
# Definición (agent_service/main.py)
ctx_store_id: ContextVar[str] = ContextVar("ctx_store_id")
ctx_token: ContextVar[str] = ContextVar("ctx_token")

# Inyección (al inicio de execute_agent)
ctx_store_id.set(request.credentials.tiendanube_store_id)
ctx_token.set(request.credentials.tiendanube_access_token)
```

---

## 2. Anatomía de una Respuesta (Protocolo Omega)

El agente devuelve un objeto estructurado `OrchestratorResponse` que el Orquestador procesa y persiste.

```json
{
  "messages": [
    {
      "text": "¡Hola! Veo que buscas zapatillas. Aquí tienes nuestras mejores opciones de running:",
      "metadata": {
        "agent_outcome": "Usuario pide zapatillas. Buscando en catálogo.",
        "intermediate_steps": [
          "Tool(search_specific_products, q='zapatillas running') -> Found 3 items: [Nike Pegasus, Adidas User...]"
        ]
      },
      "imageUrl": "https://url-de-imagen-opcional.jpg"
    }
  ]
}
```

*   **Intermediate Steps**: El "Pensamiento" del agente (Chain of Thought). Visible en el Dashboard "Thinking Log".
*   **Agent Outcome**: La conclusión final del modelo.

---

## 3. Catálogo de Herramientas (Tools)

Las herramientas conectan al LLM con el mundo real (Tienda Nube, MCP, Sistemas Externos).

| Tool | Descripción | Input | Observaciones |
| :--- | :--- | :--- | :--- |
| `search_specific_products` | Busca productos por nombre/marca exactos. | `q: str` | "Zapatillas Nike", "Cartera de cuero" |
| `search_by_category` | Busca productos dentro de una categoría. | `category: str`, `keyword: str` | "Zapatos" + "Rojos" |
| `browse_general_storefront` | Muestra productos destacados/nuevos. | `None` | Para preguntas vagas como "¿Qué venden?" |
| `cupones_list` | Lista cupones activos. | `None` | Vía MCP / Tienda Nube |
| `orders` | Consulta estado de una orden. | `q: str` | Número de orden (#1234) o nombre del cliente |
| `derivhumano` | Solicita intervención humana. | `reason: str` | Bloquea al bot y notifica al equipo |

---

## 4. Agentes Especializados (Nexus Business Engine)

Gracias a la arquitectura dinámica, podemos instanciar diferentes "Roles" cambiando simplemente el Prompt del Sistema y las herramientas habilitadas en la base de datos (tabla `agents`).

### 4.1. The Sales Assistant (Default)
*   **Objetivo**: Cerrar ventas, responder dudas de catálogo.
*   **Tools**: Todas las de búsqueda de productos + `cupones_list`.
*   **Prompt**: Enfocado en persuasión ética y brevedad.

### 4.2. The Customer Support (Post-Venta)
*   **Objetivo**: Resolver problemas de envíos y devoluciones.
*   **Tools**: `orders`, `derivhumano`, `sendemail` (vía MCP).
*   **Prompt**: Empático, paciente, orientado a la resolución.

### 4.3. The Librarian (RAG Specialist)
*   **Objetivo**: Responder preguntas complejas sobre políticas o fichas técnicas.
*   **Tools**: RAG Vector Search (ChromaDB).
*   **Prompt**: Estricto, basado en documentos ("Fiel a la fuente").

---

## 5. Ciclo de Desarrollo de una Nueva Tool

1.  **Definir la Función**: En `agent_service/main.py` decorada con `@tool`.
2.  **Usar Contexto**: Obtener credenciales con `ctx_store_id.get()`.
3.  **Manejo de Errores**: **NUNCA** lanzar excepciones. Devolver un string con el error `"Error: ..."` para que el LLM pueda intentar corregir o informar al usuario.
4.  **Registrar**: Agregar la función a la lista `tools_list` dentro de `execute_agent`.

```python
@tool
async def check_custom_stock(sku: str):
    """Checks stock for a specific SKU."""
    store_id = ctx_store_id.get()
    # ... call API ...
    return "Stock: 50"
```

---

> **Nota de Seguridad**: Todas las comunicaciones internas deben incluir el header `X-Internal-Secret`. El `agent_service` rechazará peticiones sin este secreto validado.
