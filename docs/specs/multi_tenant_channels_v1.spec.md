# Specification: Multi-Tenant Channel Isolation Architecture

## 1. Goal
To enable a true Multi-Tenant architecture where each Tenant (Store) has its own isolated set of communication channels (WhatsApp, Instagram, etc.).
**Constraint**: A specific external channel (e.g., a WhatsApp Phone Number or WABA ID) can be bound to **only one** Tenant at a time. This prevents data leaks and routing ambiguity.

## 2. Business Logic (Gherkin)

```gherkin
Feature: Channel Isolation

  Scenario: User binds a YCloud account to Store A
    Given a user has a YCloud WABA ID "waba_123"
    And "waba_123" is NOT bound to any tenant
    When the user adds this channel to "Store A"
    Then the system creates a binding: "waba_123" -> "Store A"

  Scenario: User tries to bind the same YCloud account to Store B
    Given "waba_123" is already bound to "Store A"
    When the user tries to add "waba_123" to "Store B"
    Then the system rejects the request with "Channel already in use by another store"

  Scenario: Incoming Webhook Routing
    Given an incoming message from YCloud for WABA ID "waba_123"
    And "waba_123" is bound to "Store A"
    When the `whatsapp_service` processes the message
    Then it routes the payload specifically to "Store A" context
    And uses "Store A" credentials for the reply
```

## 3. Data Schema

### New Table: `channel_bindings`
This table acts as the "Switchboard" for the platform.

```sql
CREATE TABLE channel_bindings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'ycloud', 'meta', 'chatwoot'
    channel_id VARCHAR(100) NOT NULL, -- The unique external ID (e.g., 'waba_123', 'phone_number', 'page_id')
    
    label VARCHAR(100), -- User-friendly name (e.g., "Soporte Ventas")
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (provider, channel_id) -- CRITICAL: Enforces 1:1 binding globaly
);

CREATE INDEX idx_channel_lookup ON channel_bindings(provider, channel_id);
```

## 4. API Spec (Orchestrator)

### `GET /admin/channels/bindings`
Returns all channels bound to the current tenant.

**Response:**
```json
{
  "bindings": [
    {
      "id": 1,
      "provider": "ycloud",
      "channel_id": "123456789",
      "label": "Main WhatsApp",
      "created_at": "2024-01-27T10:00:00Z"
    }
  ]
}
```

### `POST /admin/channels/bind`
Binds a new channel to the current tenant.

**Payload:**
```json
{
  "provider": "ycloud",
  "channel_id": "123456789", 
  "label": "Main WhatsApp"
}
```

**Validation:**
- Check if `(provider, channel_id)` exists in `channel_bindings`.
- If yes -> Return 409 Conflict: `{"error": "Channel already bound to another store"}`.
- If no -> Create binding and log audit event.

### `DELETE /admin/channels/unbind/{id}`
Removes the binding, freeing the channel to be used by another tenant.

**Security:**
- Verify tenant ownership before deletion.
- Log unbind event with actor information.

### `GET /internal/routing/resolve` (NEW - Critical)
**Purpose**: Centralized tenant resolution for all microservices.

**Security**: Requires `X-Internal-Token` header with `INTERNAL_SECRET_KEY`.

**Query Parameters:**
- `provider`: string (ycloud, meta, chatwoot)
- `channel_id`: string (WABA ID, Phone Number, Page ID)

**Response (Success):**
```json
{
  "tenant_id": 1,
  "tenant_name": "Store A",
  "resolved_at": "2024-01-27T10:00:00Z"
}
```

**Error Cases:**
- 404: Channel not found or not bound
- 401: Invalid INTERNAL_SECRET_KEY

**Performance**: This endpoint MUST be cached (Redis, 5min TTL) to handle high webhook volumes.

---

## 5. Security Enhancements (Industry Best Practices)

### 5.1 Row-Level Security (RLS)
To prevent data leakage if application-level filtering is forgotten, enable PostgreSQL RLS:

```sql
ALTER TABLE channel_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON channel_bindings
  USING (tenant_id = current_setting('app.current_tenant_id')::int);
```

**Usage in Application:**
```python
# Before executing tenant-scoped queries
await db.pool.execute("SET app.current_tenant_id = $1", tenant_id)
```

### 5.2 Tenant Context Propagation
**Standard**: All inter-service HTTP calls MUST include:
```http
X-Tenant-ID: 1
X-Correlation-ID: <uuid>
```

**Example (WhatsApp Service -> Orchestrator):**
```python
headers = {
    "X-Internal-Token": INTERNAL_SECRET_KEY,
    "X-Tenant-ID": str(tenant_id),
    "X-Correlation-ID": correlation_id
}
resp = await client.get(f"{ORCHESTRATOR_URL}/internal/routing/resolve", headers=headers)
```

### 5.3 Audit Logging
Log all critical operations with tenant context:

```python
logger.info("channel_binding_created", extra={
    "tenant_id": tenant_id,
    "provider": "ycloud",
    "channel_id": "waba_123",
    "actor": current_user.email,
    "timestamp": datetime.utcnow().isoformat()
})
```

**Required Log Events:**
- `channel_binding_created`
- `channel_binding_deleted`
- `tenant_resolution_success`
- `tenant_resolution_failed` (404 cases)
- `credential_access` (when fetching tenant credentials)

---

## 6. Service Logic Updates

### `whatsapp_service`
**Current Logic (Faulty - v6.2.26)**:
- Tries Global Config.
- Fallback to Tenant 1. ❌ **WRONG FOR MULTI-TENANT**

**New Logic (Strict Routing - v7.0)**:
1.  Receive Webhook from YCloud.
2.  Extract `waba_id` or `phone_number_id` from payload.
3.  **Call Tenant Resolution Endpoint**:
    ```python
    resp = await client.get(
        f"{ORCHESTRATOR_URL}/internal/routing/resolve",
        params={"provider": "ycloud", "channel_id": waba_id},
        headers={"X-Internal-Token": INTERNAL_SECRET_KEY}
    )
    if resp.status_code == 404:
        logger.warning("unbound_channel", channel_id=waba_id)
        return JSONResponse({"error": "Channel not configured"}, status_code=404)
    
    tenant_id = resp.json()["tenant_id"]
    ```
4.  Fetch tenant-specific credentials using `tenant_id`.
5.  Process message in tenant context.

### `meta_service` (Similar Changes)
Apply same pattern for Instagram/Facebook:
- Extract `page_id` from webhook.
- Resolve `tenant_id` via `/internal/routing/resolve?provider=meta&channel_id={page_id}`.

---

## 7. Implementation Steps (Revised)
1.  **DB Migration**: 
    - Create `channel_bindings` table.
    - Enable Row-Level Security (RLS).
2.  **Orchestrator**: 
    - Implement CRUD endpoints (`/admin/channels/*`).
    - Implement Internal Routing endpoint (`/internal/routing/resolve`).
    - Add Redis caching for resolution endpoint.
3.  **Frontend**: 
    - Build "Channels" page (list/add/delete bindings).
    - Update UI to require channel binding before showing settings.
4.  **Services**: 
    - Update `whatsapp_service` to use resolution endpoint.
    - Update `meta_service` to use resolution endpoint.
    - Remove all hardcoded "Tenant 1" fallbacks.
5.  **Testing**:
    - Unit tests for resolution endpoint (200, 404, 401 cases).
    - Integration test: Send webhook to unbound channel -> Verify 404.
    - Load test: Resolution endpoint with 1000 req/s.

---

## 8. Migration Path (Breaking Change)
This is a **breaking change** for existing deployments.

**Migration Script:**
```sql
-- Step 1: Create table
CREATE TABLE channel_bindings (...);

-- Step 2: Auto-migrate existing channels
INSERT INTO channel_bindings (tenant_id, provider, channel_id, label)
SELECT 
    1 as tenant_id, -- Assume all existing channels belong to Tenant 1
    'ycloud' as provider,
    bot_phone_number as channel_id,
    'Legacy WhatsApp' as label
FROM tenants
WHERE bot_phone_number IS NOT NULL;

-- Step 3: Notify users to review bindings
```

**User Communication:**
> "🚨 **Action Required**: We've upgraded to Multi-Tenant Channel Isolation. Please review your channel bindings in Settings > Channels and confirm your configurations."
