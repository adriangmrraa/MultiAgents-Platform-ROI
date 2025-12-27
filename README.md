# 🧠 Platform AI Solutions (Nexus v4.0) - Protocol Omega

> **Estado del Sistema**: `STABLE` | **Versión**: `v4.0.0-omega` | **Arquitectura**: `Hybrid Microservices (Python/Node/React)`

Este repositorio aloja el ecosistema **Nexus v4.0**, una plataforma de orquestación de Agentes de IA Multi-Tenant diseñada para operar con **Resiliencia Extrema (Protocolo Omega)** sobre infraestructura Docker/EasyPanel.

---

## 🌟 Visión: "Simplicidad Radical, Inteligencia Invisible"

A diferencia de las versiones anteriores, Nexus v4.0 abraza el **Minimalismo Interactivo**. El sistema opera con una interfaz "HUD" dinámica, ocultando la complejidad técnica para centrarse en el flujo de pensamiento de los agentes y el retorno de inversión (ROI) en tiempo real.

### 🚀 Novedades v4.0 (Current Release)
- **Nexus Minimalist Sidebar**: Navegación por hover "sensible" y tooltips dinámicos de alto detalle.
- **Mobile HUD v2**: Interfaz adaptativa con auto-ocultamiento para control desde dispositivos móviles.
- **Neural Stream Logs**: Visualización de pensamientos de IA vía SSE a través del BFF Service.
- **Build-Time Injection**: Protocolo de seguridad reforzado mediante Docker Build Arguments.
- **Protocolo de Auto-Reparación**: Auditoría automática de esquemas de base de datos y estados de salud.

---

## 🏗️ Arquitectura de Microservicios

| Servicio | Puerto | Tipo | Función | Tecnología |
| :--- | :--- | :--- | :--- | :--- |
| **Orchestrator** | `8000` | 🧠 Cerebro | Core de lógica, Gestión de Tenants, API Maestra. | Python (FastAPI) |
| **BFF Service** | `3000` | 🔌 Sistema Nervioso | Backend for Frontend. Streaming SSE y Proxy inteligente. | Node.js (Express) |
| **Agent Service** | `8001` | ⚡ Músculos | Motor de ejecución de Agentes y Herramientas. | LangChain / OpenAI |
| **Frontend React** | `80` | 🖥️ Ojos | Panel HUD Minimalista (Vite + Protocolo Omega CSS). | React / Nginx |
| **WhatsApp Service** | `8002` | 📞 Vínculo | Integración nativa con Meta / YCloud. | Python (FastAPI) |
| **TiendaNube Service** | `8003` | 🛒 Brazo Mercantil | Conector de e-commerce sincronizado. | Python (FastAPI) |

---

## 🚀 Guía de Inicio Rápido

El sistema está optimizado para **EasyPanel**.

### 1. Variables de Seguridad (Doble Factor)
Para que el sistema funcione, el `ADMIN_TOKEN` debe coincidir en ambos lados del puente:
1.  **Orchestrator**: Variable de entorno `ADMIN_TOKEN`.
2.  **Frontend React**: Argumento de construcción (**Build Argument**) `VITE_ADMIN_TOKEN`.

### 2. URL de API
El Frontend debe apuntar a la URL pública del Orquestador mediante el Build Argument `VITE_API_BASE_URL`.

---

## 📚 Documentación Viva
*   **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)**: Topología de red y seguridad de nivel militar.
*   **[Manual de Vuelo v4.0](./Manual%20de%20Vuelo%20Nexus%20v4.0.md)**: Operación diaria y onboarding.
*   **[AGENTS.md](./AGENTS.md)**: Cómo programar la mente de tus agentes.
*   **[FRONTEND_DYNAMIC_CONFIG.md](./FRONTEND_DYNAMIC_CONFIG.md)**: Detalles sobre el motor de inyección Vite.

---

> **Mantenimiento**: Este proyecto sigue la metodología "GitOps". No realices cambios manuales. Todo se despliega vía Push a `master`.

**© 2025 Platform AI Solutions - Nexus Architecture**
