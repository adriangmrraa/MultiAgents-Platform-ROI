# Nexus v4.2 Backend Technical Specification (Protocol Omega)

> **Purpose**: This document serves as the absolute reference for Frontend-Backend integration. It defines the expected contracts, authentication methods, and data filtering logic to prevent "Ghost Code" or mapping errors.

---

## 1. Authentication & Security
The backend uses a dual-layer security model ("Bunker Mode").

### A. Admin API (`frontend_react` -> `orchestrator_service`)
All requests to `/admin/*` MUST include the **Admin Token**.
- **Header**: `X-Admin-Token`
- **Value**: Must match `ADMIN_TOKEN` env var in Orchestrator.
- **Frontend Source**: `window.env.ADMIN_TOKEN` or `import.meta.env.VITE_ADMIN_TOKEN`.

### B. Service-to-Service (`agent_service` <-> `orchestrator`)
Internal microservices communicate via a secret handshake.
- **Header**: `X-Internal-Secret`
- **Value**: Must match `INTERNAL_API_TOKEN` env var.
- **Note**: The Frontend SHOULD NEVER use this header.

---

## 2. Core API Endpoints (Admin)

### 🏬 Tenants & Configuration
**`GET /admin/tenants`**
- **Purpose**: Load the list of stores for the sidebar and filters.
- **Response**: `Array<Tenant>`
```json
[
  {
    "id": 1,                // Integer (Legacy ID)
    "store_name": "Tienda Demo"
  }
]
```
> **Critical Note**: Do NOT expect a `platform` column. It does not exist.

### 💬 Chat Management
**`GET /admin/chats`**
- **Query Params**:
  - `tenant_id` (optional): Filter to specific store.
  - `channel` (optional): `whatsapp`, `instagram`, `facebook`.
- **Response**: `Array<ChatConversation>`
```json
[
  {
    "id": "uuid-string-here",          // UUID (Strict Omega)
    "name": "Juan Perez",              // Normalized Display Name
    "last_message": "Hola...",         // Text preview
    "timestamp": "2023-10-27T...",     // ISO String
    "status": "open",                  // open | human_handling | human_override
    "is_locked": false,                // Derived from human_override_until
    "channel": "whatsapp",
    "avatar_url": "https://..."
  }
]
```
> **Mapping Rule**: The frontend uses `name` -> `display_name` -> `external_user_id` as fallback priority.

**`GET /admin/chats/summary`**
- **Purpose**: Efficiently load the chat list with summary info (Protocol Omega).
- **Query Params**: `tenant_id`, `limit`, `channel`.
- **Response**: `Array<ChatSummary>` (Same structure as `/admin/chats` but optimized).

**`GET /admin/chats/{conversation_id}/messages`**
- **Params**: `conversation_id` (UUID).
- **Response**: `Array<ChatMessage>`
```json
[
  {
    "id": "uuid-string",
    "role": "user",                    // user | assistant | system
    "content": "Message text",         // Can be null if media-only
    "media": {                         // Optional
        "url": "https://...",
        "type": "image"                // image | video | audio
    },
    "timestamp": "ISO-Date"
  }
]
```
> **Safety**: Always check `msg.content` before using string methods like `.match()`.

### 📊 Telemetry & Diagnostics
**`GET /admin/stats`**
- **Response**: `StatsObject`
```json
{
  "active_chats": 12,
  "messages_processed": 1500,
  "errors_24h": 0
}
```

**`GET /admin/health`**
- **Response**: `{"status": "ok", "db": "connected", "redis": "connected"}`

---

## 3. Data Models (Schema Reference)

### `customers` (PostgreSQL) - v4.2 Strict
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `tenant_id` | Integer | Partition Key |
| `phone_number` | Varchar | **Nullable** (v4.2). Unique per Tenant. |
| `instagram_psid`| Varchar | **Nullable**. Unique per Tenant. |
| `facebook_psid` | Varchar | **Nullable**. Unique per Tenant. |

### `chat_conversations` (PostgreSQL)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key (Strict) |
| `tenant_id` | Integer | Link to `tenants` table |
| `customer_id` | UUID | Link to `customers` (Identity Link) |
| `human_override_until`| Timestamp | If > NOW(), chat is locked for AI |
| `channel_source` | Varchar | `whatsapp`, `instagram`, `facebook` |
| `meta` | JSONB | Extended context (e.g., ticket IDs) |

### `chat_messages`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique Message ID |
| `message_type` | Varchar | `text`, `image`, `audio`, `video` |
| `human_override` | Boolean | True if handled by human agent |
| `channel_source` | Varchar | Origin channel for this specific message |
| `meta` | JSONB | Message-specific metadata |

---

## 4. Frontend Integration Best Practices

### Dynamic Base URL
The frontend MUST NOT use hardcoded URLs (e.g., `localhost:8000`). It must use the `useApi` hook which implements the **Triple Redundancy** protocol:
1.  **Injected**: `window.env.API_BASE_URL` (Runtime, easy for Docker).
2.  **Env Var**: `VITE_API_BASE_URL` (Build time).
3.  **Inference**: `/api` (Relative path for Nginx proxies).

### Error Boundaries
- **500 Internal Server Error**: Usually means a SQL query failed (e.g., missing column). Check `admin_routes.py`.
- **401 Unauthorized**: Token mismatch. Check `X-Admin-Token`.
- **404 Not Found**: Endpoint mismatch. Verify `/admin/` prefix.

---

## 5. Developer Guide: Communication Protocol (Backend)

### How to Create & Expose New Endpoints
To establish a new communication channel with the frontend, follow this **Protocol Omega** workflow in `admin_routes.py`:

#### 1. Define the Data Contract (Input/Output)
Use Pydantic `BaseModel` to strictly define what you accept and return.
```python
class NewFeatureRequest(BaseModel):
    tenant_id: int
    data_payload: Dict[str, Any]

class NewFeatureResponse(BaseModel):
    status: str
    processed_id: str
```

#### 2. Register the Router
Always use the `router` object and enforce the `verify_admin_token` dependency.
```python
@router.post("/new-feature", dependencies=[Depends(verify_admin_token)])
async def handle_new_feature(request: NewFeatureRequest):
    # Logic Here
    return {"status": "success", "processed_id": "123"}
```

#### 3. Sending Data to Frontend
- **JSON Default**: FastAPI automatically converts dictionaries/Wait Pydantic models to JSON.
- **Status Codes**: Raise `HTTPException` for errors. The frontend `useApi` hook catches these.
  ```python
  if not found:
      raise HTTPException(status_code=404, detail="Item not found")
  ```

#### 4. Handling CORS
**Do not manually add CORS headers.** The main application (`main.py`) configures `CORSMiddleware` globally.
- Ensure `CORS_ALLOWED_ORIGINS` env var includes the frontend domain in production.
- In `app` mode (EasyPanel), they share the same domain space via relative paths (`/api`), bypassing CORS.

**© 2025 Platform AI Solutions - Architecture Division**
