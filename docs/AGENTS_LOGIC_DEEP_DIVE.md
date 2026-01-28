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

### 1. Inyección de Identidad (Hybrid Prompting)
El sistema ahora separa la inteligencia en capas:
-   **System Prompt Técnico (Core Rules)**: Reglas JSON, seguridad (`business_rules`) y manuales de herramientas. Está desacoplado y es gestionado por el sistema.
-   **Personalidad del Usuario (Agent Tone)**: Editable en la UI. Permite definir si el bot es cínico, alegre o profesional sin romper las reglas de seguridad.
-   **Variable Mágica**: Inyección en tiempo de ejecución de `{catalog}`, `{store_name}`, y el `{synonym_dictionary}`.

### 2. Seed Data: El Legado de "Pointe Coach"
Todo nuevo Agente de Ventas nace pre-configurado con los valores de éxito de **Pointe Coach**. 
-   **Tono**: Optimizado para calidez y voseo argentino.
-   **Diccionario**: Mapeo automático de términos de danza (Leotardos -> Mallas).
-   **Reglas**: Filtros de veracidad absoluta y derivación humana proactiva.

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

## 🚀 Estándares Nexus v6.0

### 1. Gestión de Canales Omnicanal
Se ha introducido el componente `ChannelSelector` directamente en el Wizard.
-   **Propósito**: Permitir al usuario decidir en tiempo real si un agente atiende en WhatsApp, Instagram, Facebook o el Web Widget.
-   **Sincronización**: El Wizard consulta `/admin/integrations/status` para deshabilitar canales que no tengan una conexión activa en Meta o TiendaNube.
-   **Persistencia**: Las selecciones se guardan en la columna `channels` (JSONB) y se mantienen sincronizadas entre el modal de pre-activación y el Wizard profundo.

### 2. Live Preview & Simulation (Protocol Omega)
La simulación de chat ha sido re-diseñada para mayor robustez bajo el Protocolo Omega.
-   **SSE Handling**: El backend ahora decodifica correctamente el flujo de tokens (Server-Sent Events) evitando burbujas vacías.
-   **Schema Consistency**: Se ha unificado la versión del esquema en la v6.0 entre el Orquestador y el Agent Service para evitar errores de incompatibilidad.
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
*   **Validación Backend**: El backend verifica que el `tenant_id` pertenezca al usuario (Resolviendo vía Tabla `users` para evitar Schema Drift).

#### C. Flujo de Persistencia (January 2026 Standard)
1.  **Frontend**: Form dinámico captura datos de Model, Tools y Wizard.
2.  **API Gateway**: El Orquestador recibe un JSON Payload masivo.
3.  **Pydantic Conversion**: `AgentModel` valida los tipos y limpia campos nulos.
4.  **DB Column Mapping**: 
    - Campos core (`model_version`, `enabled_tools`) van a columnas dedicadas.
    - Parámetros SOTA (`reasoning_effort`, `agent_tone`) se consolidan en la columna `config` (JSONB).

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

---

## 🧠 Evolución v7.6: Protocolo Assist Score

Nexus v7.6 evoluciona de ser un motor de respuesta a un sistema de **Generación de Valor Probable**.

### 1. Auto-Auditoría Neuronal
El sistema inyecta una regla de sistema (Core Rule) que obliga al agente a auditar su propio desempeño:
- **Tick de Evaluación**: Cada 3 mensajes recibidos del usuario, el agente debe detenerse internamente y calificar su ayuda.
- **Reasoning**: Debe justificar por qué se asigna puntos de `sales` (ayuda a conversión) o `support` (resolución de dudas).

### 2. Handshake Silencioso (`report_assistance`)
La comunicación de métricas no es visible para el usuario.
- **Tool Logic**: El agente llama a `report_assistance` de forma transparente.
- **Persistencia**: El Orquestador traduce el score en métricas ROI que alimentan el Dashboard CEO.

### 3. Aislamiento de Valor
Al igual que las credenciales, los scores están estrictamente ligados al `tenant_id`, asegurando que el ROI de una tienda no se mezcle con otra en los reportes globales.

---

**© 2026 Platform AI Solutions - Intelligence Division**

