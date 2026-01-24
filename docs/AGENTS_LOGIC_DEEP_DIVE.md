# 🤖 Gestión de Inteligencia (Agents Logic Deep Dive)

Este documento explica la lógica detrás de la vista `Agents.tsx`, donde se configuran los cerebros del sistema Nexus.

---

## 🏗️ Concepto: La Fábrica de Agentes

Nexus no tiene un solo "Bot". Tiene una **Fuerza Laboral Digital**. Esta vista permite al administrador crear, editar y eliminar "empleados digitales" (Agentes) y asignarlos a tiendas específicas.

### Componentes Clave
1.  **CRUD API**: Gestión completa (`POST`, `PUT`, `DELETE`) contra la tabla `agents`.
2.  **Tool Selector**: Carga dinámica de herramientas disponibles.
3.  **Tenant Bind**: Asignación estricta de un agente a un inquilino (`tenant_id`).
4.  **Neural Stream**: Visualización en tiempo real del "pensamiento" global (`GlobalStreamLog`).

---

## 🔄 Flujo de Configuración

### 1. Inyección de Identidad (System Prompt)
El campo más poderoso es el `system_prompt_template`.
-   **Variable Mágica**: El usuario escribe texto estático, pero el sistema inyecta variables de contexto en tiempo de ejecución (`{catalog}`, `{store_name}`).
-   **Recomendación UI**: "Núcleo Omega" es un preset que carga las mejores prácticas de venta consultiva.

### 2. Selección de Herramientas (Brain Extensions)
El agente por sí solo es solo un LLM. Las herramientas le dan "manos".
-   **Carga**: Al inicio, `Agents.tsx` llama a `GET /admin/tools` para saber qué capacidades tiene el sistema instaladas (ej: `search_products`, `check_stock`).
-   **Asignación**: El array `enabled_tools` guarda los nombres técnicos de las funciones que este agente específico tiene permiso de usar.

### 3. Modelo Cognitivo (Model Selection)
Permite elegir la "inteligencia" subyacente:
-   **Proveedor**: OpenAI (Estándar) o Anthropic (Experimental).
-   **Modelo**: `gpt-4o` (Recomendado para ventas) o `gpt-3.5-turbo` (Para tareas simples).
-   **Temperatura**: Controla la creatividad (0.0 = Robótico, 1.0 = Alucinado).

---

## 🛡️ Soberanía en Agentes

### Multi-Tenancy Estricto
Cada agente incluye un `tenant_id`.
-   **Runtime**: Cuando el `NotificationsService` (WhatsApp) recibe un mensaje, busca **solo** los agentes activos asociados a ese número de teléfono / tenant.
-   **Aislamiento**: Un agente de la "Tienda A" jamás responderá a un mensaje de la "Tienda B", incluso si ambos usan el mismo sistema Nexus.

### Canales
El array `channels` define dónde escucha este agente.
-   Por defecto: `['whatsapp', 'instagram', 'facebook']`.
-   Puede restringirse para tener un "Agente exclusivo de Instagram".

---

## ⚡ Monitor de Pensamiento (Neural Log)
Al pie de página, el componente `GlobalStreamLog` se conecta vía WebSocket/SSE al canal de eventos del sistema.
-   **Propósito**: Ver "qué está pensando" el bot en tiempo real.
-   **Privacidad**: Solo muestra logs del tenant al que tiene acceso el admin logueado.

---

## 🚀 Evolución Nexus v5.99

### 1. Gestión de Canales Omnicanal
Se ha introducido el componente `ChannelSelector` directamente en el Wizard.
-   **Propósito**: Permitir al usuario decidir en tiempo real si un agente atiende en WhatsApp, Instagram, Facebook o el Web Widget.
-   **Sincronización**: El Wizard consulta `/admin/integrations/status` para deshabilitar canales que no tengan una conexión activa en Meta o TiendaNube.
-   **Persistencia**: Las selecciones se guardan en la columna `channels` (JSONB) y se mantienen sincronizadas entre el modal de pre-activación y el Wizard profundo.

### 2. Live Preview & Simulation (Fixed)
La simulación de chat ha sido re-diseñada para mayor robustez.
-   **SSE Handling**: El backend ahora decodifica correctamente el flujo de tokens (Server-Sent Events) evitando burbujas vacías.
-   **Schema v1/v2 Sync**: Se ha unificado la versión del esquema entre el Orquestador y el Agent Service para evitar errores de incompatibilidad con LangChain.
-   **Contexto de Identidad**: La simulación hereda el `tenant_id` real del administrador para usar sus propias API Keys.

### 3. Persistencia de URL Web
-   **Campo `store_website`**: Ahora se guarda explícitamente tanto en la columna de base de datos como en el JSON de configuración (`config.store_website`).
-   **Hidratación**: Al cargar el Wizard, el sistema realiza una "búsqueda profunda" para recuperar la URL guardada, evitando que el campo se vacíe al editar otros parámetros.

---

## 🔬 Especificaciones Técnicas (Debugging Guide)
/* ... same as before ... */

### 1. Estados Críticos
| Estado | Tipo | Descripción | Error Común |
| :--- | :--- | :--- | :--- |
| `agents` | `Agent[]` | Lista de agentes. | Si un agente no aparece, revisar `tenant_id` del usuario logueado. |
| `editingAgent.enabled_tools` | `string[]` | IDs de herramientas activas. | Debe coincidir exactamente con los nombres en `tools_registry.py`. |
| `editingAgent.system_prompt_template` | `string` | Prompt crudo. | Si es muy largo (>100k chars), puede dar error 413 Payload Too Large. |

### 2. Endpoints & Payloads

#### A. Crear/Editar Agente
*   **Request**: `POST` o `PUT` a `/api/admin/agents`
*   **Body**:
    ```json
    {
      "name": "Vendedor Estrella",
      "role": "sales",
      "model": "gpt-4o",
      "temperature": 0.7,
      "system_prompt_template": "Eres un vendedor...",
      "tenant_id": 1, // CRÍTICO: Debe existir en tabla tenants
      "enabled_tools": ["search_products", "check_stock"],
      "channels": ["whatsapp"]
    }
    ```
*   **Validación Backend**: El backend verifica que el `tenant_id` pertenezca al usuario (o sea SuperAdmin).

#### B. Cargar Herramientas
*   **Request**: `GET /api/admin/tools`
*   **Response**:
    ```json
    [
      { "name": "search_products", "description": "Busca en Tienda Nube..." },
      { "name": "rag_search", "description": "Busca en PDF..." }
    ]
    ```
*   **Nota**: Esta lista se genera dinámicamente escaneando las funciones decoradas en el backend. Si una tool nueva no aparece, revisar si tiene el decorador `@tool` y está importada en `tools_registry.py`.

### 3. Errores Frecuentes
*   **Agente no responde**:
    *   Verificar que `enabled` sea `true` en DB.
    *   Verificar que el `tenant_id` del mensaje entrante coincida con el del agente.
    *   Verificar que las `credentials` (OpenAI Key) del tenant sean válidas.
*   **Tool Call Error**:
    *   Si el log muestra `Tool not found`, es porque el nombre en `enabled_tools` no coincide con el registro del backend.

