# Infrastructure: Hetzner & EasyPanel (Nexus v3)

This document outlines the recommended security and networking configurations for deploying the **Platform AI Solutions** ecosystem in a production environment using **Hetzner Cloud** and **EasyPanel**.

## 🛡️ Network Isolation

For maximum security, avoid exposing internal services (Postgres, Redis, Agent Service) to the public internet.

### 1. EasyPanel Virtual Network
*   All services in this project should be placed within the same **EasyPanel Project Network**.
*   **Public Access**: Only the `platform_ui` and `orchestrator_service` should have "Public Domains" assigned.
*   **Internal Access**: Use the service names (e.g., `http://agent_service:8001`) for inter-service communication.

### 2. Hetzner Firewall Rules
In the Hetzner Cloud Console, apply a Firewall to your VPS with the following rules:

| Type | Protocol | Port | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| Inbound | TCP | 22 | Your IP / Jump box | SSH Access |
| Inbound | TCP | 80 | 0.0.0.0/0 | HTTP (Redirect to HTTPS) |
| Inbound | TCP | 443 | 0.0.0.0/0 | HTTPS (Traefik/EasyPanel) |
| Inbound | TCP | 3000 | 0.0.0.0/0 | EasyPanel Admin Portal |
| Inbound | UDP | 443 | 0.0.0.0/0 | HTTP/3 (Optional) |
| Outbound | Any | Any | 0.0.0.0/0 | Allow all updates/API calls |

> [!WARNING]
> Ensure ports **5432 (Postgres)** and **6379 (Redis)** are **NOT** open in the Hetzner Firewall. EasyPanel handles their communication internally via Docker networks.

## 🔑 Secret Management

*   **Internal Secret**: Ensure the `INTERNAL_API_TOKEN` matches across all microservices. This is used to authenticate requests between the Orchestrator and the Agent Service.
*   **Encryption**: Database passwords and API keys are stored encrypted at rest using the `INTERNAL_SECRET_KEY`.

## 📈 Monitoring & Health
*   **Health Checks**: EasyPanel should monitor `/health` on all services.
*   **Auto-Restart**: Set a restart policy to `always` or `on-failure`.

## ⚙️ Environment Variables (Reference)

Ensure these are set in the **Environment** tab of each service in EasyPanel.

### 1. Global / Shared
| Variable | Value / Purpose |
| :--- | :--- |
| `INTERNAL_API_TOKEN` | Secure token for inter-service calls. **MUST MATCH ALL.** |
| `REDIS_URL` | `redis://redis:6379/0` (Internal link) |
| `POSTGRES_DSN` | `postgresql+asyncpg://postgres:pass@db:5432/db` |

### 2. Service Specific

#### 📦 orchestrator_service (Port 8000)
- `ADMIN_TOKEN`: Secret for dashboard login.
- `AGENT_SERVICE_URL`: `http://agent_service:8001`
- `WHATSAPP_SERVICE_URL`: `http://whatsapp_service:8002`
- `TIENDANUBE_SERVICE_URL`: `http://tiendanube_service:8003`
- `OPENAI_API_KEY`: Global fallback API key.
- `ENCRYPTION_KEY`: **CRÍTICO**. Se usa para cifrar credenciales de tenants.
- `CORS_ALLOWED_ORIGINS`: `https://your-ui-domain.com`

#### 🧠 agent_service (Port 8001)
- `TIENDANUBE_SERVICE_URL`: `http://tiendanube_service:8003`
- *Nota: Recibe el OpenAI Key dinámicamente desde el Orchestrator.*

#### 💬 whatsapp_service (Port 8002)
- `ORCHESTRATOR_SERVICE_URL`: `http://orchestrator_service:8000`
- `YCLOUD_WEBHOOK_SECRET`: From YCloud portal for security.
- `OPENAI_API_KEY`: **Requerido para Transcripción de Audio (Whisper).**

#### 🛒 tiendanube_service (Port 8003)
- `TIENDANUBE_API_KEY`: Global credentials if applicable.

#### 💻 platform_ui (Port 80)
- `API_BASE`: `https://api.your-domain.com` (Your Orchestrator URL)
- `ADMIN_TOKEN`: Matches the Orchestrator admin token.

---

> [!TIP]
> **Container Ports**: In the "Domains" section of each service in EasyPanel, make sure the **Container Port** matches the ports listed above (e.g., 8000 for orchestrator).
