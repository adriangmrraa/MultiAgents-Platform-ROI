# Future Platform — Documentation Hub

**Future** is a multi-tenant SaaS platform for AI-powered customer engagement across WhatsApp, Instagram, Facebook Messenger, and Web.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System architecture, services, and data flow |
| [API Reference](./API_REFERENCE.md) | All REST endpoints by service |
| [Meta Connection](./META_CONNECTION.md) | Instagram, Facebook & WhatsApp via Meta Embedded Signup |
| [Omnichannel Chats](./OMNICHANNEL_CHATS.md) | Multi-provider chat system (Meta Direct, Chatwoot, YCloud) |
| [Agents & RAG](./AGENTS_AND_RAG.md) | AI agent factory, knowledge base, and RAG pipeline |
| [Billing & SaaS](./BILLING.md) | Plans, subscriptions, Stripe & MercadoPago |
| [Creative Studio](./CREATIVE_STUDIO.md) | Brand DNA, Photoshoot, Campaigns (Business Forge) |
| [Deployment](./DEPLOYMENT.md) | EasyPanel, Docker Compose, environment variables |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and solutions |
| [Launch Checklist](./LAUNCH_CHECKLIST.md) | Step-by-step guide to go live (Stripe, MP, Meta, security) |

## Quick Links

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** FastAPI (Python) microservices
- **Database:** PostgreSQL + pgvector + Redis
- **AI:** OpenAI, Google Gemini, Anthropic Claude
- **Deployment:** EasyPanel (Docker-based)

## Architecture at a Glance

```
                    Frontend (React SPA)
                          |
                     BFF Service (Express)
                          |
                  Orchestrator Service (FastAPI)
                 /        |        \          \
          Agent      WhatsApp      Meta      TiendaNube
         Service     Service     Service     Service
                 \        |        /
                  PostgreSQL + Redis
```

## Specs

Active specifications live in [`specs/`](../specs/) for features in development.
Legacy documentation is preserved in [`docs/archive/`](./archive/) for reference.
