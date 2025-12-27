# 🧠 Platform AI Solutions (Nexus v4.6) - Protocol Omega

> **Estado del Sistema**: `STABLE` | **Versión**: `v4.6.2-omega` | **Arquitectura**: `Hybrid Microservices (Python/React)`

Este repositorio aloja el ecosistema **Nexus v4.6**, una plataforma de orquestación de Agentes de IA Omnicanal diseñada para operar con **Resiliencia Extrema y Control Táctico** sobre infraestructura Docker/EasyPanel.

---

## 🌟 Visión: "Simplicidad Radical, Inteligencia Invisible"

Nexus v4.4 abraza el **Minimalismo Interactivo** y la **Omnicanalidad Total**. El sistema gestiona conversaciones de múltiples canales (WhatsApp, Instagram, Facebook) de forma unificada, vinculando cada interacción a un ecosistema centralizado de IA.

### 🚀 Novedades v4.6 (Intelligence & Guidance)
- **Protocolo de Extracción (Response Guide)**: Control absoluto sobre cómo el agente extrae y presenta datos de las herramientas.
- **Táctica de Herramientas (Tactical Injection)**: Instrucciones específicas por herramienta para optimizar cuándo y cómo usarlas.
- **Herramientas Dinámicas**: Sincronización automática entre la Armería (Admin) y la configuración de los Agentes.
- **AI-Powered Refinement**: Integración de GPT-4o para mejorar prompts de sistema y descripciones de catálogos con un clic.
- **Guía UI Contextual**: Banners de protocolo y manuales de operaciones integrados en el dashboard administrativo.
- **Optimización de Identidad**: Ajuste de identificadores seriales para Agentes para una gestión de secuencias libre de fricción.

---

## 🏗️ Arquitectura de Microservicios

| Servicio | Puerto | Tipo | Función | Tecnología |
| :--- | :--- | :--- | :--- | :--- |
| **Orchestrator** | `8000` | 🧠 Cerebro | Core de lógica, Gestión de Tenants, API Maestra y Auto-Reparación. | Python (FastAPI) |
| **Agent Service** | `8001` | ⚡ Músculos | Motor de ejecución de Agentes y Herramientas. | LangChain / OpenAI |
| **Frontend React** | `80` | 🖥️ Ojos | Panel HUD Minimalista Omnicanal. | React / Vite |

---

## 🚀 Guía de Inicio Rápido

El sistema está optimizado para **EasyPanel**.

### 1. Variables de Seguridad
La comunicación administrativa se asegura mediante el `ADMIN_TOKEN`, que debe configurarse en el Orquestador (`ENV`) y en el Frontend (`Build Argument`).

### 2. Despliegue GitOps
Simplemente haz `git push origin master`. El sistema detectará los cambios, reconstruirá los contenedores y migrará la base de datos automáticamente.

---

## 📚 Documentación Viva
*   **[BACKEND_SPECIFICATION.md](./BACKEND_SPECIFICATION.md)**: El contrato absoluto de integración.
*   **[Manual de Vuelo v4.4](./Manual%20de%20Vuelo%20Nexus%20v4.0.md)**: Guía operativa diaria.
*   **[DATABASE_EVOLUTION_GUIDE.md](./DATABASE_EVOLUTION_GUIDE.md)**: Cómo evoluciona el esquema SSOT.
*   **[MAINTENANCE_AGENT.md](./MAINTENANCE_AGENT.md)**: Prompt para ingenieros de soporte IA.

---

**© 2025 Platform AI Solutions - Nexus Architecture**
