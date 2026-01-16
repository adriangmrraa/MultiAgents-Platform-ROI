# NEXUS ARCHITECTURAL BLUEPRINT (v5.1 Sovereign)

## 🌌 Introduction
Nexus is a multi-tenant AI Orchestration platform built on the principle of **Total Sovereignty**. Unlike traditional SaaS where the provider controls all API keys and infrastructure, Nexus empowers the Tenant (Owner) to provide their own "fuel" (API keys, SMTP, etc.), ensuring privacy, cost transparency, and independent rate limits.

---

## 🏗️ Core Technology Stack
- **Frontend**: React (Vite) + Tailwind CSS + Lucide Icons.
- **Backend API**: FastAPI (Python 3.10+).
- **Database**: PostgreSQL (Relational data + Credential Vault).
- **Cache/PubSub**: Redis (Session management and real-time triggers).
- **AI Framework**: LangChain / Custom Agentic logic.
- **Security**: AES-256 (Fernet) encryption for sensitive data.

---

## 🗝️ The Sovereign Credentials System
This is the heart of the v5.1 upgrade. The system has moved away from `.env`-based global keys to a dynamic, tenant-specific lookup.

### Data Flow for AI Execution:
1. **Request**: A user interacts with an AI agent (e.g., Creative Director).
2. **Lookup**: The service calls `get_tenant_credential(tenant_id, category, key_name)`.
3. **Vault Access**: The system queries the `credentials` table, filtering by `tenant_id`.
4. **Decryption**: The `Fernet` key (system-level) decrypts the value on-the-fly.
5. **Injection**: The decrypted key is injected into the AI model instantiation (OpenAI, Google Gemini, etc.).

### Categories Protected:
- `openai`: GPT-o1, GPT-4o, etc.
- `google`: Gemini 2.x, Imagen 3 (Via Google AI Studio).
- `smtp`: Custom brand-specific email delivery.
- `tiendanube`: E-commerce access tokens.

---

## 🧠 AI & Agentic Logic
Nexus uses a specialized agentic workflow divided into "Departments":

### 1. RAG Core (The Librarian)
- **Engine**: ChromaDB / Vector Search logic.
- **Sovereignty**: Uses the Tenant's OpenAI key for embeddings and retrieval, ensuring search costs are allocated to the correct account.

- **Tooling**: Found in `orchestrator_service/app/core/image_utils.py`.

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
