# 🦍 Guía de Desarrollo de Agentes (Nexus v5.1 - Protocol Omega)

Este documento detalla la arquitectura de **Inteligencia Artificial** de la plataforma, dividida en dos grandes dominios: **Agentes Conversacionales** (Atención al Cliente en Tiempo Real) y **Agentes Estratégicos** (Motor de Negocios "Magic Onboarding").

---

## Parte I: Agentes Conversacionales (Runtime)

Ubicación: `agent_service/` (Microservicio Apátrida)

El **Agent Service** es el núcleo de inteligencia "Apátrida" (Stateless) que maneja las interacciones chat con los usuarios finales. Diseñado bajo el **Protocolo Omega**, escala horizontalmente y procesa cada solicitud de forma aislada.

### 1. Arquitectura Apátrida (Stateless Logic)

El Agente no mantiene memoria persistente en proceso. Cada solicitud (`POST /v1/agent/execute`) recibe todo el contexto necesario:

*   **Tenant Context**: Credenciales de Tienda Nube y OpenAI.
*   **Tactical Context**: Prompt del Sistema y configuración de herramientas.
*   **Channel Context**: Origen (IG/FB/WA) identificado.
*   **Chat History**: Los últimos N mensajes de la conversación.

#### Inyección de Contexto (ContextVars)
Para seguridad y aislamiento, usamos `contextvars` para inyectar credenciales en las herramientas sin pasarlas como argumentos explícitos:

```python
# agent_service/main.py
ctx_store_id: ContextVar[str] = ContextVar("ctx_store_id")
ctx_token: ContextVar[str] = ContextVar("ctx_token")
ctx_internal_token: ContextVar[str] = ContextVar("ctx_internal_token")
```

### 2. Catálogo de Herramientas (Conversational Tools)

Estas herramientas están disponibles para que el LLM interactúe con el e-commerce y el mundo exterior.

| Tool | Función (Python) | Descripción |
| :--- | :--- | :--- |
| `search_specific_products` | `search_specific_products` | Busca productos por nombre exacto, categoría o marca. |
| `search_by_category` | `search_by_category` | Busca filtros de categoría + palabra clave opcional. |
| `browse_general_storefront` | `browse_general_storefront` | Obtiene productos destacados para consultas vagas ("qué vendes"). |
| `cupones_list` | `cupones_list` | Lista cupones de descuento activos. |
| `orders` | `orders` | Consulta estado de pedidos (por ID o nombre). |
| `search_knowledge_base` | `search_knowledge_base` | Consulta RAG (políticas, envíos) en el Orquestador. |
| `derivhumano` | `derivhumano` | Dispara la intervención humana y pausa al bot. |

### 3. Roles de Agentes (Perfiles)

*   **Sales Assistant (Vendedor)**:
    *   *Objetivo*: Cerrar ventas, sugerir productos, cross-selling.
    *   *Tools*: Búsqueda de productos, Cupones, Catálogo.
    *   *Prompt*: Persuasivo, breve, orientado a la conversión.

*   **Customer Support (Atención)**:
    *   *Objetivo*: Post-venta, tracking, resolución de dudas.
    *   *Tools*: Órdenes, RAG (Políticas), Derivación Humana.
    *   *Prompt*: Empático, resolutivo, paciente.

---

## Parte II: Agentes Estratégicos (Nexus Business Engine)

Ubicación: `orchestrator_service/app/core/engine.py` (Clase `NexusEngine`)

Estos son los **"Magnificent Seven"**, agentes especializados que se ejecutan **una sola vez** (o bajo demanda) durante el proceso de **Magic Onboarding** para construir la identidad digital y estrategia de la marca.

### Flujo de Ejecución ("The Spark")

El proceso `ignite()` orquesta estos agentes secuencialmente:

#### 1. 🧬 Extractor de ADN (The DNA Extractor)
*   **Misión**: Decodificar el "alma" de la marca analizando su sitio web actual y productos.
*   **Modelo Base**: GPT-4o-mini.
*   **Output**: UVP (Propuesta de Valor), Voz de Marca, Arquetipo (ej: "El Mago"), Metodología.

#### 2. 📚 Bibliotecario RAG (The Librarian)
*   **Misión**: Indexar el conocimiento del catálogo en la base de datos vectorial.
*   **Funciones**:
    *   Scraping inteligente del sitio.
    *   Generación de Embeddings.
    *   Verificación de coherencia (saltar si ya existen vectores).

#### 3. 🎨 Director Creativo (The Creative Director)
*   **Misión**: Alquimia Visual. Transforma fotos de producto simples en anuncios publicitarios de alto impacto.
*   **Tecnología**: **Gemini 2.5 Multimodal** (Vision) + DALL-E 3 (vía "Fusion").
*   **Output**: Assets visuales, prompts de "Neuroestética".

#### 4. ✍️ Copywriter Maestro (The Copywriter)
*   **Misión**: Redacción persuasiva de Respuesta Directa.
*   **Frameworks**: AIDA (Atención, Interés, Deseo, Acción), PAS (Problema, Agitación, Solución).
*   **Output**: Scripts de venta para TOFU (Top of Funnel) y BOFU (Bottom of Funnel).

#### 5. 📈 Arquitecto de Crecimiento (Growth Architect)
*   **Misión**: Estrategia financiera y proyección.
*   **Output**: Estimaciones de ROAS, CPA target, Estrategia de Upselling (Regla 80/20).

#### 6. 📱 Estratega de Redes (Social Media Strategist)
*   **Misión**: Adaptación de contenido a canales.
*   **Output**: Matriz de formatos (Reels vs Feed vs WhatsApp Blast).

#### 7. 🛡️ Guardián de la Verdad (Compliance Guardian)
*   **Misión**: Filtro de seguridad final.
*   **Funciones**:
    *   Verificar que la IA no alucine productos inexistentes.
    *   Validar integridad de precios (vs Tienda Nube).
    *   Brand Safety Check.

---

## Ciclo de Desarrollo de una Nueva Tool

1.  **Definir la Función**: En `agent_service/main.py` decorada con `@tool`.
2.  **Usar Contexto**: Obtener credenciales con `ctx_store_id.get()`.
3.  **Manejo de Errores**: **NUNCA** lanzar excepciones crudas. Devolver un string con describir el error para que el LLM pueda intentar corregir.
4.  **Registrar**: Agregar la función a la lista `all_tools` dentro de `execute_agent`.

```python
@tool
async def check_custom_metric(param: str):
    """Checks custom metric."""
    # Usar httpx con el token interno
    headers = {"X-Internal-Secret": ctx_internal_token.get()}
    # ... logic ...
    return "Metric: OK"
```

> **Nota de Seguridad**: Todas las comunicaciones internas deben incluir el header `X-Internal-Secret`. El `agent_service` rechazará peticiones sin este secreto validado.
