# Nexus v6.0 Backend Technical Specification (Omnichannel Edition)

> **Purpose**: This document defines the absolute contracts for the Sovereign Credentials System and Multi-Tenant architecture. It serves as the single source of truth for Frontend-Backend integration under the **Sovereign Protocol**.

---

## 1. Authentication & Sovereign Security
The backend uses a triple-layer security model to protect tenant data and credentials.

### A. Admin API (`frontend_react` -> `orchestrator_service`)
All requests to `/admin/*` MUST include the **Admin Token**.
- **Header**: `X-Admin-Token`
- **Value**: Must match `ADMIN_TOKEN` env var in Orchestrator.

### B. Sovereign Credential Lookup (`app/core/credentials.py`)
The system follows a "Tenant-First" lookup strategy for sensitive keys.
1.  **Direct Fetch**: `get_tenant_credential(tenant_id, category, name)` is called.
2.  **Sovereign Check**: Searches the `credentials` table for the specific `tenant_id`.
3.  **Fallback**: Checks for platform-wide keys if scope is 'global'.
4.  **Decryption**: Values decrypted on-the-fly using `Fernet` (AES-256).

### C. Protocolo de Resolución de Tenant (Integral Strict Mode)
Due to legacy schema drift (Integer Tables vs UUID Auth), the code must **NEVER** trust `current_user.tenant_id` for SQL write operations.

**Mandatory Pattern for CRUD:**
1.  **Anchor**: Use `current_user.id` (UUID) which is the cryptographic source of truth.
2.  **Lookup**: Query the `users` table to get the REAL `tenant_id` (Integer).
    ```python
    # Source of Truth Lookup
    user_row = await db.pool.fetchrow("SELECT tenant_id FROM users WHERE id = $1", current_user.id)
    real_tenant_int = user_row['tenant_id']
    ```
3.  **Execute**: Use `real_tenant_int` for filtering `agents` or other integer-keyed tables.


---

## 2. Core API Endpoints (Admin)

### 🏬 Tenants & Configuration
**`GET /admin/tenants`**
- **Response**: `Array<Tenant>`
```json
[
  {
    "id": 1,
    "store_name": "Tienda Demo",
    "onboarding_status": "completed"
  }
]
```

### 🔑 Credentials Management (Sovereign Vault)
**`GET /admin/credentials`**
- **Response**: `Array<CredentialModel>` (Values are masked).

**`POST /admin/credentials`**
- **Payload**: `{"name": str, "value": str, "category": str, "scope": "global"|"tenant", "tenant_id": int}`
- **Categories**: `openai`, `google`, `tiendanube`, `smtp`, `whatsapp_cloud`.

### 🤖 Agents Management (v6.0)
**`PUT /admin/agents/{id}`**
- **Purpose**: Update an agent's brain, model, and tools.
- **Root Payload**:
  - `model_provider`: `str` (openai, google)
  - `model_version`: `str` (see Model Registry)
  - `enabled_tools`: `Array<str>`
  - `template_type`: `str` (default: 'custom')
  - `is_active`: `bool`
- **Config JSONB**:
  - `reasoning_effort`: `none` | `low` | `medium` | `high` (GPT-5 only)
  - `text_verbosity`: `concise` | `detailed` | `bullet_points`
  - `knowledge_config`: Custom RAG routing instructions.
  - `agent_tone`: User-editable personality.

---

### 💬 Chat Management
**`GET /admin/chats`**
- **Response**: `Array<ChatConversation>`
```json
[
  {
    "id": "uuid",
    "name": "Juan Perez",
    "last_message": "Hola...",
    "status": "open",
    "channel": "whatsapp"
  }
]
```

**`GET /admin/chats/{id}/messages`**
- **Response**: `Array<ChatMessage>`
```json
[
  {
    "id": "uuid",
    "role": "user",
    "content": "Message text",
    "timestamp": "ISO-Date"
  }
]
```

### 🧠 AI Intelligence (SOTA 2026)
**`POST /admin/ai/improve-prompt`**
- **Purpose**: Uses GPT-5.2 with tenant credentials to refine prompts.
- **Response**: `{"improved_text": "string"}`

**Model Support (January 2026):**
- **OpenAI**: `gpt-5.2` (Flagship), `gpt-5-mini` (Default), `gpt-5.2-codex`.
- **Google**: `gemini-3-pro` (1M Context), `gemini-3-flash`.

---

## 3. Data Models (Schema Reference)

### `credentials` (The Vault)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id_uuid` | UUID | Primary Key |
| `tenant_id` | Integer | Link to `tenants` or NULL for Global |
| `name` | Text | Identifier |
| `value` | Text | **Encrypted** (AES-256) |
| `category`| Text | `openai`, `google`, `smtp`, etc. |

### `business_assets` (Sovereign Assets)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `tenant_id` | Text | Partition Key |
| `content` | JSONB | Generated Data (SSOT) |

---

## 4. Hybrid SMTP Logic
The `EmailService` differentiates traffic:
- **`system` mode**: Uses platform env vars. For verification and handoffs.
- **`agent` mode**: Uses tenant-specific SMTP settings from the Vault.

---

---

## 5. Protocolo Omega de Visibilidad (SMTP Resiliency)
El backend implementa una captura de errores proactiva para el servicio de correo:
- **Detección de Blacklist**: Si el servidor SMTP devuelve errores 550 (bloqueo geográfico), el backend captura la excepción y la envía al frontend en el campo `message`.
- **Registro de Emergencia**: El link de verificación se imprime SIEMPRE en los logs del contenedor para permitir la activación manual en entornos de firewall restrictivos.
- **Frontend Aware**: La vista de registro detecta si `email_sent` es `false` y despliega un cuadro de alerta ámbar con el diagnóstico técnico.

---

## 6. Developer Guide: Protocol Omega

### Creating New Endpoints
1.  **Define Contract**: Use Pydantic `BaseModel`.
2.  **Register Router**: Use `@router` with `verify_admin_token` dependency.
3.  **Error Handling**: Raise `HTTPException` with clear detail.

---

## 7. Meta Uplink Protocol (v6.0)
The dedicated system for Sovereign Social Connection.

### A. The Diplomat (`meta_service`) & Triangular Routing (v6.1)
Platform AI Solutions now supports a **Triangular Routing Strategy** for messages:

1.  **Meta Direct (Preferred)**:
    -   **Social (FB/IG)**: Handled via Graph API (`/messages/send`).
    -   **WhatsApp**: Handled via Cloud API (`/whatsapp/send`) **[NEW]**.
2.  **Chatwoot (Human Gateway)**:
    -   Used if `provider='chatwoot'` or as fallback for Social channels.
3.  **YCloud (Legacy WhatsApp)**:
    -   Used if neither Meta nor Chatwoot are configured for WA.

**Microservice Specs (`meta_service`)**:
- **Port**: 8000 (Internal Only).
- **Communication**: HTTP JSON.
- **Security**: `INTERNAL_SECRET_KEY` header required for all inter-service calls.

### B. Endpoints (Orchestrator -> Meta)
**`POST /admin/meta/connect`**
- **Purpose**: Init OAuth exchange.
- **Payload**:
  ```json
  {
    "code": "auth_code_from_fb_sdk",
    "redirect_uri": "must_match_origin",
    "tenant_id": 123 // Optional (SuperAdmin Only)
  }
  ```
- **Flow**:
  1. Orchestrator verifies Admin Token.
  2. Orchestrator resolves `tenant_id` (Self or Explicit).
  3. Orchestrator proxies to `http://meta_service:8000/connect`.
  4. Meta Service exchanges Code -> Short Token -> **Long-Lived Token (60 days)**.
  5. Meta Service fetches Assets (Pages, IG, WA).
  6. Meta Service calls back `/credentials/internal-sync` to persist data.

### C. Sovereign Persistence
Tokens are NEVER stored in the browser alongside the session. They are immediately escalated to System User tokens and vaulted in `credentials` (Encrypted).

---

---

## 8. Shadow Indexing Worker

*   **Propósito**: Ingesta pasiva de chats para el Shadow RAG.
*   **Trigger**: Evento `message.created`.
*   **Lógica**: Si `SHADOW_RAG_ENABLED=True`, el worker vectoriza el mensaje asíncronamente y lo etiqueta con el `circle` del contacto.
*   **Seguridad**: Usa la `SOVEREIGN_OPENAI_KEY` del tenant para generar los embeddings.

---

**© 2026 Platform AI Solutions - Sovereign Architecture Division**
