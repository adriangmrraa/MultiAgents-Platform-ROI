# 🦍 Platform AI Solutions (Nexus v5) - Protocol Omega

> **Estado del Sistema**: `STABLE` | **Versión**: `v5.0.0-omega` | **Arquitectura**: `Hybrid Microservices (Python/React)`

Este repositorio aloja el ecosistema **Nexus v5**, el pináculo de la orquestación de Agentes de IA Omnicanal. Diseñado bajo el **Protocolo Omega**, introduce la autonomía total en la generación de activos visuales y estratégicos.

---

## 🌟 Visión: "The Industrial AI Revolution"

Nexus v5 evoluciona más allá de la gestión de conversaciones para convertirse en una **Fábrica de Negocios Autónoma**. El sistema no solo responde, sino que *crea* campañas, estrategias y activos visuales de alto impacto en tiempo real.

### 🚀 Novedades v5.0 (Protocol Omega)
- **Business Forge ("Negrocio")**: Un centro de comando unificado (`/forge`) donde se materializa la estrategia del negocio.
- **Ad Image Fusion**: Motor de generación visual `GPT-4o Vision` + `DALL-E 3` que crea anuncios publicitarios reales a partir de productos del catálogo.
- **Magic Onboarding**: Flujo de inicialización autónomo que genera Identidad, Guiones, Anuncios y Proyecciones ROI en < 60 segundos.
- **Protocol Omega Streaming**: Arquitectura de transmisión en tiempo real (`Redis Pub/Sub` + `SSE`) con aislamiento de tenants y efectos visuales "Magic Reveal".
- **Smart Catalog**: Explorador de productos con capacidad de generación de contenido on-demand.

---

## 🏗️ Arquitectura de Microservicios

| Servicio | Puerto | Tipo | Función | Tecnología |
| :--- | :--- | :--- | :--- | :--- |
| **Orchestrator** | `8000` | 🧠 Cerebro | Core de lógica, Gestión de Tenants, API Maestra y Auto-Reparación. | Python (FastAPI) |
| **Agent Service** | `8001` | ⚡ Músculos | Motor de ejecución de Agentes y Herramientas (LangChain). | LangChain / OpenAI |
| **Frontend React** | `80` | 🖥️ Ojos | Panel HUD Minimalista con Business Forge integrado. | React / Vite |

---

## 🚀 Guía de Inicio Rápido

El sistema está optimizado para **EasyPanel**.

### 1. Variables de Seguridad
La comunicación administrativa se asegura mediante el `ADMIN_TOKEN`, que debe configurarse en el Orquestador (`ENV`) y en el Frontend (`Build Argument`).

### 2. Despliegue GitOps
Simplemente haz `git push origin master`. El sistema detectará los cambios, reconstruirá los contenedores y migrará la base de datos automáticamente.

---

## 📚 Documentación Viva
*   **[BACKEND_SPECIFICATION.md](./BACKEND_SPECIFICATION.md)**: El contrato absoluto de integración (Protocol Omega).
*   **[Manual de Vuelo v5.0](./Manual%20de%20Vuelo%20Nexus%20v5.md)**: Guía operativa diaria y Business Forge.
*   **[DATABASE_EVOLUTION_GUIDE.md](./DATABASE_EVOLUTION_GUIDE.md)**: Cómo evoluciona el esquema SSOT.
*   **[MAINTENANCE_AGENT.md](./MAINTENANCE_AGENT.md)**: Prompt para ingenieros de soporte IA.

---

**© 2025 Platform AI Solutions - Nexus Architecture**
