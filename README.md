# Future — Sovereign AI-Powered Customer Engagement Platform

**The first multi-tenant AI Operating System for omnichannel customer engagement.** Connect WhatsApp, Instagram, Facebook Messenger & Web — powered by polymorphic AI agents, RAG knowledge bases, creative AI studio, and real-time ROI attribution. All in one platform, with sovereign data isolation per tenant.

`Python` `React` `TypeScript` `FastAPI` `LangChain` `Meta Graph API` `Stripe` `MercadoPago`

---

## Table of Contents

- [Vision & Value Proposition](#-vision--value-proposition)
- [Meta Direct Connection](#-meta-direct-connection--embedded-signup)
- [True Omnichannel (Meta + Chatwoot + YCloud)](#-true-omnichannel-meta--chatwoot--ycloud)
- [AI Agents & Knowledge Base (RAG)](#-ai-agents--knowledge-base-rag)
- [Creative Studio (Business Forge)](#-creative-studio-business-forge)
- [SaaS Billing & Multi-Tenancy](#-saas-billing--multi-tenancy)
- [Technology Stack & Architecture](#-technology-stack--architecture)
- [AI Models & Capabilities](#-ai-models--capabilities)
- [Key Features](#-key-features)
- [Project Structure](#-project-structure)
- [Deployment Guide (Quick Start)](#-deployment-guide-quick-start)
- [Documentation Hub](#-documentation-hub)
- [License](#-license)

---

## Vision & Value Proposition

Future is more than a chatbot platform: it is a **Digital Business Coordinator + Marketing Intelligence Platform** designed for businesses of any size. Built on **Sovereignty**, **Multi-Tenancy**, and **Data-Driven Growth**, it delivers an AI-driven OS that manages customer conversations, automates responses, tracks marketing ROI, and generates creative content — all while keeping each business's data strictly isolated.

### For Whom

| Audience | Value |
|----------|-------|
| **E-commerce businesses** | Connect your store (Tienda Nube), let AI handle sales conversations on WhatsApp/IG/FB. Know which campaign brought each customer. |
| **Agencies / SaaS resellers** | Each client (tenant) has isolated data, agents, credentials, and analytics. Manage all from one platform. |
| **Marketing teams** | Measure real conversion from Meta campaigns. AI-generated product photos and multi-channel campaigns from one studio. |
| **Support teams** | AI handles L1 support with RAG-powered knowledge. Human handoff when needed, with full context preservation. |
| **Solo entrepreneurs** | Free trial, connect WhatsApp via popup, AI responds 24/7. No code required. |

### Sovereign Data & Security

Future implements a **Proactive Hardening Protocol** to protect business integrity:

- **Data Isolation:** Every query is filtered by `tenant_id`. Identity resolved from JWT and database, never from client parameters.
- **Credential Vault:** All API keys encrypted at rest with AES-256 (Fernet). Decrypted only at runtime, never exposed to frontend.
- **Auth Layers:** JWT + bcrypt for users. `X-Admin-Token` for admin routes. `X-Internal-Secret` for inter-service communication.
- **OAuth 2.0:** Google Sign-In + Facebook Login for Business (Meta Embedded Signup).
- **Subscription Guard:** Middleware blocks API access when trial expires or plan limits exceeded.

---

## Meta Direct Connection — Embedded Signup

> **"Connect Instagram, Facebook & WhatsApp in 30 seconds via a popup. No API keys, no manual setup."**

Future is the first customer engagement platform that offers **Meta Embedded Signup** as a zero-config connection method. Users click a button, authorize in Meta's popup, and their channels are live immediately.

### How It Works

```
User clicks "Connect Meta" in Future dashboard
    |
Facebook Login for Business popup opens
    |
User grants permissions (pages, Instagram, WhatsApp)
    |
Future receives Authorization Code
    |
meta_service exchanges code -> long-lived token
    |
Discovers all assets (Pages, IG accounts, WABAs)
    |
Credentials stored encrypted (AES-256) per tenant
    |
Webhooks auto-subscribed for messaging events
    |
DMs start arriving in the Chats page instantly
```

### What Gets Connected

| Asset | Auto-discovered | Webhook | AI Response |
|-------|:--------------:|:-------:|:-----------:|
| Facebook Pages | Yes | `messages` field subscribed | Via Graph API (page token) |
| Instagram Business | Yes (linked to page) | `messages` field subscribed | Via Graph API (page token) |
| WhatsApp Business | Yes (if WABA exists) | `messages` field subscribed | Via Cloud API (WABA token) |

### Sender Profile Resolution

Future automatically fetches sender information from Meta Graph API:

- **Instagram:** Name, username, profile picture
- **Facebook:** Full name (via conversations endpoint, v13+ compliant), profile picture
- **WhatsApp:** Contact name from webhook payload

### Credential Security

| Credential | Storage | Purpose |
|------------|---------|---------|
| `META_USER_LONG_TOKEN` | AES-256 encrypted | Long-lived user access token |
| `META_PAGE_TOKEN_{page_id}` | AES-256 encrypted | Per-page token for Graph API |
| `meta_page_token` | AES-256 encrypted | General token for relay service |
| `META_WA_TOKEN_{waba_id}` | AES-256 encrypted | WhatsApp Business token |

> **Full technical documentation:** [`docs/META_CONNECTION.md`](docs/META_CONNECTION.md)

---

## True Omnichannel (Meta + Chatwoot + YCloud)

The AI lives where your customers are. Future connects to **every major messaging channel** through a unified interface, supporting **three providers simultaneously**:

### Providers & Channels

| Provider | WhatsApp | Instagram | Facebook | Connection Method |
|----------|:--------:|:---------:|:--------:|-------------------|
| **Meta Direct** | Yes* | Yes | Yes | Meta Embedded Signup (popup) |
| **Chatwoot** | Yes | Yes | Yes | Chatwoot webhook bridge |
| **YCloud** | Yes | No | No | YCloud API (direct) |

*WhatsApp via Meta Direct requires WABA connected.

All three providers coexist. A tenant can have Meta Direct for Instagram, YCloud for WhatsApp, and Chatwoot for Facebook — simultaneously.

### How It Works

```
Customer sends message via WhatsApp / Instagram / Facebook / Web
    |
+-----------------------------------------------------------+
|  Future Orchestrator                                       |
|  +------------+  +------------+  +------------+            |
|  |  WhatsApp   |  | Instagram  |  |  Facebook  |            |
|  | (YCloud /   |  |(Meta Direct|  |(Meta Direct|            |
|  |  Meta/CW)   |  |  / CW)    |  |  / CW)    |            |
|  +------+------+  +-----+-----+  +-----+------+            |
|         +----------------+----------------+                 |
|                          |                                  |
|                 AI Agent (Same brain)                       |
|                 RAG Knowledge Base                          |
|                 Same customer DB                            |
|                 Same analytics                              |
+-----------------------------------------------------------+
    |
Chats page shows ALL conversations in one unified view
(filter by: Channel | Provider | Human Override)
```

### Key Omnichannel Features

- **Unified Inbox:** All channels appear in the same Chats view with platform-specific badges (WA green, IG pink, FB blue, Chatwoot cyan) and provider badges (META, CHATWOOT).
- **Provider Filter:** Dropdown to show only Meta Direct, Chatwoot, or YCloud conversations.
- **Channel Filter:** WhatsApp, Instagram, Facebook, or Human Override conversations.
- **Identity Link:** Same person messaging on Instagram and WhatsApp linked to one customer record (cross-channel identity).
- **Universal Delivery Relay:** Single `/messages/relay` endpoint routes to the correct provider API automatically.
- **24h Window Policy:** WhatsApp session tracking. After 24h inactivity, UI shows template selector for re-engagement.
- **Human Override:** Toggle to pause AI and take manual control. Visual amber "HUMAN OVERRIDE" badge.
- **Smart Buffer:** 5-second debounce window combines rapid messages before AI processing.
- **Dedup Guard:** Prevents agent from re-processing messages that already have a reply.
- **Real-time Polling:** Chat list refreshes every 10s, messages every 3s.

> **Full technical documentation:** [`docs/OMNICHANNEL_CHATS.md`](docs/OMNICHANNEL_CHATS.md)

---

## AI Agents & Knowledge Base (RAG)

### Polymorphic Agent Factory

Each tenant gets customizable AI agents with different personalities, tools, and knowledge:

| Agent Type | Purpose | Example Use |
|-----------|---------|-------------|
| **Sales** | Product recommendations, upselling, cart recovery | E-commerce stores |
| **Support** | FAQ handling, ticket creation, troubleshooting | SaaS companies |
| **Leads** | Lead qualification, appointment scheduling | Service businesses |
| **Logistics** | Order tracking, shipping status, delivery updates | Fulfillment |
| **Custom** | User-defined system prompt and tools | Anything |

### Agent Execution Flow

```
Customer message arrives
    |
Smart Buffer (5s debounce, combines rapid messages)
    |
Dedup Guard (skip if agent already replied)
    |
Fetch agent config for tenant (model, temperature, tools, channels)
    |
Build conversation history (last N messages from Redis)
    |
RAG context injection (semantic search on knowledge base)
    |
LangChain agent execution (tools + memory)
    |
Response generated -> multi-bubble splitting (natural chunks)
    |
Delivery via Universal Relay -> correct provider API
```

### Knowledge Base (RAG Pipeline)

```
Upload PDF / DOCX / TXT / CSV
    |
Text extraction (PyPDF, docx2txt)
    |
Chunking (RecursiveCharacterTextSplitter)
    |
Embedding (OpenAI text-embedding-3-small)
    |
Storage in PostgreSQL pgvector
    |
Tenant-isolated collections
```

When the agent processes a message:
1. Query is embedded using the same model
2. pgvector finds top-K similar chunks (cosine similarity)
3. Relevant context injected into the agent's prompt
4. Agent generates response with knowledge grounding

### Shadow RAG (Passive Learning)

Conversation messages are automatically indexed into the vector store (`is_shadow_indexed` flag). This enables semantic search across historical conversations without manual upload — the AI learns from every interaction.

### Custom Tools

Agents can use tools defined per-tenant:
- **HTTP tools:** Call external APIs (webhooks, CRMs, ERPs)
- **Function tools:** Execute predefined functions
- **Integration tools:** Connect to Tienda Nube, calendars, etc.

> **Full technical documentation:** [`docs/AGENTS_AND_RAG.md`](docs/AGENTS_AND_RAG.md)

---

## Creative Studio (Business Forge)

> **"Generate professional marketing content with AI. Product photos, model shoots, multi-channel campaigns — all aligned with your brand DNA."**

### Features

| Feature | Description | AI Model |
|---------|-------------|----------|
| **Brand DNA Extraction** | Analyzes website + catalog → colors, typography, tone, style | Gemini Pro |
| **Photoshoot Studio** | 5 templates: Studio, Floating, Lifestyle, In Use, Ingredient | Gemini Flash/Pro |
| **Model Shoot** | 8 scene templates with AI-generated models | Gemini Flash/Pro |
| **Campaign Generator** | Multi-channel: Instagram, Facebook, WhatsApp, Email, Web | Gemini + GPT |
| **Prompt Enhancer** | Transforms simple descriptions into professional prompts | GPT |
| **Image Editor** | Edit and iterate on generated images | Gemini |

### How Brand DNA Works

```
Enter your website URL
    |
AI analyzes: layout, colors, typography, product catalog
    |
Extracts: brand palette, visual style, tone of voice, target audience
    |
Stored as brand_dna asset per tenant
    |
All subsequent generations are automatically aligned with your brand
```

### BYOK (Bring Your Own Key)

Each tenant uses their own Google API key for image generation. Keys stored encrypted in the credential vault. Costs are per-tenant, transparent.

> **Full technical documentation:** [`docs/CREATIVE_STUDIO.md`](docs/CREATIVE_STUDIO.md)

---

## SaaS Billing & Multi-Tenancy

### Plans

| Feature | Free Trial | Pro | Enterprise |
|---------|:----------:|:---:|:----------:|
| Duration | 10 days | Monthly | Monthly |
| Agents | 1 | Unlimited | Unlimited |
| Messages/month | 100 | 5,000 | Unlimited |
| Knowledge docs | 5 | 50 | Unlimited |
| Channels | 1 | 3 | Unlimited |
| Creative Studio | Limited | Full | Full |
| Payment Providers | — | Stripe / MercadoPago | Stripe / MercadoPago |

### Subscription Lifecycle

```
Register -> Free Trial (10 days)
    -> Day 7: warning email
    -> Day 9: final warning
    -> Day 10: trial expires -> API blocked
    -> Checkout -> Pro/Enterprise (active)
    -> Cancel -> past_due -> suspended
```

### Multi-Tenancy Architecture

- **Strict Isolation:** Every resource filtered by `tenant_id` — agents, conversations, credentials, knowledge, billing, gallery
- **Credential Vault:** Per-tenant API keys (OpenAI, Google, Meta, SMTP) encrypted with AES-256
- **Subscription Guard:** Middleware blocks access when trial expired or limits exceeded
- **Usage Tracking:** Messages sent, tokens consumed, LLM costs per tenant per period
- **Platform Tower:** Super admin panel with MRR, revenue, costs, tenant management

> **Full technical documentation:** [`docs/BILLING.md`](docs/BILLING.md)

---

## Technology Stack & Architecture

Future uses a **Sovereign Microservices Architecture**, designed to scale while keeping strict isolation per tenant.

### Frontend (Dashboard)

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite 5.0 (fast HMR & build) |
| **Styling** | Tailwind CSS 3.4 |
| **Icons** | Lucide React |
| **Routing** | React Router DOM v6 |
| **State** | Context API (Auth, Language) |
| **Deployment** | Docker + Nginx (SPA mode) |

### Backend (Microservices)

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| `orchestrator_service` | 8000 | FastAPI (Python 3.11+) | Central hub: auth, agents, chats, billing, RAG, platform admin |
| `agent_service` | 8001 | FastAPI + LangChain | AI agent execution with tool calling |
| `whatsapp_service` | 8002 | FastAPI | Universal delivery relay (YCloud, Meta, Chatwoot) |
| `tiendanube_service` | 8003 | FastAPI | E-commerce sync (Tienda Nube OAuth + catalog) |
| `meta_service` | 8004 | FastAPI | Meta OAuth, webhook reception, Graph API proxy |
| `bff_service` | 3000 | Express.js (Node.js) | Backend-for-Frontend proxy (CORS, timeout) |

### Infrastructure & Persistence

| Layer | Technology |
|-------|------------|
| **Database** | PostgreSQL 13 + pgvector (semantic search) |
| **Cache / PubSub** | Redis (buffering, dedup, agent memory, real-time events) |
| **Containers** | Docker & Docker Compose |
| **Deployment** | EasyPanel, Render, AWS ECS compatible |
| **Migrations** | Idempotent on startup (`CREATE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) |

### Security & Authentication

| Mechanism | Description |
|-----------|-------------|
| **User Auth** | JWT + bcrypt password hashing |
| **OAuth** | Google Sign-In + Facebook Login for Business |
| **Admin Auth** | `X-Admin-Token` header for `/admin/*` routes |
| **Inter-service** | `X-Internal-Secret` + `X-Internal-Token` headers |
| **Credential Vault** | AES-256 Fernet encryption at rest, runtime-only decryption |
| **Multi-tenancy** | Strict `tenant_id` filter on every query |
| **Webhook Security** | HMAC-SHA256 signature verification (Meta `X-Hub-Signature-256`) |

### Architecture Diagram

```
                        +-------------------+
                        |   Frontend (SPA)  |
                        |  React 18 + Vite  |
                        +--------+----------+
                                 |
                        +--------+----------+
                        |   BFF Service     |
                        |   Express.js      |
                        +--------+----------+
                                 |
                  +--------------+--------------+
                  |                             |
         +--------+----------+     +-----------+-----------+
         |   Orchestrator    |     |    Platform Tower     |
         |   (FastAPI Hub)   |     |    (Super Admin)      |
         +--+-----+-----+---+     +-----------------------+
            |     |     |
   +--------+  +--+--+  +--------+--------+
   |           |     |           |        |
+--+---+ +----+--+ +-+------+ +-+-----+ ++--------+
|Agent | |WhatsApp| |  Meta  | |Tienda | |  Redis  |
|Svc   | |Service | |Service | |Nube   | | PubSub  |
+------+ +--------+ +--------+ +-------+ +---------+
   |         |           |         |          |
   +----+----+-----------+---------+----------+
        |
  +-----+------+
  | PostgreSQL  |
  | + pgvector  |
  +-------------+
```

---

## AI Models & Capabilities

| Model | Provider | Use Case |
|-------|----------|----------|
| **gpt-5-mini** | OpenAI | Default agent: conversation, sales, support |
| **gpt-5.2** | OpenAI | Advanced reasoning, complex workflows |
| **gpt-5.2-pro** | OpenAI | Premium: highest quality responses |
| **gpt-5-nano** | OpenAI | Fast, cost-efficient for simple tasks |
| **gpt-4.1** | OpenAI | Legacy support |
| **Gemini 3 Pro** | Google | 1M context window, image generation |
| **Gemini 2.5 Flash** | Google | Fast, vision-capable |
| **Claude 3.5 Sonnet** | Anthropic | Experimental support |
| **text-embedding-3-small** | OpenAI | RAG embeddings (vector search) |

### Agent Capabilities

- **Conversation:** Greeting with business identity, product/service recommendations, FAQ handling, appointment scheduling.
- **RAG-Powered:** Answers grounded in uploaded documents + conversation history (Shadow RAG).
- **Multi-Channel:** Same agent brain across WhatsApp, Instagram, Facebook, Web.
- **Human Handoff:** Automatic escalation with context preservation. 24h override window.
- **Multi-Bubble:** Long responses split into natural conversation chunks with 4s spacing.
- **Tools:** Custom HTTP/function/integration tools per tenant.
- **BYOK:** Each tenant uses their own OpenAI/Google/Anthropic API key.

---

## Key Features

### Omnichannel Inbox (Chats)

- **Unified view** for WhatsApp, Instagram, Facebook, Web conversations.
- **Provider filter** (Meta Direct / Chatwoot / YCloud) + **Channel filter** (WA / IG / FB).
- **Provider badges:** Visual META / CHATWOOT indicators on each conversation.
- **Sender profiles:** Name + avatar fetched from Meta Graph API.
- **Human Override:** Pause AI per conversation with visual lock indicator.
- **24h session window:** Template selector for WhatsApp re-engagement.
- **Real-time:** 10s chat list polling, 3s message polling.

### Meta Direct Connection

- **Popup flow:** Facebook Login for Business → auto-discover Pages, Instagram, WhatsApp.
- **Zero-config webhooks:** Auto-subscribed on connection.
- **Secure credentials:** Encrypted per-tenant, per-page tokens.
- **Sender resolution:** Name + avatar from Graph API (Instagram profile, Facebook conversations endpoint).

### AI Agent Factory

- **Polymorphic agents:** Sales, Support, Leads, Logistics, Custom.
- **Model selection:** OpenAI, Google Gemini, Anthropic Claude per agent.
- **Temperature control:** Creativity slider (0.0–1.0).
- **Tool selection:** Custom tools per agent.
- **Channel routing:** Agent handles specific channels (e.g., Sales on WhatsApp, Support on IG).
- **Smart Buffer:** 5s debounce combines rapid messages.

### Knowledge Base (RAG)

- **Upload:** PDF, DOCX, TXT, CSV.
- **Semantic search:** pgvector cosine similarity.
- **Collections:** Organize by topic/category.
- **Shadow RAG:** Passive learning from conversations.
- **Tenant isolation:** Per-tenant vector spaces.

### Creative Studio (Business Forge)

- **Brand DNA:** Auto-extract from website + catalog.
- **Photoshoot:** 5 professional scene templates.
- **Model Shoot:** 8 scene templates with AI models.
- **Campaigns:** Multi-channel content (IG, FB, WA, Email, Web).
- **BYOK:** Per-tenant Google API keys for image generation.

### SaaS Billing

- **Plans:** Free Trial (10 days), Pro, Enterprise.
- **Providers:** Stripe (international) + MercadoPago (LATAM).
- **Usage tracking:** Messages, tokens, LLM costs per tenant.
- **Subscription Guard:** Auto-blocks API when limits exceeded.
- **Trial Manager:** Warning emails at day 7, 9, 10.

### Platform Tower (Super Admin)

- **MRR Dashboard:** Revenue, costs, margins, growth.
- **Tenant Management:** List, suspend, activate, change plan.
- **Audit Logs:** Track admin actions across the platform.
- **Infrastructure:** Redis/DB stats, health checks.

### E-Commerce Integration (Tienda Nube)

- **OAuth connection:** Popup flow for Tienda Nube stores.
- **Catalog sync:** Products, categories, prices, images.
- **Order management:** Track orders, shipping status.
- **AI context:** Agent uses product catalog for sales conversations.

### Analytics & ROI

- **Assist Score Protocol:** Real-time AI performance quantification.
- **Sales attribution:** AI-driven conversion tracking.
- **Support savings:** Deflected human support cost calculation.
- **Conversation analytics:** Message count, response time, resolution rates.

---

## Project Structure

```
Future/
+-- frontend_react/                # React 18 + Vite SPA (Dashboard)
|   +-- src/
|   |   +-- views/                 # Dashboard, Chats, Agents, Knowledge, Channels,
|   |   |                          # Analytics, Billing, Settings, BusinessForge,
|   |   |                          # Credentials, Profile, PlatformTower, MetaSettings,
|   |   |                          # YCloudSettings, ChatwootSettings, MagicOnboarding
|   |   +-- components/            # Layout, Sidebar, AgentCard, RoiTicker,
|   |   |                          # FrustrationGauge, SystemStatus, TelemetryHUD
|   |   +-- contexts/              # AuthContext, LanguageContext
|   |   +-- hooks/                 # useApi, useFacebookSdk
|   |   +-- assets/
|   +-- package.json
|   +-- vite.config.ts
|
+-- orchestrator_service/          # FastAPI Core (Central Hub)
|   +-- main.py                    # App, /chat, webhooks, agent orchestration, migrations
|   +-- admin_routes.py            # /admin/* (chats, credentials, integrations, handoff)
|   +-- app/
|   |   +-- core/
|   |   |   +-- engine.py          # NexusEngine (agent setup + ignition)
|   |   |   +-- rag.py             # RAGCore (pgvector semantic search)
|   |   |   +-- credentials.py     # Sovereign Credential Vault
|   |   |   +-- config.py          # Pydantic Settings
|   |   |   +-- resilience.py      # safe_db_call decorator
|   |   +-- routes/
|   |   |   +-- auth_routes.py     # JWT auth, Google OAuth, registration
|   |   |   +-- billing_routes.py  # Stripe, MercadoPago, plans, subscriptions
|   |   |   +-- gallery_routes.py  # Creative Studio (Brand DNA, Photoshoot, Campaigns)
|   |   |   +-- ingest_routes.py   # Meta webhook ingestion + agent trigger
|   |   |   +-- platform_routes.py # Super admin (tenants, MRR, audit)
|   |   +-- models/                # Pydantic + SQLAlchemy models
|   |   +-- api/
|   |       +-- agents.py          # Agent CRUD + templates
|   |       +-- templates.py       # WhatsApp message templates
|   +-- db.py                      # Async PostgreSQL + Redis connection
|   +-- utils.py                   # Encryption/decryption utilities
|   +-- requirements.txt
|
+-- agent_service/                 # LangChain Agent Execution
|   +-- app/core/
|   |   +-- agent_templates.py     # Agent persona factory
|   +-- main.py
|   +-- requirements.txt
|
+-- whatsapp_service/              # Universal Delivery Relay
|   +-- main.py                    # /messages/relay, /webhook/ycloud, /webhook/chatwoot
|   +-- ycloud_client.py           # YCloud WhatsApp API client
|   +-- chatwoot_client.py         # Chatwoot API client
|   +-- requirements.txt
|
+-- meta_service/                  # Meta OAuth & Webhook Service
|   +-- main.py                    # /connect, /webhook, /subscribe, /messages/send
|   +-- core/
|   |   +-- auth.py                # OAuth code exchange, asset discovery
|   |   +-- webhooks.py            # Signature verification, payload normalization
|   |   +-- client.py              # Orchestrator client (ingest forwarding)
|   +-- requirements.txt
|
+-- tiendanube_service/            # E-Commerce Sync
|   +-- main.py                    # OAuth, catalog sync, order management
|   +-- requirements.txt
|
+-- bff_service/                   # Backend-for-Frontend (Express proxy)
|   +-- src/index.ts               # Reverse proxy: Frontend -> Orchestrator
|   +-- package.json
|
+-- docs/                          # Documentation (9 files + archive)
|   +-- README.md                  # Documentation hub
|   +-- ARCHITECTURE.md            # System architecture
|   +-- API_REFERENCE.md           # All REST endpoints
|   +-- META_CONNECTION.md         # Meta Embedded Signup flow
|   +-- OMNICHANNEL_CHATS.md       # Multi-provider chat system
|   +-- AGENTS_AND_RAG.md          # AI agents + RAG pipeline
|   +-- BILLING.md                 # Plans, Stripe, MercadoPago
|   +-- CREATIVE_STUDIO.md         # Brand DNA, Photoshoot, Campaigns
|   +-- DEPLOYMENT.md              # Docker, EasyPanel, env vars
|   +-- TROUBLESHOOTING.md         # Common issues
|   +-- archive/                   # Legacy documentation
|   +-- specs/                     # Active feature specifications
|
+-- specs/                         # Feature specs in development
+-- docker-compose.yml             # Full stack (6 services + postgres + redis)
+-- easypanel.json                 # Production deployment config
+-- .gitignore
+-- README.md                      # This file
```

---

## Deployment Guide (Quick Start)

Future follows a **clone and run** approach. With Docker you don't need to install Python or Node locally.

### Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Git**
- **OpenAI API Key** (required for AI agents)

### Standard Deployment

**1. Clone the repository**

```bash
git clone https://github.com/adriangmrraa/MultiAgents-Platform-ROI.git
cd "Platform AI Solutions"
```

**2. Environment configuration**

```bash
cp .env.example .env
# Edit .env:
# - SECRET_KEY (JWT secret)
# - POSTGRES_DSN / REDIS_URL
# - OPENAI_API_KEY
# - ADMIN_TOKEN, INTERNAL_API_TOKEN
# - META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN (for Meta connection)
# - STRIPE_SECRET_KEY (for billing)
# - VITE_FACEBOOK_APP_ID, VITE_META_CONFIG_ID (for frontend)
```

**3. Start services**

```bash
docker-compose up -d --build
```

**4. Access**

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | `http://localhost` | Dashboard SPA |
| **Orchestrator** | `http://localhost:8000` | Core API |
| **Swagger UI** | `http://localhost:8000/docs` | Interactive API docs |
| **Meta Service** | `http://localhost:8004/docs` | Meta OAuth & webhooks |
| **WhatsApp Service** | `http://localhost:8002` | Delivery relay |
| **BFF Service** | `http://localhost:3000` | Frontend proxy |

> **Full deployment guide:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## Documentation Hub

| Document | Description |
|----------|-------------|
| [**Architecture**](docs/ARCHITECTURE.md) | Microservices, data flow, patterns, database schema |
| [**API Reference**](docs/API_REFERENCE.md) | All REST endpoints by service |
| [**Meta Connection**](docs/META_CONNECTION.md) | Meta Embedded Signup, webhooks, credential storage, response delivery |
| [**Omnichannel Chats**](docs/OMNICHANNEL_CHATS.md) | Multi-provider inbox, filtering, identity link, human override |
| [**Agents & RAG**](docs/AGENTS_AND_RAG.md) | Polymorphic agents, RAG pipeline, shadow RAG, custom tools |
| [**Billing & SaaS**](docs/BILLING.md) | Plans, Stripe, MercadoPago, subscription lifecycle |
| [**Creative Studio**](docs/CREATIVE_STUDIO.md) | Brand DNA, Photoshoot, Model Shoot, Campaigns |
| [**Deployment**](docs/DEPLOYMENT.md) | Docker Compose, EasyPanel, environment variables |
| [**Troubleshooting**](docs/TROUBLESHOOTING.md) | Common issues, Meta webhook debugging, agent errors |

---

## License

Future Platform (c) 2026. All rights reserved.
