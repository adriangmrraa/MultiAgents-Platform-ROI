# Future Platform — API Reference

## Authentication (`/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Email/password login → JWT |
| POST | `/auth/register` | User registration |
| GET | `/auth/me` | Current user info |
| GET | `/auth/google/oauth-url` | Google OAuth initiation |
| POST | `/auth/google/callback` | Google OAuth callback |

## Admin — Agents (`/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/agents` | List tenant agents |
| POST | `/admin/agents` | Create agent |
| PUT | `/admin/agents/{id}` | Update agent |
| DELETE | `/admin/agents/{id}` | Delete agent |
| POST | `/admin/agents/{id}/test` | Test agent with sample input |

## Admin — Chats (`/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/chats/summary` | List conversations (supports `channel`, `provider`, `limit`, `offset`) |
| GET | `/admin/chats/{id}/messages` | Paginated message history |
| POST | `/admin/whatsapp/send` | Send manual message (routes to correct provider) |
| POST | `/admin/conversations/{id}/human-override` | Toggle human override lock |

## Admin — Credentials (`/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/credentials` | List tenant credentials (masked) |
| POST | `/admin/credentials` | Create/update credential |
| DELETE | `/admin/credentials/{id}` | Delete credential |
| POST | `/admin/credentials/internal-sync` | Internal: sync from meta/tiendanube service |
| GET | `/admin/internal/credentials/{name}` | Internal: fetch decrypted credential |

## Admin — Integrations (`/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/integrations/channels` | List connected channels + assets |
| POST | `/admin/integrations/update-channels` | Activate/deactivate channels |

## Billing (`/billing`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/billing/plans` | Available plans |
| GET | `/billing/my-subscription` | Current subscription |
| POST | `/billing/checkout` | Create checkout session |
| POST | `/billing/change-plan` | Upgrade/downgrade |
| GET | `/billing/invoices` | Invoice history |
| GET | `/billing/usage` | Current period usage |
| POST | `/billing/webhook/stripe` | Stripe webhook |
| POST | `/billing/webhook/mercadopago` | MercadoPago webhook |

## Knowledge / RAG (`/ingest`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest/upload` | Upload document (PDF/DOCX/TXT/CSV) |
| POST | `/ingest/url` | Ingest from URL |
| GET | `/ingest/collections` | List knowledge collections |
| DELETE | `/ingest/document/{id}` | Delete document + embeddings |
| POST | `/ingest/search` | Semantic search |

## Message Ingestion (`/ingest`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest/message` | Internal: receive normalized event from meta_service |

## Gallery / Creative Studio (`/gallery`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/gallery/brand-dna` | Extract brand DNA |
| POST | `/gallery/photoshoot` | Generate product photos |
| POST | `/gallery/model-shoot` | Generate model scenes |
| POST | `/gallery/campaign` | Generate campaigns |
| POST | `/gallery/enhance-prompt` | AI prompt enhancement |
| GET | `/gallery/assets` | List gallery assets |
| DELETE | `/gallery/assets/{id}` | Delete asset |

## Platform Admin (`/platform`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/platform/overview` | MRR, revenue, costs (super admin) |
| GET | `/platform/tenants` | List all tenants |
| POST | `/platform/tenants/{id}/action` | Suspend/activate tenant |
| POST | `/platform/tenants/{id}/plan` | Change tenant plan |
| GET | `/platform/audit-logs` | Admin action logs |

## Meta Service (`meta_service`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhook` | Meta verification challenge |
| POST | `/webhook` | Receive Meta webhook events |
| POST | `/connect` | Exchange auth code → connect account |
| POST | `/subscribe` | Subscribe asset to webhooks |
| POST | `/messages/send` | Send FB/IG message via Graph API |
| POST | `/whatsapp/send` | Send WhatsApp message via Cloud API |

## WhatsApp Service (`whatsapp_service`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/messages/relay` | Universal delivery relay (routes to Meta/YCloud/Chatwoot) |
| POST | `/webhook/ycloud` | YCloud webhook reception |
| POST | `/webhook/chatwoot` | Chatwoot webhook reception |

## Orchestrator — Main (`/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Main message processing (from whatsapp_service) |
| GET | `/health` | Health check |
