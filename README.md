# 🦍 Platform AI Solutions (Nexus v5.1) - Sovereign SaaS

> **Estado del Sistema**: `STABLE` | **Versión**: `v5.1.0-sovereign` | **Arquitectura**: `Hybrid Microservices (Python/React)`

Este repositorio aloja el ecosistema **Nexus v5.1**, la evolución soberana de la orquestación de Agentes de IA Omnicanal. Diseñado bajo el **Protocolo de Identidad Soberana**, garantiza la resiliencia del usuario y el control total de la plataforma.

---

## 🌟 Visión: "Identity First, Business Second"

Nexus v5.1 evoluciona la arquitectura para proteger la identidad del usuario por encima de los activos temporales. Se introduce el concepto de **Sovereign SaaS**, donde el usuario es el dueño de su cuenta independientemente de las tiendas que gestione.

### 🚀 Novedades v5.1 (Sovereign Update)
- **God Mode (Control Tower)**: Una interfaz exclusiva para el Dueño de la Plataforma (`/platform`) que permite monitorear métricas globales e infraestructura sin comprometer la privacidad de los datos.
- **Fail-Safe Identity**: Registro resiliente que permite el acceso inmediato ("Modo Espectador") incluso si fallan los servicios externos de correo.
- **Omnichannel Hub**: Generación y gestión de Webhooks integrada directamente en la UI para integraciones flash con Chatwoot y otros CRMs.
- **Safe Detach Protocol**: Lógica de borrado inteligente que elimina tiendas y activos pero preserva la identidad y el acceso del usuario.
- **Business Forge ("Negrocio")**: El motor de generación de activos (Branding, Ads, ROI) optimizado para la v5.1.

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
