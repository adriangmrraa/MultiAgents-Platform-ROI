# API Reference: System & Management (Nexus v6.0)

## Infraestructura y Control

### 🌐 Registro de Modelos 2026
`GET /admin/system/available-models`

Devuelve la lista de modelos de IA soportados, categorizados por su capacidad.
*   **Auth**: Requiere `X-Admin-Token`.
*   **Respuesta**:
    ```json
    {
      "default_model": "gpt-5-mini",
      "models": [
        { "id": "gpt-5.2", "tier": "flagship", "name": "GPT-5.2 (Flagship)" },
        { "id": "gpt-5-mini", "tier": "economy", "name": "GPT-5 Mini" },
        { "id": "gpt-5.2-pro", "tier": "premium", "name": "GPT-5.2 Pro" },
        { "id": "gpt-5.2-codex", "tier": "advanced", "name": "GPT-5.2 Codex" },
        { "id": "gemini-3-pro", "tier": "advanced", "name": "Gemini 3 Pro" },
        { "id": "gemini-3-flash", "tier": "economy", "name": "Gemini 3 Flash" }
      ]
    }
    ```

### 🔧 Inicialización de DB RAG
`GET /admin/system/init-db`

Disparador manual para el bootstrapper de Supabase/pgvector.
*   **Auth**: Requiere `X-Admin-Token`.
*   **Uso**: En caso de errores de "Table not found" o migraciones corruptas.

## Agentes (Gestión v6.0)

### 📋 Listar Agentes
`GET /admin/agents`
*   **Auth**: Requiere autenticación de usuario (`get_current_user`).
*   **Scope**: 
    - **SuperAdmin**: Ve todos los agentes de todos los tenants.
    - **Usuario regular**: Ve solo los agentes de su tenant.
*   **Respuesta**: Array de agentes con información del tenant.
    ```json
    [
      {
        "id": "uuid-123",
        "name": "Agente de Ventas (IA)",
        "role": "sales",
        "tenant_id": 1,
        "tenant_name": "Mi Tienda",
        "model_provider": "openai",
        "model_version": "gpt-4o",
        "temperature": 0.3,
        "is_active": true,
        "enabled_tools": ["search_specific_products", "create_order"],
        "channels": ["whatsapp", "instagram", "web"],
        "created_at": "2026-01-27T00:00:00Z"
      }
    ]
    ```
*   **Nota v6.2**: Este endpoint devuelve un **array vacío** `[]` si no hay agentes, evitando errores de frontend.

### 🤖 Crear Agente
`POST /admin/agents`
*   **Validación**: El campo `model_version` es validado contra el registry. Si el modelo no existe, se asigna `gpt-5-mini` automáticamente.

### 🔄 Actualizar Agente
`PUT /admin/agents/{id}`
*   **Evolución v6.0 Payload**:
    *   `model_provider`, `model_version` y `enabled_tools` viven en la **raíz** del JSON.
    *   `config` (JSONB) encapsula parámetros dinámicos: `reasoning_effort`, `text_verbosity`, `agent_tone`.
*   **Intelligent Sync**: Si cambias a un modelo **Premium/Flagship**, el sistema ajustará automáticamente los timeouts y filtros de razonamiento.

## Tenants (Gestión Multi-Inquilino)

### 📋 Listar Tenants
`GET /admin/tenants`
*   **Auth**: Requiere autenticación de usuario (`get_current_user`).
*   **Scope**:
    - **SuperAdmin**: Ve todos los tenants (límite configurable).
    - **Owner**: Ve solo tenants donde `owner_email` coincide con su email.
*   **Query Params**:
    - `limit` (opcional, default: 100): Número máximo de resultados.
*   **Respuesta**: Array de tenants (cambio en v6.2 - antes devolvía `{"tenants": [...]}`).
    ```json
    [
      {
        "id": 1,
        "store_name": "Mi Tienda",
        "bot_phone_number": "+5491112345678",
        "owner_email": "owner@example.com",
        "store_location": "Buenos Aires, Argentina",
        "store_website": "https://mitienda.com",
        "store_description": "Tienda de productos artesanales",
        "handoff_policy": {},
        "tiendanube_access_token": null
      }
    ]
    ```
*   **Seguridad**: El campo `tiendanube_access_token` siempre se devuelve como `null` por razones de seguridad.
*   **Breaking Change v6.2**: La respuesta ahora es un array directo en lugar de `{"tenants": [...]}` para consistencia con otros endpoints.


## Gestión de Conocimiento (Knowledge v6.0)

### 📤 Upload Document (RAG)
`POST /admin/knowledge/upload`
*   **Content-Type**: `multipart/form-data`
*   **Parámetros**:
    *   `file`: (Binary) Archivo PDF, DOCX, TXT.
    *   `collection`: (String) Nombre de la colección (ej. 'General', 'ADN Personal').
    *   `hero_name`: (String, Opcional) Nombre del Héroe para el `WhatsAppParser` si la colección es de identidad.

### 🗑️ Delete Document
`DELETE /admin/knowledge/{id}`
*   **Comportamiento Destructivo**: Esta operación es **irreversible** en Supabase.
*   **Performance**: Puede tardar 1-2 segundos en retornar mientras limpia los vectores embebidos del clúster de Supabase (pgvector).

## Integraciones Meta (Meta Service v6.1)

### 🔗 Connect OAuth
`POST /admin/meta/connect`
*   **Propósito**: Intercambio de códigos OAuth por tokens de larga duración.
*   **Payload**:
    ```json
    {
      "code": "AQC...",
      "redirect_uri": "https://...",
      "tenant_id": 123
    }
    ```

### 📩 Send Message (Social - FB/IG)
`POST /admin/meta/messages/send`
*   **Uso**: Envío de mensajes a Messenger e Instagram Direct (Graph API).
*   **Payload**:
    ```json
    {
      "recipient_id": "123456",
      "text": "Hola mundo",
      "access_token": "PAGE_TOKEN",
      "messaging_type": "RESPONSE"
    }
    ```

### 🟢 Send Message (WhatsApp Cloud API)
`POST /admin/meta/whatsapp/send`
*   **Uso**: Envío directo a WhatsApp Cloud API (WABA).
*   **Diferencia Clave**: Requiere `phone_number_id` y usa estructura `messaging_product`.
*   **Payload**:
    ```json
    {
      "recipient_id": "54911...",
      "text": "Hola WhatsApp",
      "access_token": "SYSTEM_USER_TOKEN",
      "phone_number_id": "100200..."
    }
    ```

### 🪝 Webhooks
`POST /admin/meta/webhook`
*   **Propósito**: Ingesta y normalización de eventos de Meta (Textos, Audios, Status Updates).
*   **Seguridad**: Verifica firma HMAC con `META_APP_SECRET`.

---

## APIs Internas (v6.2 - Inter-Service Communication)

### 🔐 Internal Credentials API
`GET /admin/internal/credentials/{name}`

API de alta seguridad para que los microservicios obtengan credenciales desencriptadas.
*   **Auth**: Requiere header `X-Internal-Token`.
*   **Query Params**: `tenant_id` (opcional) para scope de inquilino.
*   **Respuesta**:
    ```json
    {
      "name": "OPENAI_API_KEY",
      "value": "sk-proj-..."
    }
    ```

### 💬 Chatwoot Unified Webhook
`POST /admin/chatwoot/webhook`

Receiver central para eventos de Chatwoot (Instagram, Facebook, WebChat).
*   **Query Params**: `access_token` (requerido para validación de inquilino).
*   **Procesamiento v6.2**:
    - **Identity Fix**: Resuelve al cliente real ignorando ecos de agentes.
    - **Atomic Buffer**: Debouncing de mensajes en Redis (16s).
    - **AI Trigger**: Despierta al Orquestador automáticamente.

---

**© 2026 Platform AI Solutions - Sovereign Engine Core**
