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
  - Google OAuth: uses `@react-oauth/google` on frontend + server-side token verification
  - On Google signup: auto-creates tenant, sends branded welcome email
  - Email verification required for email/password registrations
- **Admin:** `X-Admin-Token` header
- **Inter-service:** `X-Internal-Secret` / `X-Internal-Token` headers
- **Meta:** OAuth 2.0 via Facebook Login for Business

## Email System

Transactional emails sent via SMTP (configurable provider):
- **Welcome email** — sent after registration (both email/password and Google OAuth)
- **Email verification** — verification link for email/password signups
- **Password reset** — forgot-password flow with secure token
- **Trial reminders** — automated at days 7, 9, and 10 with feature highlights
- **Branding:** Future Platform styling (dark slate background, gradient header, monospace fonts)

## Public Pages

The frontend includes unauthenticated routes:
- `/` — Landing page (hero, features grid, how-it-works, CTA)
- `/pricing` — Plan comparison with monthly/yearly and USD/ARS toggles
- `/login`, `/register` — Auth pages with Google OAuth button
- `/forgot-password`, `/reset-password` — Password recovery flow
- `/terms`, `/privacy` — Legal pages

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
- `rag_documents` — RAG knowledge base (pgvector embeddings via Supabase)
- `subscriptions` / `plans` / `usage_records` — SaaS billing
- `onboarding_progress` — wizard state per user (step, draft, chat history)
- `voice_widget_configs` — embeddable voice widget configurations
- `voice_usage_records` — voice minutes consumption tracking

## Onboarding Wizard (v9.0)

7-step mandatory wizard for new users, replacing MagicOnboarding:

| Step | What it configures | UI Type |
|------|-------------------|---------|
| 0 | Tenant creation | Welcome animation (5s auto-advance) |
| 1 | Tienda Nube (Store ID + Token) + Web URL research | Form + scraper |
| 2 | WhatsApp provider (YCloud or Meta) + Meta OAuth | Provider selector + OAuth popup |
| 3 | Identity (tone, personality) | **Voice Architect (Nova)** — OpenAI Realtime |
| 4 | Business rules (shipping, returns, payments) | Voice Architect |
| 5 | Synonym dictionary | Voice Architect |
| 6 | Review + refine + knowledge collections | Editable prompt + test agent |
| 7 | Pricing (Pro/Enterprise/Free Trial) | Pricing cards |

### Voice Architect (Nova)

Steps 3-5 use **OpenAI Realtime API** for bidirectional voice conversation:
- Nova speaks with voice "coral" in Argentine Spanish (voseo)
- User responds by voice (mic capture at native sample rate, resampled to 24kHz PCM16)
- Nova has 8 tools: `guardar_identidad`, `guardar_tono`, `guardar_reglas`, `guardar_diccionario`, `finalizar_configuracion`, `cambiar_seccion`, `mostrar_dato_extraido`, `investigar_web`
- `investigar_web` scrapes any URL the user provides (website, social media)
- Barge-in: user speaking cancels Nova's audio immediately
- VAD: threshold 0.8, silence 3000ms, prefix 500ms

### Web Research (Step 1)

Users can paste their store URL. Backend scrapes it asynchronously:
- Extracts: title, meta description, OG tags, text content
- Saves to `onboarding_progress.step_data.web_research`
- Nova uses this context when starting the voice conversation

### Meta Data Extraction

Before step 3, the system extracts data from connected Meta assets:
- Facebook page: name, category, about, fan_count, recent posts
- Instagram: username, bio, followers, media_count, recent captions
- Falls back to DB-stored data if Graph API calls fail
- Combined with web research for Nova's context

### System Prompt Refinement

Step 6 includes "Refinar con IA" button that transforms the conversation draft into a production-ready system prompt with **17 sections** (Pointe Coach anatomy):

1. Identity, 2. Identity Shield, 3. Priorities (7 rules), 4. Synonym Dictionary, 5. Query Strategy & Fallback, 6. Truthfulness Gate, 7. Tone & Personality, 8. Interaction Rules, 9. First Interaction Protocol, 10. Anti-Loop Rules, 11. Available Tools, 12. Results Rule, 13. Call to Action, 14. WhatsApp Format, 15. Content Rules, 16. Store Knowledge, 17. Error Handling & Edge Cases

### Agent Sync

`/admin/onboarding-wizard/complete` creates or updates the agent:
- Uses `system_prompt_draft` (the refined prompt) — not a generic placeholder
- Checks for existing agent → UPDATE instead of INSERT (no duplicates)
- Saves `knowledge_sources` if user selected RAG collections
- Sets `completed_at` to mark wizard as done

### OnboardingGate

`RequireAuth` wrapper that checks `/admin/onboarding-wizard/progress`:
- Users with `completed_at = null` AND `has_agents = false` → redirect to `/onboarding-wizard`
- Users at step >= 6 are NOT blocked (can access dashboard via sidebar)
- Super admin bypasses entirely
- Uses `x-user-email` header for multi-tenant safe user resolution

## Voice Widget (v1.0)

Embeddable voice assistant widget for Tienda Nube stores:

- **Configuration page** at `/voice-widget` (demo mode for Free users)
- **Multiple widgets per tenant** (one per store, different agents)
- **Providers**: OpenAI Realtime API or NVIDIA Riva NIM
- **Billing**: Pro 60 min/month (+$19), Enterprise 300 min/month (+$39), BYOK unlimited
- **Abuse detection**: off-topic → IP blocked → WhatsApp CTA
- **SDK**: `voice-widget-sdk.js` — vanilla JS, Shadow DOM, <30KB
- **States**: idle, connecting, active, blocked, minutes_exhausted

## Key Patterns

### Sovereign Credential Vault
All API keys are encrypted at rest with AES-256 (Fernet). Decrypted only at runtime, never exposed to frontend. Each tenant manages their own keys.

### Platform API Key (Free Trial)
The `OPENAI_API_KEY` environment variable is the company's global key. It pays for:
- Onboarding wizard (voice conversation + TTS)
- Free trial usage (50 messages)
- Knowledge upload/vectorization for free trial users
- Voice Widget in "platform" mode

### Universal Delivery Relay
All outbound messages route through `whatsapp_service /messages/relay`. It resolves the provider (YCloud, Meta Direct, Chatwoot) and delivers via the appropriate API.

### Smart Buffer + Dedup Guard
Inbound messages are buffered in Redis with debounce (11s WhatsApp, 8s Instagram/Facebook). Atomic Lua-script fetch ensures no race conditions. The dedup guard prevents re-processing.

### Multi-Tenant Auth (Cross-Origin)
EasyPanel deploys frontend and orchestrator on different subdomains → JWT cookies don't cross origins. Solution:
- Frontend stores `user_email` in localStorage on login
- `useApi` sends `x-user-email` header on every request
- Backend `get_wizard_user` resolves user by email when JWT fails
- Each user gets their own isolated onboarding progress

### Shadow RAG
Conversation messages are passively indexed into the vector store for semantic search across historical interactions.
