# Nexus v5.1 Backend Technical Specification (Sovereign Edition)

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

### 🧠 AI Intelligence
**`POST /admin/ai/improve-prompt`**
- **Purpose**: Uses GPT-4o with tenant credentials to refine prompts.
- **Response**: `{"improved_text": "string"}`

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

**© 2026 Platform AI Solutions - Sovereign Architecture Division**
