# Future — AI-Powered Customer Engagement Platform

Multi-tenant SaaS platform for AI-driven customer engagement across WhatsApp, Instagram, Facebook Messenger, and Web.

[![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

## What is Future?

Future is a platform that connects your business to customers across every messaging channel, powered by AI agents that handle sales, support, and engagement automatically.

**Core capabilities:**
- **Omnichannel inbox** — WhatsApp, Instagram, Facebook, Web in one place
- **AI agents** — Customizable agents powered by OpenAI, Google Gemini, or Claude
- **Knowledge base (RAG)** — Upload docs, the AI learns your business
- **Meta Direct Connection** — Connect Instagram/Facebook via popup, receive DMs instantly
- **Creative Studio** — AI-generated product photos, campaigns, brand DNA
- **SaaS billing** — Stripe + MercadoPago, plans, usage tracking
- **Multi-tenant** — Each customer gets isolated data, credentials, agents

## Architecture

```
Frontend (React 18 + Vite + Tailwind)
        |
   BFF Service (Express.js)
        |
Orchestrator Service (FastAPI) ← Central Hub
   /        |        \          \
Agent    WhatsApp    Meta     TiendaNube
Service  Service   Service    Service
   \        |        /
   PostgreSQL + Redis
```

| Service | Tech | Purpose |
|---------|------|---------|
| orchestrator_service | FastAPI | Auth, agents, chats, billing, RAG, platform admin |
| agent_service | FastAPI + LangChain | AI agent execution |
| whatsapp_service | FastAPI | Universal message delivery relay |
| meta_service | FastAPI | Meta OAuth, webhooks, Graph API |
| tiendanube_service | FastAPI | E-commerce catalog sync |
| bff_service | Express.js | Frontend API proxy |
| frontend_react | React 18 | SPA dashboard |

## Quick Start

```bash
# Clone and start
git clone <repo-url>
docker-compose up -d --build

# Access
# Frontend: http://localhost
# API docs: http://localhost:8000/docs
```

## Documentation

Full documentation lives in [`docs/`](./docs/README.md):

- [Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Meta Connection](./docs/META_CONNECTION.md)
- [Omnichannel Chats](./docs/OMNICHANNEL_CHATS.md)
- [Agents & RAG](./docs/AGENTS_AND_RAG.md)
- [Billing & SaaS](./docs/BILLING.md)
- [Creative Studio](./docs/CREATIVE_STUDIO.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, LangChain, asyncpg, httpx
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Database:** PostgreSQL 13 + pgvector, Redis
- **AI:** OpenAI (GPT-5), Google Gemini 3, Anthropic Claude
- **Payments:** Stripe, MercadoPago
- **Deployment:** Docker Compose, EasyPanel
