# 🧠 Platform AI Solutions (Nexus v3.3) - Protocol Omega

> **Estado del Sistema**: `STABLE` | **Versión**: `v3.3.0-omega` | **Arquitectura**: `Decentralized Microservices`

Este repositorio aloja el ecosistema **Nexus v3**, una plataforma de orquestación de Agentes de IA Multi-Tenant diseñada para operar con **Resiliencia Extrema (Protocolo Omega)** sobre infraestructura Docker/EasyPanel.

---

## 🌟 Visión: "Agentes Soberanos, Infraestructura Auto-Reparable"

A diferencia de los chatbots tradicionales, Nexus v3 es un **Sistema Operativo para Agentes**. No solo responde mensajes, sino que gestiona identidad, memoria a largo plazo, herramientas de comercio electrónico (Tienda Nube) y canales de comunicación (WhatsApp) de forma autónoma, descentralizada y proactiva.

### 🚀 Novedades v3.3 (Current Release)
- **Zero-Config Deployment**: Despliegue automático de tiendas nuevas con escaneo de activos.
- **Glassmorphism UI**: Interfaz administrativa React con modo oscuro y feedback háptico visual.
- **Stateless Agents**: Arquitectura apátrida con inyección de contexto (`ContextVars`) para escalabilidad infinita.
- **Put & Delete**: Gestión completa de Tenants y Credenciales desde la UI.

---

## 🏗️ Arquitectura de Microservicios

| Servicio | Puerto | Tipo | Función | Tecnología |
| :--- | :--- | :--- | :--- | :--- |
| **Orchestrator** | `8000` | 🧠 Cerebro | Router de mensajes, Gestión de Estado, API Administrativa. | Python (FastAPI) |
| **Agent Service** | `8001` | ⚡ Worker | Ejecuta Cadenas de Pensamiento (CoT) y usa Herramientas. | LangChain / OpenAI |
| **WhatsApp Service** | `8002` | 👂 Gateway | Conexión con YCloud/Meta. | Python (FastAPI) |
| **TiendaNube Service** | `8003` | 🛒 Tool | Conector oficial API Tienda Nube (Catálogos, Órdenes). | Python (FastAPI) |
| **BFF Service** | `3000` | 🔌 Proxy | Backend for Frontend (SSE, Estado). | Node.js (Express) |
| **Frontend React** | `80` | 🖥️ UI | Panel de Control Visual (Vite). | React / Nginx |

---

## 🚀 Guía de Inicio Rápido (Despliegue)

El sistema está optimizado para **EasyPanel** (Docker Swarm/Compose).

### 1. Variables de Entorno Críticas
Ver `INFRASTRUCTURE.md` para la lista completa y segura.

```bash
# Seguridad
ADMIN_TOKEN=...              # Token Maestro (Debe coincidir en Frontend y Backend)
INTERNAL_API_TOKEN=...       # Token entre servicios (Orchestrator <-> Agent)
ENCRYPTION_KEY=...           # 32-char string para cifrado DB

# Infraestructura
POSTGRES_DSN=postgresql+asyncpg://...
REDIS_URL=redis://redis:6379

# IA & Integraciones
OPENAI_API_KEY=sk-...
```

### 2. Protocolo Omega (Resiliencia)
El sistema implementa **Auto-Reparación de Esquema**. Al reiniciar el Orquestador:
1.  Verifica la integridad de la BD.
2.  Crea tablas faltantes (`system_events`, `active_agents`).
3.  Migra columnas si hay desviación de esquema (Schema Drift).

---

## 📚 Documentación Viva
Para profundizar en áreas específicas, consulta las guías especializadas:

*   **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)**: Mapa de puertos, seguridad de red y configuración.
*   **[AGENTS.md](./AGENTS.md)**: Guía de desarrollo de nuevas herramientas y lógica de agentes.
*   **[WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md)**: Manual de operaciones para dar de alta tiendas.
*   **[DATABASE_EVOLUTION_GUIDE.md](./DATABASE_EVOLUTION_GUIDE.md)**: Filosofía de "Schema Drift".

---

> **Mantenimiento**: Este proyecto sigue la metodología "GitOps". No realices cambios manuales en el servidor. Haz commit/push y deja que EasyPanel despliegue.

**© 2025 Platform AI Solutions - Nexus Architecture**
