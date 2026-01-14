# Documento de Profundización Técnica - Nexus v5 (Protocol Omega)

**Versión:** 1.0  
**Fecha:** 2026-01-06  
**Alcance:** Desglose técnico nivel código de los procesos core de la plataforma.

---

## 1. Arquitectura de Procesamiento

La plataforma opera bajo una arquitectura de **Microservicios Híbrida** orquestada por eventos. El núcleo es el `orchestrator_service` (Python/FastAPI), que actúa como el "Cerebro", delegando la ejecución cognitiva al `agent_service` (LangChain/OpenAI) y la gestión de comercio al `tiendanube_service`.

### Diagrama de Flujo de Datos (Alto Nivel)
1.  **Ingesta (Webhook)** -> Normalización de Evento -> Persistencia (DB)
2.  **Orquestación** -> Resolución de Identidad -> Clasificación de Intención -> Enrutamiento
3.  **Ejecución (Agente)** -> Inyección de Contexto -> Uso de Herramientas -> Generación de Respuesta
4.  **Entrega** -> Streaming de Tokens -> Envío a WhatsApp/Canal

---

## 2. Proceso: Ingesta de Mensajes (Webhook)

Este proceso es el punto de entrada de todas las interacciones. Ocurre en `orchestrator_service/main.py` -> `chat_endpoint`.

### 2.1. Autenticación y Validación
*   **Código**: Se verifica el header `X-Internal-Token` contra la variable de entorno `INTERNAL_SECRET_KEY` para asegurar que la petición viene de un gateway confiable (Traefik/YCloud).
*   **Payload**: Se recibe un JSON que puede variar según el proveedor (YCloud directo o Chatwoot).

### 2.2. Normalización (Clase `SimpleEvent`)
El sistema convierte cualquier payload entrante en un objeto estandarizado `SimpleEvent` (`orchestrator_service/main.py`):
*   **Atributos clave**: `from_number` (ID usuario), `text` (contenido), `channel_source` (whatsapp/instagram), `tenant_id`.
*   **Lógica de Compatibilidad**: Se detecta si el payload es de Chatwoot (estructura universal) o de Meta (estructura legacy) y se mapea correspondientemente.

### 2.3. Resolución de Identidad (Protocol Omega)
Antes de procesar, el sistema resuelve "Quién es" el usuario en la base de datos `customers`:
1.  Busca en la tabla `customers` usando `tenant_id` y el identificador del canal (`phone_number`, `instagram_psid`).
2.  **Si no existe**: Crea un nuevo registro UUID en `customers`.
3.  **Si existe**: Devuelve el UUID existente.

### 2.4. Gestión de Conversación y Bloqueo
*   **Lookup**: Busca una conversación activa en `chat_conversations`.
*   **Human Override**: Verifica la columna `human_override_until`. Si la fecha actual es menor a esta marca de tiempo, el mensaje se guarda pero **el proceso se aborta** (retorno `orchestrator_result status="ignored"`), evitando que la IA responda sobre un humano.

---

## 3. Proceso: Orquestación y Enrutamiento

Una vez persistido el mensaje, el `Orchestrator` decide qué hacer.

### 3.1. Smart Buffering (Debounce)
Para manejar usuarios que envían múltiples mensajes cortos ("Hola", "precio?", "de esto"), se utiliza Redis:
*   **Acción**: Se hace `RPUSH` del texto a una lista `buffer:{telefono}`.
*   **Worker**: Una `BackgroundTask` espera 2 segundos. Si llegan más mensajes, se acumulan. Al finalizar el tiempo, se procesan todos juntos como un solo bloque de texto.

### 3.2. Clasificación de Intención (`classify_intent`)
Si el buffer se libera, se invoca a `classify_intent` (función asíncrona en `main.py`):
*   **Input**: Últimos 3 mensajes + lista de agentes disponibles para ese Tenant.
*   **Modelo**: Usa `gpt-4o-mini` (rápido y barato) con un prompt de clasificación.
*   **Output**: Selecciona el `agent_id` más adecuado (ej: "Ventas", "Soporte", "Logística").

---

## 4. Proceso: Ejecución del Agente

Este es el "bucle de pensamiento". Ocurre principalmente en `execute_agent_v3_logic`.

### 4.1. Construcción del Agente (`get_agent_executable`)
Se instancia un `AgentExecutor` de LangChain dinámicamente para cada petición (Stateless):
1.  **Carga de Contexto**: Se recuperan credenciales de Tienda Nube y OpenAI del `TenantContext`.
2.  **Prompt del Sistema**: Se inyectan variables dinámicas en el template: `{STORE_CATALOG_KNOWLEDGE}`, `{STORE_NAME}`.
3.  **Tools**: Se habilitan solo las herramientas configuradas para ese agente en la DB.

### 4.2. Inyección Táctica (Nexus v4.5)
Para mejorar la precisión de las herramientas sin cambiar código, se inyectan instrucciones en tiempo de ejecución:
*   **Prompt Injection**: Antes de llamar a la tool, el sistema inserta instrucciones como *"Usa search_specific_products solo si hay un nombre explícito"*.
*   **Response Guides**: Se instruye al modelo sobre cómo interpretar el JSON que devuelve la tool (ej: *"Extrae solo precio y URL"*).

### 4.3. Ciclo de Ejecución
1.  El modelo recibe el historial + prompt + tools.
2.  **Razonamiento**: Decide si llamar a una tool (ej: `search_specific_products`).
3.  **Tool Call**: Ejecuta la función Python decorada con `@tool`.
    *   Ej: `search_specific_products` hace un `GET` a la API de Tienda Nube, cachea el resultado en Redis (`set_cached_tool`) y devuelve un JSON simplificado.
4.  **Respuesta Final**: El modelo genera el texto final basado en el resultado de la tool.

---

## 5. Proceso: Business Engine ("Magic Onboarding")

Ubicado en `app/core/engine.py`, clase `NexusEngine`. Es un proceso batch que configura una tienda nueva autónomamente.

### 5.1. Secuencia de los "Magnificent Seven"
El método `ignite()` orquesta 7 agentes especializados secuencialmente:
1.  **Extractor de ADN**: Scrapea la web del cliente y usa LLM para deducir `brand_voice`, `archetype` y `uvp`.
2.  **Bibliotecario RAG**: Indexa el catálogo de productos en una base de datos vectorial (Qdrant/Chroma) vía `RAGCore`.
3.  **Director Creativo**: Toma las 3 imágenes principales del catálogo, las descarga, y usa un modelo multimodal (Gemini/GPT-4V) para generar descripciones visuales de anuncios de alto impacto.
4.  **Copywriter**: Genera scripts de venta (AIDA, PAS) usando el ADN de marca detectado.
5.  **Growth & Social**: Generan proyecciones de ROI y matrices de contenido por canal.
6.  **Guardián de la Verdad**: Verifica que los activos generados coincidan con el catálogo real (evita alucinaciones).

### 5.2. Persistencia de Activos
Cada paso guarda su resultado en la tabla `business_assets` como un JSONB y emite un evento Redis Pub/Sub para que el Frontend muestre el progreso en tiempo real ("Thinking Log").

---

## 6. Detalles de Base de Datos y Esquema

El sistema utiliza **PostgreSQL** con un esquema evolutivo gestionado por scripts de migración "Run-Always" en el arranque (`main.py` -> `migration_steps`).

### Tablas Críticas:
*   `tenants`: Configuración maestra de cada tienda.
*   `credentials`: Almacén encriptado (pgcrypto) de API Keys.
*   `chat_conversations`: Estado y bloqueo de sesiones de chat.
*   `chat_messages`: Historial inmutable de mensajes.
*   `business_assets`: Resultados del motor de onboarding (JSONB).

### Redis:
*   **Uso**: Cache de respuestas de API Tienda Nube (TTL 600s), Buffer de mensajes (TTL 5s), Pub/Sub de eventos de UI.
