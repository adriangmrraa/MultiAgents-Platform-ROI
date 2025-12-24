# Infrastructure: Hetzner & EasyPanel (Nexus v3)

This document outlines the recommended security and networking configurations for deploying the Agente JS ecosystem in a production environment using **Hetzner Cloud** and **EasyPanel**.

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
*   **Auto-Restart**: Set a restart policy to `always` or `on-failure` for critical workers like the WhatsApp service.
