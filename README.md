# 🧠 Platform AI Solutions (Nexus v3.1) - Protocol Omega

> **Estado del Sistema**: `STABLE` | **Versión**: `v3.1.0-omega` | **Arquitectura**: `Decentralized Microservices`

Este repositorio aloja el ecosistema **Nexus v3**, una plataforma de orquestación de Agentes de IA Multi-Tenant diseñada para operar con **Resiliencia Extrema (Protocolo Omega)** sobre infraestructura Docker/EasyPanel.

---

## 🌟 Visión: "Agentes Soberanos, Infraestructura Auto-Reparable"

A diferencia de los chatbots tradicionales, Nexus v3 es un **Sistema Operativo para Agentes**. No solo responde mensajes, sino que gestiona identidad, memoria a largo plazo, herramientas de comercio electrónico (Tienda Nube) y canales de comunicación (WhatsApp) de forma autónoma y descentralizada.

### Pilares del Protocolo Omega
1.  **Single Source of Truth (SSOT)**: La Base de Datos (Postgres) es la autoridad final. Todo ID es UUID. Todo esquema se auto-repara al inicio.
2.  **Resiliencia de Red (Variante A)**: Nginx utiliza resolución DNS dinámica (`127.0.0.11`) para sobrevivir a reinicios de contenedores sin intervención humana.
3.  **Aislamiento Estricto**: Solo el Orquestador y la UI son públicos. Los servicios de IA (Agent, WhatsApp) operan en una red privada blindada.
4.  **Rendimiento en Capas**: Cache Agregada (Redis) para lecturas rápidas, con Fallback a DB para garantizar disponibilidad.

---

## 🏗️ Arquitectura de Microservicios

| Servicio | Puerto | Función | Tecnología |
| :--- | :--- | :--- | :--- |
| **Orchestrator** | `8000` | Cerebro Central. Router de mensajes, Gestión de Estado, API Administrativa. | Python (FastAPI) |
| **Agent Service** | `8001` | Corteza Prefrontal. Ejecuta Cadenas de Pensamiento (CoT) y usa Herramientas. | LangChain / OpenAI |
| **WhatsApp Service** | `8002` | Oído y Voz. Gateway para YCloud/Meta. Transcribe audios (Whisper). | Python (FastAPI) |
| **TiendaNube Service** | `8003` | Brazos Ejecutores. Conector oficial API Tienda Nube (Catálogos, Órdenes). | Python (FastAPI) |
| **Platform UI** | `80` | Panel de Control Visual. Dashboard React adminstrativo. | React / Nginx |

---

## 🚀 Guía de Inicio Rápido (Despliegue)

El sistema está optimizado para **EasyPanel** (Docker Swarm/Compose).

### 1. Requisitos
*   Servidor VPS (Hetzner/DigitalOcean) con Docker.
*   EasyPanel instalado.
*   Claves API: OpenAI, YCloud, Tienda Nube.

### 2. Variables de Entorno Críticas
Estas variables definen la "Identidad" del despliegue. Ver `INFRASTRUCTURE.md` para la lista completa.

```bash
# Seguridad
INTERNAL_API_TOKEN=super-secret-token-shared-between-services
ENCRYPTION_KEY=32-char-random-string-for-db-encryption

# Conectividad
POSTGRES_DSN=postgresql+asyncpg://...
REDIS_URL=redis://redis:6379

# Servicios IA
OPENAI_API_KEY=sk-...
```

### 3. Comandos de Mantenimiento (Admin Gateway)
Desde el Dashboard (`/admin`), puedes ejecutar acciones de sistema protegidas:
*   **Clear Cache**: `POST /admin/system/actions` `{ "action": "clear_cache" }`
*   **Trigger Handoff**: `POST /admin/system/actions` `{ "action": "trigger_handoff", "payload": { "conversation_id": "..." } }`

---

## 📚 Documentación Viva
Para profundizar en áreas específicas, consulta las guías especializadas:

*   **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)**: Mapa de puertos, seguridad de red y configuración de EasyPanel.
*   **[WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md)**: Manual de operaciones para dar de alta tiendas y gestionar agentes.
*   **[DATABASE_EVOLUTION_GUIDE.md](./DATABASE_EVOLUTION_GUIDE.md)**: Filosofía de "Schema Drift" y los 4 Pasos Sagrados de migración.
*   **[STABILITY_REPORT.md](./STABILITY_REPORT_NEXUS_V3.md)**: Auditoría forense y estado de salud actual.

---

> **Mantenimiento**: Este proyecto sigue la metodología "GitOps". No realices cambios manuales en el servidor. Haz commit/push y deja que EasyPanel despliegue.

**© 2025 Platform AI Solutions - Nexus Architecture**
