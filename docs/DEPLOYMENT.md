# Future Platform — Deployment

## Docker Compose (Local Development)

```bash
docker-compose up -d --build
```

Services start in order: postgres → redis → orchestrator → agent/whatsapp/meta/tiendanube → bff → frontend

- Frontend: http://localhost
- API docs: http://localhost:8000/docs
- Meta service: http://localhost:8004/docs

## EasyPanel (Production)

Each service is deployed as a separate app in EasyPanel with Docker-based containers.

### Service URLs (example)

| Service | Internal | External |
|---------|----------|----------|
| orchestrator | `http://orchestrator:8000` | `https://multiagents-orchestrator.<domain>` |
| meta_service | `http://meta-service:8000` | `https://multiagents-metaservice.<domain>` |
| whatsapp_service | `http://whatsapp-service:8002` | `https://multiagents-whatsapp.<domain>` |
| frontend | — | `https://multiagents-frontend.<domain>` |

### DNS Resilience
Services try both underscore (`orchestrator_service`) and dash (`orchestrator-service`) hostnames for EasyPanel compatibility.

## Environment Variables

### Required (All Services)

```env
SECRET_KEY=<jwt-secret>
POSTGRES_DSN=postgresql://user:pass@postgres:5432/dbname
REDIS_URL=redis://redis:6379
ADMIN_TOKEN=<admin-api-token>
INTERNAL_API_TOKEN=<inter-service-secret>
INTERNAL_SECRET_KEY=<inter-service-secret-alt>
```

### AI Keys

```env
OPENAI_API_KEY=<openai-key>
GOOGLE_API_KEY=<google-key>          # Optional, per-tenant override
```

### Meta Integration

```env
META_APP_ID=<facebook-app-id>
META_APP_SECRET=<facebook-app-secret>
META_VERIFY_TOKEN=<webhook-verify-token>
VITE_FACEBOOK_APP_ID=<same-app-id>
VITE_META_CONFIG_ID=<meta-business-config-id>
```

### Billing

```env
STRIPE_SECRET_KEY=<stripe-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
MP_ACCESS_TOKEN=<mercadopago-token>
MP_WEBHOOK_SECRET=<mercadopago-webhook-secret>
```

### OAuth

```env
GOOGLE_OAUTH_CLIENT_ID=<google-oauth-client-id>
VITE_GOOGLE_OAUTH_CLIENT_ID=<same-client-id>
```

### Optional

```env
SUPER_ADMIN_EMAIL=<super-admin-email>
FRONTEND_URL=https://your-frontend-domain
WHATSAPP_SERVICE_URL=http://whatsapp-service:8002
META_SERVICE_URL=http://meta-service:8000
ORCHESTRATOR_URL=http://orchestrator:8000
```

## Database Initialization

The orchestrator runs schema migrations automatically on startup. No manual migration scripts needed — all `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` are idempotent.

## Health Checks

All services expose `GET /health`:
```json
{"status": "ok", "service": "orchestrator_service"}
```

Docker Compose health checks run every 30s with 3 retries.
