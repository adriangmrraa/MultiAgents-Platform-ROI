# Spec: Production Readiness — 25 Critical Fixes
**Change name**: `production-readiness`
**Date**: 2026-04-03
**Status**: READY FOR IMPLEMENTATION
**Phases**: 4 implementation batches

---

## Summary

25 confirmed issues organized into 4 implementation phases:
- **Phase 1 — Security (BLOCKING)**: PROD-01 through PROD-07
- **Phase 2 — Infrastructure (HIGH)**: PROD-08 through PROD-16
- **Phase 3 — Hardening (HIGH/MEDIUM)**: PROD-17 through PROD-21
- **Phase 4 — DX / Completeness (MEDIUM)**: PROD-22 through PROD-25

---

## Phase 1 — Security (BLOCKING)

---

### PROD-01: CORS Origin Reflection in Exception Handlers
**Severity**: BLOCKING
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/main.py` (lines 1716–1727)
- `orchestrator_service/app/middleware/subscription_guard.py` (lines 62–72)

**Current behavior**:
`global_exception_handler` reflects any `Origin` header verbatim:
```python
origin = request.headers.get("origin")
if origin:
    response.headers["Access-Control-Allow-Origin"] = origin
```
`SubscriptionGuardMiddleware._block_response()` does the same:
```python
origin = request.headers.get("origin", "*")
return JSONResponse(..., headers={"Access-Control-Allow-Origin": origin, ...})
```
Any attacker-controlled origin is reflected back, bypassing CORS policy.

**Required behavior**:
Both handlers must validate the origin against `settings.CORS_ALLOWED_ORIGINS`. Only reflect if it is in the allowlist. Otherwise omit the CORS header entirely.

**Implementation**:
1. In `orchestrator_service/main.py`, replace the `global_exception_handler` origin logic:
```python
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error=str(exc))
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )
    origin = request.headers.get("origin")
    allowed = settings.CORS_ALLOWED_ORIGINS if isinstance(settings.CORS_ALLOWED_ORIGINS, list) else []
    if origin and origin in allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response
```
2. In `orchestrator_service/app/middleware/subscription_guard.py`, replace `_block_response`:
```python
def _block_response(self, request: Request, status_code: int, content: dict) -> JSONResponse:
    origin = request.headers.get("origin")
    allowed = settings.CORS_ALLOWED_ORIGINS if isinstance(settings.CORS_ALLOWED_ORIGINS, list) else []
    cors_origin = origin if (origin and origin in allowed) else None
    headers = {}
    if cors_origin:
        headers["Access-Control-Allow-Origin"] = cors_origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(status_code=status_code, content=content, headers=headers)
```

**Acceptance criteria**:
- [ ] `global_exception_handler` only reflects origins present in `settings.CORS_ALLOWED_ORIGINS`
- [ ] `_block_response` only reflects origins present in `settings.CORS_ALLOWED_ORIGINS`
- [ ] A request with `Origin: https://evil.com` does NOT receive `Access-Control-Allow-Origin: https://evil.com`
- [ ] A request from a legitimate allowed origin still receives the correct CORS header

**Dependencies**: PROD-14 (CORS_ALLOWED_ORIGINS default must be empty in production)

---

### PROD-02: BFF Service Accepts Any CORS Origin
**Severity**: BLOCKING
**Service**: bff_service
**Files**:
- `bff_service/src/index.ts` (lines 14–19)

**Current behavior**:
```typescript
app.use(cors({
    origin: true,   // reflects ANY origin unconditionally
    credentials: true,
    ...
}));
```
`origin: true` in express-cors reflects the requesting origin verbatim, equivalent to a wildcard with credentials. This is a critical security misconfiguration.

**Required behavior**:
Replace `origin: true` with an explicit allowlist parsed from `ALLOWED_ORIGINS` environment variable.

**Implementation**:
1. At startup in `bff_service/src/index.ts`, replace the cors configuration:
```typescript
const ALLOWED_ORIGINS_RAW = process.env.ALLOWED_ORIGINS || '';
const ALLOWED_ORIGINS: string[] = ALLOWED_ORIGINS_RAW
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser requests (server-to-server, health checks)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-tenant-id', 'x-signature']
}));
```
2. Add `ALLOWED_ORIGINS` to `docker-compose.yml` bff_service environment block.
3. Add `ALLOWED_ORIGINS` to `render.yaml` bff-service envVars.

**Acceptance criteria**:
- [ ] `origin: true` removed from BFF CORS config
- [ ] Requests from unlisted origins receive 403 from CORS middleware
- [ ] Requests from origins in `ALLOWED_ORIGINS` are allowed
- [ ] `ALLOWED_ORIGINS` env var is documented in `.env.example`

**Dependencies**: none

---

### PROD-03: Admin Token Exposed in Frontend Bundle
**Severity**: BLOCKING
**Service**: frontend_react
**Files**:
- `frontend_react/src/hooks/useApi.ts` (line 4, line 52)

**Current behavior**:
```typescript
export const ADMIN_TOKEN = import.meta.env.VITE_API_ADMIN_TOKEN || import.meta.env.VITE_ADMIN_TOKEN || "";
// ...
const headers: Record<string, string> = {
    'x-admin-token': ADMIN_TOKEN,
    'x-user-email': userEmail,
    ...
};
```
`VITE_*` variables are baked into the JavaScript bundle at build time. Any user opening DevTools can read the admin token. The frontend should never hold or send admin-level credentials.

**Required behavior**:
Remove `ADMIN_TOKEN` entirely from `useApi.ts`. The `x-admin-token` header must never be sent from the browser. Auth is handled via HttpOnly JWT cookie (`credentials: 'include'` is already present). The BFF layer is responsible for injecting internal tokens server-to-server (see PROD-04).

**Implementation**:
1. Delete line 4 from `useApi.ts`:
```typescript
// REMOVE THIS LINE:
export const ADMIN_TOKEN = import.meta.env.VITE_API_ADMIN_TOKEN || import.meta.env.VITE_ADMIN_TOKEN || "";
```
2. Remove `'x-admin-token': ADMIN_TOKEN` from the headers object in `fetchApi` (line 52).
3. Remove `VITE_API_ADMIN_TOKEN` and `VITE_ADMIN_TOKEN` from any `.env*` files and documentation.
4. Verify no other frontend file imports `ADMIN_TOKEN` from `useApi`.
5. All admin-proxied routes now rely on the session cookie validated in PROD-04.

**Acceptance criteria**:
- [ ] `ADMIN_TOKEN` export removed from `useApi.ts`
- [ ] `x-admin-token` header no longer sent in any browser request
- [ ] `VITE_API_ADMIN_TOKEN` and `VITE_ADMIN_TOKEN` removed from all env files
- [ ] No `VITE_*ADMIN*` vars appear in the built JS bundle

**Dependencies**: PROD-04

---

### PROD-04: BFF Injects Admin Token Without Session Validation
**Severity**: BLOCKING
**Service**: bff_service
**Files**:
- `bff_service/src/index.ts` (lines 11, 66–68, 128–130, 156–158)

**Current behavior**:
The BFF reads `ADMIN_TOKEN` from its environment and forwards it unconditionally in every request to the orchestrator:
```typescript
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// ...
headers: { 'x-admin-token': ADMIN_TOKEN }
```
No session validation is performed. Any anonymous caller that reaches the BFF gets orchestrator admin access.

**Required behavior**:
Before forwarding the `x-admin-token` to the orchestrator, the BFF must validate the caller has a valid session by forwarding the JWT cookie to `GET /auth/me` on the orchestrator.

**Implementation**:
1. Create a session validation middleware in `bff_service/src/index.ts`:
```typescript
async function requireValidSession(req: Request, res: Response, next: Function) {
    const cookieHeader = req.headers['cookie'] || '';
    if (!cookieHeader) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        const verifyRes = await axios.get(`${ORCHESTRATOR_URL}/auth/me`, {
            headers: { cookie: cookieHeader },
            timeout: 5000,
        });
        if (verifyRes.status !== 200) {
            return res.status(401).json({ error: 'Invalid session' });
        }
        next();
    } catch (err: any) {
        if (err.response?.status === 401) {
            return res.status(401).json({ error: 'Session expired' });
        }
        return res.status(503).json({ error: 'Auth service unavailable' });
    }
}
```
2. Apply `requireValidSession` to all routes that forward `x-admin-token`:
```typescript
app.get('/api/engine/stream/:tenantId', requireValidSession, async (req, res) => { ... });
app.get('/api/engine/stream/global', requireValidSession, async (req, res) => { ... });
```
3. The admin token remains in the BFF environment only — never in the browser.

**Acceptance criteria**:
- [ ] BFF validates session cookie via `/auth/me` before injecting `x-admin-token`
- [ ] Anonymous requests to BFF admin routes return 401
- [ ] Requests with valid session cookie are forwarded with `x-admin-token`
- [ ] `ADMIN_TOKEN` is NOT in any frontend env var

**Dependencies**: PROD-03

---

### PROD-05: META_VERIFY_TOKEN Has Insecure Default Value
**Severity**: BLOCKING
**Service**: meta_service
**Files**:
- `meta_service/main.py` (line 14)
- `docker-compose.yml` (line 115)

**Current behavior**:
```python
# meta_service/main.py
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "nexus_verification_token")
```
```yaml
# docker-compose.yml
- META_VERIFY_TOKEN=${META_VERIFY_TOKEN:-nexus_verification_token}
```
The default `"nexus_verification_token"` is public knowledge (in README, docs, LAUNCH_CHECKLIST.md). Any attacker who knows this default can spoof Meta webhook challenge verifications.

**Required behavior**:
Remove all default values. The service must fail at startup with a clear error if `META_VERIFY_TOKEN` is not set.

**Implementation**:
1. In `meta_service/main.py`, replace line 14:
```python
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN")
if not META_VERIFY_TOKEN:
    raise RuntimeError(
        "META_VERIFY_TOKEN environment variable is required. "
        "Set it to a secure random string matching your Meta App Dashboard webhook configuration."
    )
```
2. In `docker-compose.yml`, replace:
```yaml
- META_VERIFY_TOKEN=${META_VERIFY_TOKEN:-nexus_verification_token}
```
with:
```yaml
- META_VERIFY_TOKEN=${META_VERIFY_TOKEN}
```
3. Update `.env.example` to include `META_VERIFY_TOKEN=` with generation comment.

**Acceptance criteria**:
- [ ] `meta_service` fails at startup with `RuntimeError` if `META_VERIFY_TOKEN` is not set
- [ ] No default value `nexus_verification_token` exists in code or docker-compose
- [ ] `render.yaml` uses `generateValue: true` for `META_VERIFY_TOKEN` — already correct

**Dependencies**: none

---

### PROD-06: Meta Webhook Signature Verification Bypassable
**Severity**: BLOCKING
**Service**: meta_service
**Files**:
- `meta_service/core/webhooks.py` (lines 27–45)
- `meta_service/main.py` (line 15)

**Current behavior**:
```python
async def verify_signature(self, request: Request):
    signature = request.headers.get("X-Hub-Signature-256")
    if not signature:
        if not self.app_secret:
            return  # BYPASS: no signature AND no secret = silently allowed
        raise HTTPException(status_code=403, detail="Missing signature")
```
If `META_APP_SECRET` is not configured, any request without a signature header passes through. This completely disables webhook authentication.

**Required behavior**:
`META_APP_SECRET` must be required at startup. Signature verification must always run. Remove the bypass.

**Implementation**:
1. In `meta_service/main.py`, after line 15, add startup validation:
```python
META_APP_SECRET = os.getenv("META_APP_SECRET")
if not META_APP_SECRET:
    raise RuntimeError(
        "META_APP_SECRET environment variable is required. "
        "Set it to your Meta App Secret from the Meta Developer Dashboard."
    )
```
2. In `meta_service/core/webhooks.py`, replace `verify_signature`:
```python
async def verify_signature(self, request: Request):
    """Validates X-Hub-Signature-256 header. Always enforced — no bypass."""
    if not self.app_secret:
        raise HTTPException(
            status_code=503,
            detail="Webhook signature verification not configured"
        )

    signature = request.headers.get("X-Hub-Signature-256")
    if not signature:
        raise HTTPException(status_code=403, detail="Missing X-Hub-Signature-256 header")

    body = await request.body()
    expected = hmac.new(
        self.app_secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(f"sha256={expected}", signature):
        raise HTTPException(status_code=403, detail="Invalid signature")
```
3. Note: Current code uses `hmac.new(...)` — verify this is `hmac.HMAC` alias or correct API call in Python's `hmac` module. Correct call is `hmac.new(key, msg, digestmod)` which is valid.

**Acceptance criteria**:
- [ ] `meta_service` fails at startup if `META_APP_SECRET` is not set
- [ ] All POST webhook requests are rejected with 403 if `X-Hub-Signature-256` is missing
- [ ] All POST webhook requests with invalid signatures are rejected with 403
- [ ] The `if not self.app_secret: return` bypass is removed

**Dependencies**: none

---

### PROD-07: WhatsApp Webhook Secret Race Condition
**Severity**: BLOCKING
**Service**: whatsapp_service
**Files**:
- `whatsapp_service/main.py` (lines 301–319)

**Current behavior**:
```python
global YCLOUD_WEBHOOK_SECRET
YCLOUD_WEBHOOK_SECRET = await get_config("YCLOUD_WEBHOOK_SECRET", tenant_id=tenant_id)
# ...
expected = hmac.new(YCLOUD_WEBHOOK_SECRET.encode("utf-8"), ...).hexdigest()
```
The function mutates a module-level global `YCLOUD_WEBHOOK_SECRET`. Under concurrent requests for different tenants, request A can overwrite the global with tenant A's secret, then request B reads the global after it was overwritten — verifying tenant B's signature against tenant A's secret.

**Required behavior**:
The secret must be a local variable within `verify_signature`. Remove the `global` mutation entirely.

**Implementation**:
1. Refactor `verify_signature` to use a local variable:
```python
async def verify_signature(request: Request):
    # ... parse and validate t, s (unchanged) ...
    # ... resolve tenant_id (unchanged) ...

    # LOCAL variable — no global mutation
    webhook_secret = await get_config("YCLOUD_WEBHOOK_SECRET", tenant_id=tenant_id)

    if not webhook_secret:
        logger.error("missing_tenant_webhook_secret", tenant_id=tenant_id)
        raise HTTPException(503, detail=f"Webhook secret not configured for tenant {tenant_id}")

    signed_payload = f"{t}.{raw_body.decode('utf-8')}"
    expected = hmac.new(
        webhook_secret.encode("utf-8"),  # local variable
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, s):
        raise HTTPException(status_code=401, detail="Invalid signature")
```
2. Remove `global YCLOUD_WEBHOOK_SECRET` statement (line 301).
3. The module-level `YCLOUD_WEBHOOK_SECRET = os.getenv(...)` at line 130 may remain as an initialization value but must NOT be mutated by `verify_signature`.

**Acceptance criteria**:
- [ ] `global YCLOUD_WEBHOOK_SECRET` statement removed from `verify_signature`
- [ ] `webhook_secret` is a local variable within the function scope
- [ ] Concurrent requests for different tenants use independent secret values
- [ ] Behavior is functionally identical for single-tenant deployments

**Dependencies**: none

---

## Phase 2 — Infrastructure (HIGH)

---

### PROD-08: Frontend Docker Port Mismatch
**Severity**: HIGH
**Service**: frontend_react
**Files**:
- `docker-compose.yml` (line 22)
- `frontend_react/Dockerfile` (line 34: `EXPOSE 8080`)
- `frontend_react/nginx.conf` (line 2: `listen 8080`)

**Current behavior**:
```yaml
platform_ui:
  ports:
    - "80:80"   # Maps host:80 → container:80
```
But nginx listens on port 8080 and the Dockerfile exposes 8080. Container port 80 is never bound. The service appears to start but is unreachable via browser.

**Required behavior**:
Port mapping must match nginx's actual listen port: `"80:8080"`.

**Implementation**:
1. In `docker-compose.yml`, change:
```yaml
ports:
  - "80:8080"
```
2. No changes to `nginx.conf` or `Dockerfile` — they are correct at 8080.

**Acceptance criteria**:
- [ ] `docker-compose.yml` uses `"80:8080"` for `platform_ui`
- [ ] `curl http://localhost:80` successfully reaches the nginx server
- [ ] nginx access logs show requests arriving

**Dependencies**: none

---

### PROD-09: Orchestrator Dockerfile Migration Failure Is Swallowed
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/Dockerfile` (line 32)

**Current behavior**:
```dockerfile
CMD sh -c "echo 'Running migrations...' && alembic upgrade head 2>&1; echo 'Starting server...' && uvicorn main:app ..."
```
The `;` separator means the server starts regardless of whether migrations succeeded. A failed migration is silently ignored and the service boots against a broken schema.

**Required behavior**:
Use `&&` so the server only starts if migrations succeed. A failed migration must cause the container to exit non-zero.

**Implementation**:
1. In `orchestrator_service/Dockerfile`, change line 32:
```dockerfile
CMD ["sh", "-c", "echo 'Running migrations...' && alembic upgrade head && echo 'Starting server...' && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
```

**Acceptance criteria**:
- [ ] Container exits non-zero if `alembic upgrade head` fails
- [ ] Server does NOT start if migration fails
- [ ] Docker healthcheck detects the failure and triggers restart policy

**Dependencies**: none

---

### PROD-10: Hardcoded Client-Specific URLs in Source Code
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/app/core/config.py` (lines 187–191)
- `orchestrator_service/app/core/engine.py` (lines 74–76)
- `orchestrator_service/admin_routes.py` (line 4078)

**Current behavior**:
```python
# config.py — hardcoded easypanel URLs as CORS default
CORS_ALLOWED_ORIGINS: Any = [
    "https://multiagents-frontend.yn8wow.easypanel.host",
    ...
]

# engine.py — hardcoded client-specific URL in service discovery
"https://multiagents-tiendanube-service.yn8wow.easypanel.host",

# admin_routes.py line 4078
wa_url = "http://whatsapp_service:8002"  # hardcoded, ignores env var
```
These hardcode a specific customer's infrastructure. Any new deployment silently has wrong CORS and service URLs.

**Required behavior**:
All service URLs must come from environment variables. All client-specific domains must be removed.

**Implementation**:
1. `config.py` CORS default — handled by PROD-14 (change to `[]`).
2. In `orchestrator_service/app/core/engine.py`, replace the `potential_urls` list:
```python
tiendanube_service_url = os.getenv("TIENDANUBE_SERVICE_URL", "http://tiendanube_service:8003")
potential_urls = [
    tiendanube_service_url,
    tiendanube_service_url.replace("tiendanube_service", "tiendanube-service"),
]
```
3. In `orchestrator_service/admin_routes.py` line 4078:
```python
wa_url = os.getenv("WHATSAPP_SERVICE_URL", "http://whatsapp_service:8002")
```
4. Remove all `yn8wow.easypanel.host` references from Python source files.

**Acceptance criteria**:
- [ ] No `yn8wow.easypanel.host` URLs remain in Python source files
- [ ] All inter-service URLs come from environment variables with generic defaults
- [ ] `TIENDANUBE_SERVICE_URL` env var is respected in engine.py service discovery

**Dependencies**: PROD-14

---

### PROD-11: Billing Secrets Read Via os.getenv Instead of Settings
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/app/routes/billing_routes.py` (lines 33–36)
- `orchestrator_service/app/core/config.py`

**Current behavior**:
```python
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN")
MP_WEBHOOK_SECRET = os.getenv("MP_WEBHOOK_SECRET")
```
Module-level `os.getenv` calls bypass the `Settings` class validation and production secret enforcement.

**Required behavior**:
All billing secrets must be read from the `settings` object. `MP_ACCESS_TOKEN` and `MP_WEBHOOK_SECRET` must be added to `Settings` if missing.

**Implementation**:
1. Add to `orchestrator_service/app/core/config.py` if missing:
```python
MP_ACCESS_TOKEN: str | None = None
MP_WEBHOOK_SECRET: str | None = None
```
2. In `billing_routes.py`, remove lines 33–36 and import settings:
```python
from app.core.config import settings
# Replace all usages:
# STRIPE_SECRET_KEY  -> settings.STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET -> settings.STRIPE_WEBHOOK_SECRET
# MP_ACCESS_TOKEN -> settings.MP_ACCESS_TOKEN
# MP_WEBHOOK_SECRET -> settings.MP_WEBHOOK_SECRET
```
3. Add `MP_ACCESS_TOKEN` to `REQUIRED_PRODUCTION_SECRETS` list in `config.py` (alongside existing STRIPE keys).

**Acceptance criteria**:
- [ ] No `os.getenv` for billing secrets in `billing_routes.py`
- [ ] All billing secrets come from `settings` object
- [ ] `MP_ACCESS_TOKEN` validated in production by `model_validator`
- [ ] Startup fails in production if billing secrets are missing

**Dependencies**: none

---

### PROD-12: SMTP Error Details Potentially Leaked to Client
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/app/routes/auth_routes.py` (lines 241–243 and related smtp blocks)

**Current behavior**:
The register flow catches SMTP errors and uses a generic message. However, other email flows (resend, welcome email) and the `admin_routes.py` handoff email endpoint may propagate exception strings — which can contain SMTP host, port, and auth failure details — into the response or insufficiently sanitized logs.

**Required behavior**:
- All SMTP exceptions must be caught and return only a generic client message.
- Logs must use `error_type=type(e).__name__` instead of `error=str(e)` to prevent credential leakage into log aggregators.

**Implementation**:
1. Audit all SMTP try/except blocks in `auth_routes.py` and `admin_routes.py`.
2. Enforce this pattern everywhere:
```python
except Exception as e:
    logger.error("email_send_failed", error_type=type(e).__name__, context="register")
    # Never: logger.error("...", error=str(e)) — str(e) may contain SMTP credentials
    raise HTTPException(status_code=500, detail="Error sending verification email")
    # Or for non-blocking: set email_sent = False and return generic message
```
3. Never include `str(e)` in any field returned in the HTTP response body.

**Acceptance criteria**:
- [ ] No SMTP exception message text is returned in any API response body
- [ ] All SMTP errors are logged with `error_type` only (no `str(e)`)
- [ ] Client receives generic "Error sending verification email" on failure
- [ ] Register, resend, and welcome email flows all follow this pattern

**Dependencies**: none

---

### PROD-13: Email Verification Token Has No Expiry
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/app/models/auth.py`
- `orchestrator_service/app/routes/auth_routes.py` (lines 193–200, 330–344, 401–413)
- New Alembic migration required

**Current behavior**:
```python
class User(Base, TimestampMixin):
    verification_token: Mapped[str] = mapped_column(String(255), nullable=True, unique=True)
    # No verification_token_expires_at column exists
```
```python
# verify-email endpoint — no expiry check
result = await db.execute(select(User).where(User.verification_token == data.token))
# A 6-month-old token is still valid
```

**Required behavior**:
- Add `verification_token_expires_at` column to `users` table.
- Set 48-hour TTL when generating verification token.
- Check expiry in `verify-email` endpoint.

**Implementation**:
1. Add column to `orchestrator_service/app/models/auth.py`:
```python
verification_token_expires_at: Mapped[datetime] = mapped_column(nullable=True)
```
2. Create Alembic migration:
```bash
alembic revision --autogenerate -m "add_verification_token_expires_at"
```
Migration adds a nullable column (no default). Existing rows have NULL — treated as non-expired during rollout for backward compatibility.

3. In `auth_routes.py`, when generating verification token (all 3 locations: register, resend):
```python
from datetime import datetime, timedelta, timezone
verification_token = uuid.uuid4().hex
verification_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=48)
new_user.verification_token = verification_token
new_user.verification_token_expires_at = verification_token_expires_at
```
4. In `verify-email` endpoint, after fetching user:
```python
user = result.scalar_one_or_none()
if not user:
    raise HTTPException(status_code=400, detail="Invalid verification token")

if user.verification_token_expires_at is not None:
    if datetime.now(timezone.utc) > user.verification_token_expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="Verification token has expired. Please request a new one."
        )
```

**Acceptance criteria**:
- [ ] `verification_token_expires_at` column exists in `users` table
- [ ] Alembic migration runs cleanly on existing database
- [ ] New registrations set 48h TTL on verification token
- [ ] `verify-email` endpoint rejects tokens older than 48h with 400
- [ ] Legacy tokens (NULL expiry) are still accepted during transition
- [ ] Resend verification sets fresh 48h TTL

**Dependencies**: none

---

### PROD-14: CORS_ALLOWED_ORIGINS Defaults to Client-Specific Domains
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/app/core/config.py` (lines 186–192)

**Current behavior**:
```python
CORS_ALLOWED_ORIGINS: Any = [
    "https://multiagents-frontend.yn8wow.easypanel.host",
    "https://multiagents-backend.yn8wow.easypanel.host",
    "https://multiagents-orchestrator.yn8wow.easypanel.host",
    "http://localhost:3000",
    "http://localhost:8000",
]
```
Hardcodes a specific customer's production domains. Any new deployment of the platform unintentionally grants CORS access to that customer's domains.

**Required behavior**:
Default to empty list `[]`. Require explicit `CORS_ALLOWED_ORIGINS` configuration in production.

**Implementation**:
1. In `orchestrator_service/app/core/config.py`, change the field default:
```python
CORS_ALLOWED_ORIGINS: Any = []
```
2. Add a validator that enforces non-empty list in production:
```python
@field_validator("CORS_ALLOWED_ORIGINS", mode="after")
@classmethod
def validate_cors_origins(cls, v: Any) -> Any:
    if is_production() and (not v or v == []):
        raise ValueError(
            "CORS_ALLOWED_ORIGINS must be set in production. "
            "Example: https://app.yourdomain.com,https://api.yourdomain.com"
        )
    return v
```
3. Add `CORS_ALLOWED_ORIGINS` to `.env.example` with example value and comment.

**Acceptance criteria**:
- [ ] Default value of `CORS_ALLOWED_ORIGINS` is `[]`
- [ ] No `yn8wow.easypanel.host` domains in source code defaults
- [ ] Service fails to start in production if `CORS_ALLOWED_ORIGINS` is empty
- [ ] Development environments work fine with empty or local values

**Dependencies**: PROD-01 (must be done together or before)

---

### PROD-15: ADMIN_TOKEN Defaults to "admin-secret-99" in docker-compose
**Severity**: HIGH
**Service**: orchestrator_service, tiendanube_service, frontend_react (platform_ui)
**Files**:
- `docker-compose.yml` (lines 25, 47, 78)

**Current behavior**:
```yaml
- ADMIN_TOKEN=${ADMIN_TOKEN:-admin-secret-99}
```
Appears in three service definitions. The fallback `admin-secret-99` is a public default credential that grants admin access to any deployment using default settings.

**Required behavior**:
Remove all `:-admin-secret-99` fallbacks. Require explicit value. Fail if not set.

**Implementation**:
1. In `docker-compose.yml`, change all three occurrences from:
```yaml
- ADMIN_TOKEN=${ADMIN_TOKEN:-admin-secret-99}
```
to:
```yaml
- ADMIN_TOKEN=${ADMIN_TOKEN}
```
2. `ADMIN_TOKEN` is already in `REQUIRED_PRODUCTION_SECRETS` in `config.py` — the existing validator will fire in production.
3. Add `ADMIN_TOKEN=` to `.env.example` with comment: `# Required — openssl rand -hex 32`

**Acceptance criteria**:
- [ ] No `:-admin-secret-99` fallbacks anywhere in docker-compose files
- [ ] Stack fails clearly if `ADMIN_TOKEN` is not set in `.env`
- [ ] `.env.example` documents `ADMIN_TOKEN` as required with generation command

**Dependencies**: none

---

### PROD-16: TiendaNube API Authentication Header Name
**Severity**: HIGH
**Service**: tiendanube_service
**Files**:
- `tiendanube_service/main.py` (lines 150–165)

**Current behavior**:
```python
def get_tn_headers(access_token: str) -> Dict[str, str]:
    """Centralized Tienda Nube Header logic (Spec: Authentication: bearer $TOKEN)"""
    return {
        "Authentication": f"bearer {access_token.strip()}",
        ...
    }
```
The comment cites the TiendaNube API spec as the source for `Authentication`. The standard HTTP header is `Authorization`. This requires verification against TiendaNube's official docs.

**Required behavior**:
Verify against TiendaNube API docs. If `Authentication` is correct: add a comment with the spec URL. If `Authorization` is correct: fix the header name.

**Implementation**:
1. Verify: TiendaNube official API documentation (https://tiendanube.github.io/api-documentation/intro) uses `Authentication: bearer {token}`. This is their non-standard but intentional choice.
2. Since `Authentication` is confirmed per TiendaNube spec, add a documenting comment:
```python
def get_tn_headers(access_token: str) -> Dict[str, str]:
    """
    Builds headers for TiendaNube API requests.

    NOTE: TiendaNube intentionally uses "Authentication" (not the standard "Authorization").
    This is per their official spec:
    https://tiendanube.github.io/api-documentation/intro#authentication
    """
    return {
        "Authentication": f"bearer {access_token.strip()}",
        "User-Agent": TIENDANUBE_USER_AGENT,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
```
3. If future API calls fail with 401, re-verify against live TiendaNube API docs.

**Acceptance criteria**:
- [ ] Header name is verified against official TiendaNube documentation
- [ ] A comment with the spec URL is present explaining the non-standard header
- [ ] TiendaNube API calls successfully authenticate (manual verify or integration test)

**Dependencies**: none

---

## Phase 3 — Hardening (HIGH/MEDIUM)

---

### PROD-17: nginx Missing Security Headers, gzip, and Asset Cache
**Severity**: HIGH
**Service**: frontend_react
**Files**:
- `frontend_react/nginx.conf`

**Current behavior**:
`nginx.conf` contains only routing logic. No security headers, no gzip compression, no cache headers for static assets. The browser receives no `X-Frame-Options`, no `CSP`, no `HSTS`. Assets are re-fetched on every visit.

**Required behavior**:
Add security headers, gzip, and long-lived cache headers for `/assets/`.

**Implementation**:
Add to `frontend_react/nginx.conf` inside the `server {}` block, before the `location /` block:
```nginx
# Security Headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://www.facebook.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-src https://www.facebook.com;" always;

# Gzip Compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;
```

Add a new location block for static assets (before the `location /` block):
```nginx
# Long-lived cache for Vite-hashed assets
location ~* ^/assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    try_files $uri =404;
}
```

**Note on CSP**: The CSP above is permissive to accommodate Meta/Facebook SDK and React inline scripts. Tighten in a follow-up by implementing nonces.

**Acceptance criteria**:
- [ ] `curl -I https://app.example.com` shows `X-Frame-Options: SAMEORIGIN`
- [ ] `curl -I https://app.example.com` shows `X-Content-Type-Options: nosniff`
- [ ] `curl -I https://app.example.com` shows `Strict-Transport-Security`
- [ ] `curl -I https://app.example.com/assets/index-xyz.js` shows `Cache-Control: public, immutable`
- [ ] Response body is gzip-compressed (`Content-Encoding: gzip`)

**Dependencies**: PROD-08 (port fix must be applied first)

---

### PROD-18: BFF render.yaml startCommand Points to Wrong Entry
**Severity**: HIGH
**Service**: bff_service
**Files**:
- `render.yaml` (lines 72–73)

**Current behavior**:
```yaml
buildCommand: "cd bff_service && npm install"
startCommand: "cd bff_service && node server.js"
```
The BFF is TypeScript. It must be compiled before running. `server.js` does not exist — the compiled output is at `dist/index.js`. `npm install` without `npm run build` leaves no compiled files.

**Required behavior**:
Build the TypeScript and run the compiled output.

**Implementation**:
1. In `render.yaml`, update the bff-service entry:
```yaml
buildCommand: "cd bff_service && npm install && npm run build"
startCommand: "cd bff_service && node dist/index.js"
```
2. Verify `bff_service/package.json` has a `build` script that runs `tsc`.
3. Verify `bff_service/tsconfig.json` outputs to `dist/` with `"outDir": "./dist"`.

**Acceptance criteria**:
- [ ] `render.yaml` buildCommand includes `npm run build`
- [ ] `render.yaml` startCommand uses `node dist/index.js`
- [ ] BFF service starts successfully on Render
- [ ] `/health` endpoint responds on Render

**Dependencies**: none

---

### PROD-19: Database Connection Pool Not Configured
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/db.py` (line 26)

**Current behavior**:
```python
engine = create_async_engine(DATABASE_URL, echo=False)
```
SQLAlchemy default pool: `pool_size=5`, `max_overflow=10`. For a production SaaS with 4 workers (per render.yaml) and multiple concurrent tenants, default pool settings cause connection exhaustion under moderate load.

**Required behavior**:
Configure pool explicitly with production-appropriate values. Allow env var overrides.

**Implementation**:
1. In `orchestrator_service/db.py`, replace line 26:
```python
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 30 min

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_recycle=DB_POOL_RECYCLE,
    pool_pre_ping=True,  # Detect stale connections after idle
)
```
2. Add these variables to `.env.example` with comments and default values.

**Acceptance criteria**:
- [ ] `create_async_engine` called with explicit pool parameters
- [ ] `pool_pre_ping=True` set to handle connection drops
- [ ] All 4 pool parameters are configurable via env vars
- [ ] `.env.example` documents these variables

**Dependencies**: none

---

### PROD-20: Redis Fail-Open on Rate Limiter
**Severity**: HIGH
**Service**: orchestrator_service
**Files**:
- `orchestrator_service/app/middleware/rate_limit_enhanced.py` (line 170)

**Current behavior**:
```python
limiter = Limiter(
    ...
    swallow_errors=True,  # fail open on Redis errors
    ...
)
```
When Redis is down, all rate limiting is bypassed. An attacker can exploit a Redis outage to send unlimited requests.

**Required behavior**:
Change to fail-closed: when Redis is unavailable, return 503.

**Implementation**:
1. In `rate_limit_enhanced.py`, change:
```python
swallow_errors=False,  # fail closed: Redis down = rate limiting unavailable = 503
```
2. Register an error handler for the limiter exception (in `main.py` or `attach_rate_limiter`):
```python
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

@app.exception_handler(Exception)
async def rate_limit_redis_error_handler(request, exc):
    if "redis" in str(exc).lower() or "connection" in str(exc).lower():
        return JSONResponse(
            status_code=503,
            content={"detail": "Service temporarily unavailable. Please try again shortly."}
        )
    # Fall through to global_exception_handler
    raise exc
```
3. Note: nginx-level rate limiting is documented as a recommendation for independent backup protection that operates without Redis. Add to `nginx.conf` comments.

**Acceptance criteria**:
- [ ] `swallow_errors=False` set in the limiter configuration
- [ ] When Redis is unreachable, rate-limited endpoints return 503
- [ ] The 503 response body is user-friendly (no Redis error details)
- [ ] Existing rate limit behavior (429) is unchanged when Redis is healthy

**Dependencies**: none

---

### PROD-21: No CI/CD Pipeline
**Severity**: MEDIUM
**Service**: all
**Files**:
- New file: `.github/workflows/ci.yml`

**Current behavior**:
No automated testing or quality gates. Every push to master deploys untested code.

**Required behavior**:
A basic CI pipeline that runs on every push and PR to `master`.

**Implementation**:
Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  lint-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install ruff
      - run: ruff check orchestrator_service/ meta_service/ whatsapp_service/ tiendanube_service/

  test-orchestrator:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r orchestrator_service/requirements.txt
      - run: pytest orchestrator_service/tests/ -x -q
        env:
          POSTGRES_DSN: postgresql+asyncpg://postgres:testpass@localhost/testdb
          REDIS_URL: redis://localhost:6379
          SECRET_KEY: test-secret-key-32-chars-minimum!!
          ENCRYPTION_KEY: test-encryption-key
          INTERNAL_API_TOKEN: test-internal-token
          ENVIRONMENT: test

  typecheck-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend_react/package-lock.json
      - run: npm ci --legacy-peer-deps
        working-directory: frontend_react
      - run: npx tsc --noEmit
        working-directory: frontend_react

  docker-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t orchestrator-test ./orchestrator_service
      - run: docker build -t frontend-test ./frontend_react
      - run: docker build -t bff-test ./bff_service
```

**Acceptance criteria**:
- [ ] CI pipeline runs on every push to `master`
- [ ] CI pipeline runs on every PR targeting `master`
- [ ] `ruff` linting passes on all Python services
- [ ] `pytest` runs and passes in orchestrator service
- [ ] TypeScript type-check passes on frontend
- [ ] All three Docker images build successfully
- [ ] Pipeline failure blocks merge (configure branch protection rule)

**Dependencies**: none

---

## Phase 4 — DX / Completeness (MEDIUM)

---

### PROD-22: Variant Compose Files Reference Wrong Build Context
**Severity**: MEDIUM
**Service**: frontend_react
**Files**:
- `docker-compose.variant-a.yml` (lines 52–54)
- `docker-compose.variant-b.yml` (lines 47–49)

**Current behavior**:
```yaml
# Both variant files
platform_ui:
  build:
    context: ./platform_ui   # This directory does not exist
```
The actual frontend directory is `./frontend_react`. Building with these variant files fails immediately with "context not found".

**Required behavior**:
Fix the build context to `./frontend_react` in both variant files.

**Implementation**:
1. In `docker-compose.variant-a.yml`, change:
```yaml
platform_ui:
  build:
    context: ./frontend_react
```
2. In `docker-compose.variant-b.yml`, change:
```yaml
platform_ui:
  build:
    context: ./frontend_react
```

**Acceptance criteria**:
- [ ] `docker-compose -f docker-compose.variant-a.yml build platform_ui` succeeds
- [ ] `docker-compose -f docker-compose.variant-b.yml build platform_ui` succeeds
- [ ] No reference to `./platform_ui` path remains in any docker-compose file

**Dependencies**: none

---

### PROD-23: .env.example Incomplete
**Severity**: MEDIUM
**Service**: all
**Files**:
- `.env.example` (root)

**Current behavior**:
`.env.example` does not list all required environment variables for all services. New operators cannot set up the project from scratch.

**Required behavior**:
Complete `.env.example` listing every required and optional env var for every service, with descriptions and example values.

**Implementation**:
Replace `.env.example` with the following content:
```bash
# ==============================================
# Platform AI Solutions — Environment Variables
# ==============================================
# Copy this file to .env and fill in all values.
# REQUIRED = must be set in production
# OPTIONAL = has a safe default

# --- ENVIRONMENT ---
ENVIRONMENT=development          # development | staging | production

# --- ORCHESTRATOR SERVICE ---

# Database (REQUIRED)
POSTGRES_DSN=postgresql+asyncpg://user:password@localhost:5432/nexus_db
POSTGRES_USER=nexus
POSTGRES_PASSWORD=changeme
POSTGRES_DB=nexus_db

# Redis (REQUIRED)
REDIS_URL=redis://localhost:6379/0

# Security (REQUIRED in production)
SECRET_KEY=              # openssl rand -hex 32
ENCRYPTION_KEY=          # openssl rand -hex 32
INTERNAL_API_TOKEN=      # openssl rand -hex 32
ADMIN_TOKEN=             # openssl rand -hex 32

# CORS (REQUIRED in production — comma-separated list)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# AI (REQUIRED for core features)
OPENAI_API_KEY=          # sk-...
GOOGLE_API_KEY=          # optional

# Supabase (OPTIONAL — for RAG features)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_DB_URL=

# Google OAuth (OPTIONAL)
GOOGLE_OAUTH_CLIENT_ID=

# Logging (OPTIONAL)
LOG_LEVEL=INFO           # DEBUG | INFO | WARNING | ERROR | CRITICAL

# Database Pool (OPTIONAL — tune for your workload)
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800

# --- BILLING ---

# Stripe (REQUIRED if using Stripe)
STRIPE_SECRET_KEY=       # sk_live_...
STRIPE_WEBHOOK_SECRET=   # whsec_...

# MercadoPago (REQUIRED if using MercadoPago)
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=

# Frontend URL for billing redirects (REQUIRED)
FRONTEND_URL=http://localhost:3000

# --- META SERVICE ---

# Meta Webhooks (REQUIRED for Meta/WhatsApp/Instagram)
META_VERIFY_TOKEN=       # openssl rand -hex 16
META_APP_SECRET=         # from Meta Developer Dashboard
META_APP_ID=             # from Meta Developer Dashboard

# --- WHATSAPP SERVICE ---

# YCloud (REQUIRED for WhatsApp via YCloud)
YCLOUD_API_KEY=
YCLOUD_WEBHOOK_SECRET=

# --- BFF SERVICE ---

# CORS for BFF (REQUIRED in production — comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# --- SERVICE DISCOVERY (change only for non-Docker deployments) ---
AGENT_SERVICE_URL=http://agent_service:8001
TIENDANUBE_SERVICE_URL=http://tiendanube_service:8003
WHATSAPP_SERVICE_URL=http://whatsapp_service:8002
META_SERVICE_URL=http://meta_service:8000
ORCHESTRATOR_URL=http://orchestrator_service:8000

# --- FRONTEND (Vite build-time variables) ---
VITE_API_BASE_URL=http://localhost:3000
VITE_GOOGLE_OAUTH_CLIENT_ID=
VITE_FACEBOOK_APP_ID=
VITE_FACEBOOK_API_VERSION=v20.0
VITE_META_CONFIG_ID=
VITE_META_EMBEDDED_SIGNUP=false
```

**Acceptance criteria**:
- [ ] Every `os.getenv` call across all services has a corresponding entry
- [ ] Every `Settings` field in `config.py` has a corresponding entry
- [ ] Sensitive values have empty values with generation commands in comments
- [ ] `.env.example` is tracked in git and not in `.gitignore`

**Dependencies**: PROD-05, PROD-11, PROD-14, PROD-15 (must be fixed first to know what is required)

---

### PROD-24: No .dockerignore Files
**Severity**: MEDIUM
**Service**: all
**Files**:
- New: `orchestrator_service/.dockerignore`
- New: `agent_service/.dockerignore`
- New: `whatsapp_service/.dockerignore`
- New: `meta_service/.dockerignore`
- New: `tiendanube_service/.dockerignore`
- New: `bff_service/.dockerignore`
- New: `frontend_react/.dockerignore`

**Current behavior**:
No `.dockerignore` files exist. Every `COPY . .` includes `.env`, `__pycache__`, `*.pyc`, `node_modules`, `tests/`, `.git`. This inflates image sizes, slows builds, and risks including secrets in images.

**Required behavior**:
Each service must have a `.dockerignore` that excludes secrets, build artifacts, and development files.

**Implementation**:
Create for each Python service (`orchestrator_service`, `agent_service`, `whatsapp_service`, `meta_service`, `tiendanube_service`):
```
.env
.env.*
__pycache__/
*.pyc
*.pyo
*.pyd
.pytest_cache/
.coverage
htmlcov/
*.egg-info/
dist/
build/
.git/
.gitignore
tests/
*.md
*.txt
!requirements.txt
.mypy_cache/
.ruff_cache/
```

Create for `bff_service`:
```
.env
.env.*
node_modules/
dist/
.git/
.gitignore
*.md
*.log
.nyc_output/
coverage/
```

Create for `frontend_react`:
```
.env
.env.*
node_modules/
dist/
.git/
.gitignore
*.md
*.log
.nyc_output/
coverage/
```

**Acceptance criteria**:
- [ ] `.dockerignore` files exist for all 7 services
- [ ] `.env` files are excluded from all Docker build contexts
- [ ] `__pycache__` and `*.pyc` are excluded from Python service images
- [ ] `node_modules` is excluded from Node.js service images
- [ ] Docker image sizes are measurably smaller after this change

**Dependencies**: none

---

### PROD-25: Public Pages Premium SaaS Redesign
**Severity**: MEDIUM
**Service**: frontend_react
**Files**:
- Reference: `specs/2026-03-27_public-pages-premium-redesign.spec.md`

**Current behavior**:
Public-facing pages (landing, pricing, login, register, etc.) do not match the premium SaaS positioning of the product.

**Required behavior**:
See the existing dedicated spec for full details of the 8 redesigns and 3 new pages. This item is cross-referenced here for completeness — it is NOT a blocking security issue.

**Implementation**:
Follow `specs/2026-03-27_public-pages-premium-redesign.spec.md`. No additional specification needed here.

**Acceptance criteria**:
- [ ] Delegated entirely to the public pages redesign spec
- [ ] Tracked separately from security and infrastructure fixes

**Dependencies**: PROD-08, PROD-17 (frontend infrastructure must be stable first)

---

## Implementation Order and Batches

### Batch 1 — BLOCKING Security (do first, can deploy independently)
`PROD-01`, `PROD-02`, `PROD-05`, `PROD-06`, `PROD-07` → then `PROD-03` + `PROD-04` (depend on each other)

### Batch 2 — HIGH Infrastructure (can parallelize within batch)
`PROD-08`, `PROD-09`, `PROD-11`, `PROD-12`, `PROD-15` → then `PROD-14` → then `PROD-10` (depends on 14) → `PROD-13` (DB migration, deploy last in batch)

### Batch 3 — Hardening (after batch 2)
`PROD-16`, `PROD-17`, `PROD-18`, `PROD-19`, `PROD-20`, `PROD-21`

### Batch 4 — DX (after batch 2, can run in parallel with batch 3)
`PROD-22`, `PROD-23`, `PROD-24` → `PROD-25` (separate track)

---

## Risk Notes

1. **PROD-13 (DB migration)**: Adds a nullable column — no downtime required. Backward compatible rollout.
2. **PROD-20 (fail-closed)**: Changing `swallow_errors=True` to `False` causes 503s if Redis is flaky. Monitor Redis stability. Deploy PROD-19 (pool fix) first and ensure Redis is stable.
3. **PROD-03/04 (admin token)**: Breaking change for any code path relying on the frontend sending `x-admin-token`. All admin views must work via BFF session validation flow after this change. Test all admin views thoroughly.
4. **PROD-05 (META_VERIFY_TOKEN)**: Existing deployments using `nexus_verification_token` as the actual Meta webhook token WILL BREAK. Must update the Meta App Dashboard webhook token when deploying this fix.
5. **PROD-02 (BFF CORS)**: If `ALLOWED_ORIGINS` is not set in production, ALL browser requests to BFF will be rejected. Deploy with `ALLOWED_ORIGINS` pre-configured.
