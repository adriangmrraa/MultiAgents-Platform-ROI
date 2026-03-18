# NEXUS ARCHITECTURAL BLUEPRINT (v6.0 Sovereign)

## 🌌 Introduction
Nexus is a multi-tenant AI Orchestration platform built on the principle of **Total Sovereignty**. Unlike traditional SaaS where the provider controls all API keys and infrastructure, Nexus empowers the Tenant (Owner) to provide their own "fuel" (API keys, SMTP, etc.), ensuring privacy, cost transparency, and independent rate limits.

---

## 🏗️ Core Technology Stack
- **Frontend**: React (Vite) + Tailwind CSS + Lucide Icons.
- **Backend API**: FastAPI (Python 3.10+).
- **Database**: PostgreSQL (Relational) + **Supabase pgvector** (RAG memory).
- **Cache/PubSub**: Redis (Session management and real-time triggers).
- **AI Framework**: LangChain / **Polymorphic Agent Service** (Custom Factory).
- **Security**: AES-256 (Fernet) encryption for sensitive data.

---

## 🗝️ The Sovereign Credentials System
This is the heart of the v6.0 upgrade. The system has moved away from `.env`-based global keys to a dynamic, tenant-specific lookup.

### Data Flow for AI Execution:
1. **Request**: A user interacts with an AI agent (e.g., Sales Agent).
2. **Lookup**: The service calls `get_tenant_credential(tenant_id, category, key_name)`.
3. **Vault Access**: The system queries the `credentials` table, filtering by `tenant_id`.
4. **Decryption**: The `Fernet` key (system-level) decrypts the value on-the-fly.
5. **Injection**: The decrypted key is injected into the AI model instantiation (OpenAI, Google Gemini, etc.).

### Categories Protected:
- `openai`: GPT-5.2, gpt-5-mini, etc.
- `google`: Gemini 3 Pro, Gemini 3 Flash (Via Google AI Studio).
- `smtp`: Custom brand-specific email delivery.
- `tiendanube`: E-commerce access tokens.

---

## 🧠 AI & Agentic Logic (Nexus v6.0 Polymorphism)
Nexus has evolved from a single-agent system to a **Polymorphic Agent Service**.

### 1. The Agent Template Factory
Instead of hardcoded "prompts", the system uses a Factory Pattern to instantiate agents:
- **Sales Agent**: Aggressive closing, full catalogue access.
- **Support Agent**: Empathetic, limited tools (no browsing), focuses on `knowledge_base`.
- **Leads Agent**: Data collection focus (Qualify -> Handoff).
- **Logistics Agent**: Tracking-only, low temperature (concise).

### 2. RAG Core (Supabase pgvector)
- **Engine**: Supabase `vector` extension.
- **Sovereignty**: Tenant isolation via `metadata->>'tenant_id'` filters in all vector queries.
- **Bootstrapper**: Critical services auto-initialize the database schema on startup if missing.

### 3. The Meta Diplomat (Microservice)
- **Role**: Handles the complex OAuth dance with Facebook/Instagram/WhatsApp.
- **Sovereignty**:
    - **Long-Lived Tokens**: Automatically exchanges user tokens for 60-day System User tokens.
    - **Asset Discovery**: Fetches and filters Pages/IG Accounts strictly based on Admin permissions.
- **Protocol**: Communicates with Orchestrator via internal HTTP (`http://meta_service:8000`) secured by `INTERNAL_SECRET_KEY`.

### 4. Nexus Engine (Orchestrator)
- **Role**: Coordinates intent classification, tool selection (search products, check stock, send emails), and final response synthesis.

---

## 📧 Hybrid SMTP Protocol (Omega)
To solve delivery issues and maintain brand integrity, Nexus uses a dual-path logic:
- **System Path**: Used for account verification and critical alerts (Nexus Brand). Strictly uses platform-wide reliable SMTP (e.g., Brevo).
- **Agent Path**: Used for customer interactions (e.g., sending coupons). Uses the Tenant's custom SMTP to keep the store's email identity.

---

## 🗄️ Multi-Tenant Database Schema
- **`tenants`**: The logical root. Stores store names, status, and metadata.
- **`users`**: Linked to a `tenant_id`. Roles range from `owner` to `agent` (Spectator Mode supported).
- **`credentials`**: The encrypted vault. Uses composite unique indices `(name, tenant_id)` to allow key isolation.
- **`business_assets`**: Stores the output of AI agents (generated ads, product summaries) as JSONB for high flexibility.

---

## 🛡️ Security Zero Trust
- **Admin Authentication**: All administrative routes are protected by a global `X-Admin-Token`.
- **Credential Masking**: The UI never exposes raw keys; they are masked (`Nexus_Key_*****`) and only decrypted by the backend during execution.
- **i18n**: Full support for English and Spanish via `LanguageContext`.

---

**© 2026 Platform AI Solutions - Technical Architecture Division**
