# 🛸 Nexus v7.6: Sovereign Platinum SaaS

> **The Ultimate AI-Driven OS for E-Commerce Excellence.**
> *Omnichannel Orchestration, Sovereign Data Privacy, and Real-Time ROI Quantification.*

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-7.6%20Platinum-blue.svg)](docs/PROJECT_STATUS.md)
[![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org)

---

## 📋 Table of Contents

- [Vision & Value Proposition](#-vision--value-proposition)
- [Technology Stack](#%EF%B8%8F-technology-stack--architecture)
- [AI Models & Capabilities](#-ai-models--capabilities)
- [Key Features](#-key-features)
- [Project Structure](#-project-structure)
- [Deployment Guide](#-deployment-guide-quick-start)
- [Documentation Hub](#-documentation-hub)
- [Contributing](#-contributing)
- [License](#%EF%B8%8F-license--ethics)

---

## 🌟 Vision & Value Proposition

Nexus is more than just a chatbot; it's a **Digital Workforce** designed for high-impact E-Commerce operations. Built on the pillars of **Sovereignty, Scalability, and Value**, Nexus v7.6 "Platinum" introduces the industry's first self-auditing AI engine.

### 💰 Direct ROI Quantification
Through the **Assist Score Sovereign Protocol**, Nexus actively monitors its own performance. Every assistance provided is categorized and valued (Sales vs. Support), allowing store owners to see real-time operational savings and conversion impact directly on their dashboard.

### 🛡️ Sovereign Privacy (Vault-First)
Your data, your keys, your intelligence. Nexus uses a **Zero-Dependency Credential Vault (AES-256)**. Identity and API keys are injected dynamically at runtime, ensuring complete isolation in multi-tenant environments. No more `.env` leaks or shared global keys.

### 🌐 True Omnichannel Reach
Nexus lives where your customers are. A single AI brain can manage:
*   **WhatsApp Cloud API** (Direct Meta Integration)
*   **Instagram Direct & Facebook Messenger**
*   **Nexus Web Widget** (Zero-Config, fully customizable)
*   **Human Handoff** (Seamless transition via Chatwoot bridge)

---

## 🛠️ Technology Stack & Architecture

Nexus v7.6 uses a **Sovereign Microservices Architecture**, designed to scale horizontally while maintaining strict privacy for each tenant.

### 🎨 Frontend (Sovereign Interface)
-   **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/) (Ultra-fast HMR & Build)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) v3
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Routing**: React Router DOM v6
-   **State Management**: Context API + Fetch API (No Redux, atomic state)
-   **Deployment**: Docker + Nginx (SPA Mode)

### ⚙️ Backend (The Core)
-   **Orchestrator**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) - Async Central Brain
-   **Framework Add-ons**: Pydantic v2, Uvicorn (ASGI Server)
-   **Microservices**:
    -   `orchestrator_service`: Main API & Agent Orchestration
    -   `agent_service`: Polymorphic Agent Factory (LangChain)
    -   `whatsapp_service`: Universal Delivery Gateway (Meta/YCloud/Chatwoot)
    -   `meta_service`: OAuth Diplomat for Facebook/Instagram
    -   `tiendanube_service`: E-commerce Synchronization Broker
    -   `bff_service`: Backend-for-Frontend (Node.js/Express) for optimization

### 🗄️ Infrastructure & Persistence
-   **Database**: [PostgreSQL 13+](https://www.postgresql.org/) (Relational)
-   **Vector Memory**: [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector) Extension for RAG (Semantic Search)
-   **Cache & Events**: [Redis 7](https://redis.io/) (Atomic Buffers, PubSub, Session Management)
-   **Containers**: Docker & Docker Compose (Industry Standard)
-   **Deployment Platforms**: EasyPanel, Render, AWS ECS (Compatible)

### 🤖 Artificial Intelligence Layer
-   **Orchestration**: [LangChain 0.1.0](https://www.langchain.com/) + Custom Agent Factory
-   **Supported Models**:
    -   **OpenAI**: `gpt-4o` (Recommended), `gpt-4o-mini` (Default)
    -   **Google**: `gemini-2.5-flash` (Vision/Text), `gemini-3.1-flash-image-preview` (Image Gen), `gemini-3-pro-image-preview` (Pro Image Gen)
    -   **Anthropic**: `claude-3.5-sonnet` (Experimental Support)
-   **RAG Engine**: "Shadow RAG" (Passive Learning) + Tenant-Isolated Collections
-   **Vector Embeddings**: OpenAI `text-embedding-3-small`
-   **Image Generation**: Gemini 3.x Native (Nano Banana 2 / Pro) — BYOK per tenant
-   **Authentication**: Google OAuth 2.0 + Email/Password

### 🔐 Security & Authentication
-   **Encryption**: AES-256 (Fernet) for credentials at rest
-   **Auth**: JWT-based authentication with bcrypt password hashing
-   **Internal API**: `X-Internal-Secret` and `X-Internal-Token` for microservice communication
-   **Admin Auth**: Global `X-Admin-Token` for administrative routes
-   **Multi-Tenancy**: Strict tenant isolation at database and runtime level

---

## 🧠 AI Models & Capabilities

### Chat & Agent Models
| Model | Provider | Use Case | Context Window | Speed |
|-------|----------|----------|----------------|-------|
| `gpt-4o` | OpenAI | Sales Agents, Complex Reasoning | 128k tokens | Medium |
| `gpt-4o-mini` | OpenAI | **Default**, Support, Classification | 128k tokens | Fast |
| `gemini-2.5-flash` | Google | Vision Analysis, Brand DNA, Fast Tasks | 1M tokens | Very Fast |

### Image Generation Models (Creative Studio — BYOK)
| Model ID | Internal Name | Use Case | Image-to-Image | Cost |
|----------|--------------|----------|:-:|------|
| `gemini-3.1-flash-image-preview` | **Nano Banana 2** | Fast generation, high volume | Up to 14 refs | ~$0.04/img |
| `gemini-3-pro-image-preview` | **Nano Banana Pro** | Max quality, photorealism | Up to 14 refs | ~$0.07/img |

### AI Capabilities
- **Polymorphic Agents**: Sales, Support, Logistics, Creative Director
- **Tool Usage**: Product search, stock check, order tracking, email sending
- **RAG (Retrieval-Augmented Generation)**: PDF/DOCX ingestion, semantic search
- **Image Analysis**: Product recognition via Gemini Vision
- **Image Generation**: Gemini 3.x native with image-to-image reference support (tenant-owned API keys)
- **AI Prompt Enhancer**: Transforms basic prompts into professional art-director-level instructions
- **Brand DNA Extraction**: Automatic brand identity analysis from websites
- **Conversion Copy**: Campaign text generation using AIDA/FOMO/exclusivity frameworks
- **Multilingual**: Spanish, English (i18n support)

---

## 🚀 Key Features

### 🎯 Agent Orchestration
- **Dynamic Agent Factory**: Create Sales, Support, or Custom agents on-the-fly
- **Hybrid Prompting**: Separate technical rules from personality traits
- **Tool Selection**: Enable/disable capabilities per agent (search, email, etc.)
- **Temperature Control**: Adjust creativity vs. consistency

### 🌐 Omnichannel Communication
- **WhatsApp Business API**: Direct Meta Cloud API integration
- **Instagram & Facebook Messenger**: Unified inbox via Meta Graph API
- **Web Widget**: Embeddable chat widget with zero config
- **Chatwoot Bridge**: Human handoff with context preservation
- **Universal Delivery Relay**: Atomic message buffering, rate limiting

### 📚 Knowledge Management (RAG)
- **Shadow RAG**: Passive learning from conversations
- **Multi-Format Ingestion**: PDF, DOCX, TXT support
- **Tenant Isolation**: Each store has its own vector space
- **Collection Management**: Organize knowledge by category
- **Semantic Search**: pgvector-powered similarity search

### 🔐 Sovereign Credentials (The Vault)
- **Zero-Dependency**: No global API keys, each tenant brings their own
- **Dynamic Injection**: Keys decrypted at runtime, never exposed
- **Category Support**: OpenAI, Google, SMTP, Tienda Nube, Meta
- **UI Masking**: Credentials displayed as `Nexus_Key_*****`
- **Audit Trail**: Track credential usage and changes

### 🎨 Creative Studio (Business Forge)
- **Brand DNA Extraction**: AI analyzes website + TiendaNube data to extract brand identity (colors, typography, personality, tone)
- **Photoshoot Studio**: 5 professional templates (Studio, Floating, Lifestyle, In Use, Ingredient) with image-to-image reference
- **Model Shoot**: 8 scene templates (Urban, Cozy Home, Outdoor, Cafe, Fitness, Workspace, Night Out, Beach) — upload model photo for face/body replication
- **Campaign Generator**: Multi-channel campaigns (Instagram, Facebook, WhatsApp, Email, Web) with parallel generation and conversion-optimized copy (AIDA, FOMO, exclusivity frameworks)
- **AI Prompt Enhancer**: Transforms basic prompts into art-director-level instructions incorporating Brand DNA
- **BYOK Image Generation**: Each tenant uses their own Google AI API key — Nano Banana 2 (gemini-3.1-flash) or Nano Banana Pro (gemini-3-pro) with image-to-image support
- **Asset Gallery**: Browse, search, filter, edit, and download all generated assets

### 📊 ROI & Analytics
- **Assist Score Protocol**: Real-time AI performance quantification
- **Sales Attribution**: Track AI-driven conversions
- **Support Savings**: Calculate deflected human support costs
- **Frustration Gauge**: Monitor customer sentiment
- **Conversation Analytics**: Message count, response time, resolution rate

### 💳 SaaS Billing System
- **Plans**: Free Trial (10 days), Pro, Enterprise — with Stripe & MercadoPago support
- **Subscription Guard**: Middleware blocks API access when trial expired, subscription canceled, or plan limits exceeded
- **Usage Tracking**: Per-tenant message count, token consumption, LLM cost tracking
- **Trial Manager**: Background service sends warning emails at day 7, 9, 10 + auto-expires
- **Invoices**: Full invoice history with payment provider tracking
- **Startup Hydration**: Existing tenants auto-receive Pro plan; new users get 10-day trial

### 🛡️ Platform Control Tower (Super Admin)
- **God Mode Dashboard**: Real-time MRR, revenue, costs, margins, trial expiration alerts
- **Tenant Management**: Search, filter, edit, suspend, activate, archive, delete tenants
- **Plan Management**: Change tenant plans, extend trials, view subscriber counts
- **Infrastructure Monitor**: Redis memory, DB size, table stats
- **Audit Logs**: Full history of admin actions with IP tracking
- **Access**: `SUPER_ADMIN_EMAIL` env var auto-promotes on startup

### 🔗 E-Commerce & Channel Integrations
- **Tienda Nube**: Full OAuth, catalog sync, order management
- **Meta Embedded Signup**: Connect WhatsApp, Instagram, Facebook via popup — auto webhook subscription, per-asset token persistence (ClinicForge-grade encryption)
- **YCloud**: Alternative WhatsApp gateway
- **Chatwoot**: Omnichannel inbox for human agents (WA, IG, FB)
- **Google OAuth**: Login/Register with Google for zero-friction onboarding
- **Multi-Channel**: Up to 3 WhatsApps, 2 Instagrams, 2 Facebooks per tenant

---

## 📁 Project Structure

```
Platform AI Solutions/
├── 📂 .agent/                    # Agent configuration & skills
│   ├── agents.md                 # Agent registry
│   ├── workflows/                # Automation workflows
│   └── skills/                   # Specialized capabilities
├── 📂 frontend_react/            # React 18 + Vite SPA
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── views/                # Page-level views
│   │   ├── contexts/             # React Context providers
│   │   └── hooks/                # Custom hooks
│   ├── package.json
│   └── vite.config.ts
├── 📂 orchestrator_service/      # FastAPI Core Orchestrator
│   ├── app/
│   │   ├── core/                 # Engine, RAG, credentials
│   │   ├── api/                  # Route handlers
│   │   ├── models/               # Pydantic schemas
│   │   └── services/             # Business logic
│   ├── main.py                   # Entry point
│   └── requirements.txt
├── 📂 agent_service/             # LangChain Agent Factory
├── 📂 whatsapp_service/          # Universal Delivery Gateway
│   ├── main.py
│   ├── ycloud_client.py
│   └── chatwoot_client.py
├── 📂 meta_service/              # Meta OAuth Diplomat
│   ├── main.py
│   └── core/
│       ├── auth.py               # OAuth flow
│       └── webhooks.py           # Instagram/FB webhooks
├── 📂 tiendanube_service/        # E-commerce Broker
├── 📂 bff_service/               # Backend-for-Frontend (Node.js)
├── 📂 docs/                      # Comprehensive Documentation
│   ├── NEXUS_ARCHITECTURAL_BLUEPRINT.md
│   ├── AGENTS_LOGIC_DEEP_DIVE.md
│   ├── INTEGRATIONS_LOGIC_DEEP_DIVE.md
│   ├── API_REFERENCE.md
│   ├── DEPLOYMENT_GUIDE_EASYPANEL.md
│   └── TROUBLESHOOTING.md
├── 📂 db/                        # Database initialization
├── 📂 scripts/                   # Utility scripts
├── docker-compose.yml            # Local development stack
├── easypanel.json                # Production deployment config
└── README.md                     # This file
```

---

## 🚀 Deployment Guide (Quick Start)

Nexus is designed under the "Clone & Run" philosophy. You don't need to install Python or Node.js locally if you use Docker.

### Prerequisites
-   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine (Linux)
-   [Git](https://git-scm.com/)
-   OpenAI API Key (minimum requirement for basic functionality)

### Standard Deployment (Recommended)

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/adriangmrraa/MultiAgents-Platform-ROI.git
    cd MultiAgents-Platform-ROI
    ```

2.  **Environment Configuration**:
    Nexus uses a "Sovereign Vault", so you only need the master bootstrap credentials.
    ```bash
    cp .env.example .env
    # Edit .env with your Master Keys
    ```

    **Required Environment Variables**:
    ```bash
    # Core
    SECRET_KEY=your-secret-key-32chars
    POSTGRES_DSN=postgresql+asyncpg://user:pass@postgres:5432/platform_ai
    REDIS_URL=redis://redis:6379/0

    # AI (for agents — tenant brings their own for Creative Studio)
    OPENAI_API_KEY=sk-...

    # Google OAuth (login/register with Google)
    GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

    # Meta Integration (WhatsApp, Instagram, Facebook)
    META_APP_ID=your-meta-app-id
    META_APP_SECRET=your-meta-app-secret
    META_VERIFY_TOKEN=your-webhook-verify-token

    # SaaS Admin
    SUPER_ADMIN_EMAIL=admin@yourdomain.com

    # Frontend
    VITE_FACEBOOK_APP_ID=your-meta-app-id
    VITE_META_CONFIG_ID=your-login-config-id
    VITE_META_EMBEDDED_SIGNUP=true
    VITE_GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
    ```

3.  **Start Engines**:
    ```bash
    docker-compose up -d --build
    ```
    *This will spin up Postgres, Redis, the Frontend, and all 5 microservices automatically.*

4.  **Access the Platform**:
    -   **Frontend**: `http://localhost:80` (or simply `http://localhost`)
    -   **API Documentation**: `http://localhost:8000/docs`

5.  **First-Time Setup**:
    -   Navigate to `http://localhost/register` to create your admin account
    -   Use the **"Magic Onboarding"** wizard to configure your first agent
    -   Add your store credentials in the **Vault** (Settings → Credentials)

### 🔧 Development Mode (Hybrid)

If you want to edit the Frontend without rebuilding containers:

```bash
cd frontend_react
npm install
npm run dev
# Access at http://localhost:5173
```

For backend development:
```bash
cd orchestrator_service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## 📚 Documentation Hub

Explore the deep logic behind the Sovereign Platinum engine:

### 🚀 Getting Started & Status
*   [**PROJECT_STATUS.md**](docs/PROJECT_STATUS.md) - **(Read First)** Current milestone progress and active roadmap
*   [**STABILITY_REPORT.md**](docs/STABILITY_REPORT.md) - Official certification of v7.6 platinum standards
*   [**TROUBLESHOOTING.md**](docs/TROUBLESHOOTING.md) - Known edge cases and surgical fixes

### 🛡️ Architecture Deep Dives
*   [**NEXUS_ARCHITECTURAL_BLUEPRINT.md**](docs/NEXUS_ARCHITECTURAL_BLUEPRINT.md) - The 5 Pillars of our Sovereign design
*   [**INTEGRATIONS_LOGIC_DEEP_DIVE.md**](docs/INTEGRATIONS_LOGIC_DEEP_DIVE.md) - Assist Score, Meta OAuth, and Multi-Tenant Routing
*   [**AGENTS_LOGIC_DEEP_DIVE.md**](docs/AGENTS_LOGIC_DEEP_DIVE.md) - Neural logic, tool usage, and auditing ticks
*   [**CHATS_LOGIC_DEEP_DIVE.md**](docs/CHATS_LOGIC_DEEP_DIVE.md) - Unified messaging flow and Atomic Buffers

### 🛠️ Developer & Setup Guides
*   [**API_REFERENCE.md**](docs/API_REFERENCE.md) - Comprehensive list of Sovereign Endpoints
*   [**DEPLOYMENT_GUIDE_EASYPANEL.md**](docs/DEPLOYMENT_GUIDE_EASYPANEL.md) - Step-by-step production setup
*   [**EXTENSION_GUIDE.md**](docs/EXTENSION_GUIDE.md) - How to build new tools and agent templates

### 📋 Product & Requirements
*   [**Product Requirements Document.md**](docs/Product%20Requirements%20Document.md) - Complete PRD with Epics & User Stories
*   [**BACKEND_SPECIFICATION.md**](docs/BACKEND_SPECIFICATION.md) - Technical backend requirements

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow the coding standards** defined in `.agent/` workflows
3. **Write tests** for new features (see `tests/` directory)
4. **Update documentation** if you change functionality
5. **Submit a Pull Request** with a clear description

### Development Workflow
- Use the `@/plan` workflow to propose major changes
- Run `@/verify` before submitting PRs
- Follow the Spec-Driven Development (SDD) methodology

---

## ⚖️ License & Ethics

Platform AI Solutions is built under the **Sovereignty Protocol**. We prioritize data ownership and ethical AI usage above all else.

**Key Principles**:
- **Data Sovereignty**: Each tenant owns 100% of their data and API keys
- **Transparency**: Open documentation, no black boxes
- **Privacy-First**: AES-256 encryption, zero global keys
- **Ethical AI**: Veracidad absoluta (absolute truthfulness) in agent responses

**© 2026 Platform AI Solutions - Sovereign Systems Division**

---

## 📞 Support & Community

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/adriangmrraa/MultiAgents-Platform-ROI/issues)
- **Email**: support@platformaisolutions.com (if applicable)

---

**Built with ❤️ by the Platform AI Solutions Team**

*Nexus v7.6 "Sovereign Platinum" - The Future of E-Commerce Automation*
