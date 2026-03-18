# Future Platform — Architecture

## Services Overview

Future is a microservices platform with 6 backend services + 1 frontend SPA.

| Service | Port | Tech | Purpose |
|---------|------|------|---------|
| `frontend_react` | 80 | React 18 + Vite | SPA dashboard |
| `bff_service` | 3000 | Express.js | Backend-for-Frontend proxy |
| `orchestrator_service` | 8000 | FastAPI | Central hub: auth, agents, chats, billing, RAG |
| `agent_service` | 8001 | FastAPI | LangChain agent execution |
| `whatsapp_service` | 8002 | FastAPI | Universal delivery relay (WhatsApp, Chatwoot, Meta) |
| `tiendanube_service` | 8003 | FastAPI | E-commerce sync (Tienda Nube) |
| `meta_service` | 8004 | FastAPI | Meta OAuth, webhook reception, Graph API proxy |

## Infrastructure

- **PostgreSQL 13** with pgvector extension (semantic search)
- **Redis** for caching, pub/sub, message buffering, and agent memory
- **Supabase** compatible (pgvector for RAG embeddings)

## Multi-Tenancy

Every resource is isolated by `tenant_id`. Each tenant has:
- Their own agents, credentials, knowledge base, conversations
- Encrypted credentials (AES-256 Fernet) stored per-tenant
- Independent billing subscription and usage tracking

## Authentication

- **Users:** JWT + bcrypt (email/password or Google OAuth 2.0)
- **Admin:** `X-Admin-Token` header
- **Inter-service:** `X-Internal-Secret` / `X-Internal-Token` headers
- **Meta:** OAuth 2.0 via Facebook Login for Business

## Message Flow

```
Inbound Message (WhatsApp/Instagram/Facebook/Web)
    |
    v
Provider Webhook → meta_service / whatsapp_service / chatwoot
    |
    v
Normalize → SimpleEvent { provider, platform, sender_id, text }
    |
    v
POST /ingest/message → orchestrator_service
    |
    v
1. Resolve tenant (via business_assets or phone number)
2. Create/update customer (Identity Link)
3. Create/update conversation
4. Persist message
5. Publish to Redis (real-time UI)
6. Trigger AI agent (buffer → process_buffer_task)
    |
    v
Agent generates response → unified_message_delivery
    |
    v
whatsapp_service /messages/relay → Meta Graph API / YCloud / Chatwoot
    |
    v
Response delivered to user + persisted in DB
```

## Database Schema

Core tables:
- `tenants` — multi-tenant isolation root
- `users` — authentication and profile
- `agents` — AI agent configurations
- `chat_conversations` — conversation state per channel per user
- `chat_messages` — message history
- `customers` — identity link across channels
- `credentials` — encrypted API keys (AES-256)
- `business_assets` — Meta pages, IG accounts, brand DNA, gallery assets
- `documents` — RAG knowledge base (pgvector embeddings)
- `subscriptions` / `plans` / `usage_records` — SaaS billing

## Key Patterns

### Sovereign Credential Vault
All API keys are encrypted at rest with AES-256 (Fernet). Decrypted only at runtime, never exposed to frontend. Each tenant manages their own keys.

### Universal Delivery Relay
All outbound messages route through `whatsapp_service /messages/relay`. It resolves the provider (YCloud, Meta Direct, Chatwoot) and delivers via the appropriate API.

### Smart Buffer + Dedup Guard
Inbound messages are buffered in Redis with a 5-second debounce window. The dedup guard prevents the agent from re-processing messages that already have a reply.

### Shadow RAG
Conversation messages are passively indexed into the vector store for semantic search across historical interactions.
