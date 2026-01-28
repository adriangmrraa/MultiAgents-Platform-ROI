# 🛸 Nexus v7.6: Sovereign Platinum SaaS

> **The Ultimate AI-Driven OS for E-Commerce Excellence.**
> *Omnichannel Orchestration, Sovereign Data Privacy, and Real-Time ROI Quantification.*

---

## 🛠️ Stack Tecnológico & Arquitectura

Nexus v7.6 utiliza una **Arquitectura de Microservicios Soberana**, diseñada para escalar horizontalmente manteniendo la privacidad estricta de cada inquilino.

### 🎨 Frontend (Interfaz Soberana)
-   **Framework**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) (Build ultra-rápido).
-   **Estilos**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/) (Iconografía).
-   **Estado**: React Router DOM + Fetch API (Sin Redux, estado atómico).
-   **Despliegue**: Docker Nginx (SPA Mode).

### ⚙️ Backend (El Núcleo)
-   **Orquestador**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) - Cerebro central asíncrono.
-   **Microservicios**:
    -   `agent_service`: Fábrica de Agentes Polimórficos (LangChain).
    -   `whatsapp_service`: Gateway de Entrega Universal (Meta/YCloud/Chatwoot).
    -   `meta_service`: Diplomático OAuth para Facebook/Instagram.
    -   `tiendanube_service`: Broker de sincronización E-commerce.
    -   `bff_service`: Backend-for-Frontend (Node.js/Express) para optimización.

### 🗄️ Infraestructura y Persistencia
-   **Base de Datos**: [PostgreSQL 13](https://www.postgresql.org/) (Relacional).
-   **Memoria Vectorial**: Extension `pgvector` para RAG (Búsqueda Semántica).
-   **Cache & Eventos**: [Redis 7](https://redis.io/) (Buffers Atómicos y PubSub en tiempo real).
-   **Contenedores**: Docker & Docker Compose (Estándar de industria).

### 🤖 Capa de Inteligencia Artificial
-   **Orquestación LLM**: [LangChain](https://www.langchain.com/) + Factory propia.
-   **Modelos Soportados**: GPT-4o, GPT-3.5-Turbo, Gemini 1.5 Pro.
-   **RAG Engine**: "Shadow RAG" (Aprendizaje Pasivo) + Colecciones por Tenant.

---

## 🚀 Guía de Despliegue (Quick Start)

Nexus está diseñado bajo la filosofía "Clone & Run". No necesitas instalar Python o Node.js localmente si usas Docker.

### Pre-requisitos
-   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) o Docker Engine (Linux).
-   [Git](https://git-scm.com/).

### Despliegue Estándar (Recomendado)

1.  **Clonar el Repositorio**:
    ```bash
    git clone https://github.com/adriangmrraa/MultiAgents-Platform-ROI.git
    cd MultiAgents-Platform-ROI
    ```

2.  **Configuración de Entorno**:
    Nexus usa una "Bóveda Soberana", así que solo necesitas las credenciales maestras de arranque.
    ```bash
    cp .env.example .env
    # Edita .env con tus Keys Maestras (OPENAI_API_KEY, etc.) si es necesario
    ```

3.  **Encender Motores**:
    ```bash
    docker-compose up -d --build
    ```
    *Esto levantará Postgres, Redis, el Frontend y los 5 microservicios automáticamente.*

4.  **Acceder a la Plataforma**:
    -   **Frontend**: `http://localhost:80` (o simplemente `http://localhost`)
    -   **Documentación API**: `http://localhost:8000/docs`

### 🔧 Modo Desarrollo (Híbrido)

Si deseas editar el Frontend sin reconstruir contenedores:

```bash
cd frontend_react
npm install
npm run dev
# Acceso en http://localhost:5173
```

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

## 🏗️ Architectural Foundations

### 🧠 Sovereign Agentic Engine
Powered by **SOTA Models (GPT-4o, Claude 3.5, Gemini 1.5 Pro)**, our agents don't just reply; they use tools. From searching TiendaNube catalogs to analyzing PDF manuals (RAG) and checking orders, Nexus agents act as specialized employees.

### ⚡ Atomic Buffering & Reliability
Built with a **Universal Delivery Relay**, Nexus handles message bursts with surgical precision. Our **Atomic Buffer** ensures that interruptions or multiple messages are consolidated into coherent, context-aware responses, avoiding "message spam" from the IA.

### 🧬 Dynamic Knowledge (RAG)
Isolation is paramount. Each tenant has their own vector space. Knowledge is ingested securely, allowing the AI to answer with 100% accuracy based on specific store policies, materials, and internal guides.

---

## 🚀 Quick Start (Deployment)

Nexus is designed to run in **Dockerized environments** like EasyPanel or Render.

1.  **Clone & Configure**: Copy `.env.example` (Only for master credentials).
2.  **Spin Up**: `docker-compose up -d`.
3.  **Magic Onboarding**: Log in to the Dashboard and use the **"Hacer Magia"** wizard to generate your first agent and sync your store in seconds.

---

## 📚 Documentation Hub

Explore the deep logic behind the Sovereign Platinum engine:

### 🚀 Getting Started & Status
*   [**PROJECT_STATUS.md**](docs/PROJECT_STATUS.md) - **(Read First)** Current milestone progress and active roadmap.
*   [**STABILITY_REPORT.md**](docs/STABILITY_REPORT.md) - Official certification of v7.6 platinum standards.
*   [**TROUBLESHOOTING.md**](docs/TROUBLESHOOTING.md) - Known edge cases and surgical fixes.

### 🛡️ Architecture Deep Dives
*   [**NEXUS_ARCHITECTURAL_BLUEPRINT.md**](docs/NEXUS_ARCHITECTURAL_BLUEPRINT.md) - The 5 Pillars of our Sovereign design.
*   [**INTEGRATIONS_LOGIC_DEEP_DIVE.md**](docs/INTEGRATIONS_LOGIC_DEEP_DIVE.md) - Assist Score, Meta OAuth, and Multi-Tenant Routing.
*   [**AGENTS_LOGIC_DEEP_DIVE.md**](docs/AGENTS_LOGIC_DEEP_DIVE.md) - Neural logic, tool usage, and auditing ticks.
*   [**CHATS_LOGIC_DEEP_DIVE.md**](docs/CHATS_LOGIC_DEEP_DIVE.md) - Unified messaging flow and Atomic Buffers.

### 🛠️ Developer & Setup Guides
*   [**API_REFERENCE.md**](docs/API_REFERENCE.md) - Comprehensive list of Sovereign Endpoints.
*   [**DEPLOYMENT_GUIDE_EASYPANEL.md**](docs/DEPLOYMENT_GUIDE_EASYPANEL.md) - Step-by-step production setup.
*   [**EXTENSION_GUIDE.md**](docs/EXTENSION_GUIDE.md) - How to build new tools and agent templates.

---

## ⚖️ License & Ethics
Platform AI Solutions is built under the **Sovereignty Protocol**. We prioritize data ownership and ethical AI usage above all else.

**© 2026 Platform AI Solutions - Sovereign Systems Division**
