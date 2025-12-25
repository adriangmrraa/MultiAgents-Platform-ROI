# 🛡️ Nexus v3.1 Infrastructure Guide (Protocol Omega)

Este documento define la **Topología de Red** y las **Políticas de Seguridad** finales para el despliegue de Platform AI Solutions.

---

## 1. Topología de Red (Aislamiento Estricto)

El sistema utiliza una arquitectura de **"Submarino Presurizado"**. Solo las escotillas necesarias están abiertas al exterior; el resto de la maquinaria opera en un vacío privado.

### 🌍 Zona Pública (Expuesta a Internet)
Solo estos servicios deben tener un Dominio Público asignado en EasyPanel:

| Servicio | Puerto Público | Dominio (Ejemplo) | Propósito |
| :--- | :--- | :--- | :--- |
| **Platform UI** | `443` (HTTPS) | `app.tusistema.com` | Acceso Administrativo (Dashboard) |
| **Orchestrator** | `443` (HTTPS) | `api.tusistema.com` | Webhooks de WhatsApp y API Frontend |

### 🔒 Zona Privada (Docker Internal Network)
Estos servicios **NO** deben tener dominio público. Se comunican exclusivamente vía la red interna de Docker (`127.0.0.11` DNS).

| Servicio | Puerto Interno | Dirección DNS |
| :--- | :--- | :--- |
| **Agent Service** | `8001` | `http://agent_service:8001` |
| **BFF Service** | `3000` | `http://bff_service:3000` |
| **WhatsApp Service** | `8002` | `http://whatsapp_service:8002` |
| **TiendaNube Service** | `8003` | `http://tiendanube_service:8003` |
| **Redis** | `6379` | `redis://redis:6379` |
| **PostgreSQL** | `5432` | `postgresql://postgres...` |

### 2. Services
*   **Orchestrator (The Brain)**:
    *   **Port**: 8000
    *   **Persistence**: `/app/data` mounted to `./orchestrator_data` (ChromaDB vectors survive restarts).
    *   **Logic**: `main.py` (FastAPI) + `engine.py` (AsyncIO).
    *   **Self-Healing**: `SchemaSurgeon` fixes DB drift on startup.
*   **Frontend (The Face)**:
    *   **Port**: 80 (Internal) / 80 (External)
    *   **Resilience**: Nginx Timeouts extended to **300s** to tolerate Deep Thinking.
    *   **Discovery**: `useApi.ts` implements Triple Redundancy (Local/Internal/EasyPanel).
*   **Agent Service**: Python (FastAPI) en `agent_service` (Port **8001**).
    *   **Rol**: Ejecuta los "Agentes" (LLM-powered workers) que realizan tareas específicas.
*   **Frontend**: React (Vite) en `platform_ui` (Served via Nginx).
*   **Middleware / BFF**: Node.js (Express) en `bff_service` (Port **3000**).
    *   **Rol**: Proxy de Estado y "Plomería de Datos" para SSE.
*   **External Integrations**:
    *   **WhatsApp Service**: Node.js (Baileys) en `whatsapp_service` (Port **8002**).
    *   **Tienda Nube Service**: Node.js en `tiendanube_service` (Port **8003**).

### C. Persistent Storage (Volúmenes)
*   `postgres_data`: Persistencia de base de datos relacional.
*   `whatsapp_sessions`: Persistencia de credenciales de WhatsApp.
*   `orchestrator_data`: **/app/data** (ChromaDB Vectors) - Crucial para RAG, montado en `/app/data/chroma`.

---

## 2. Resiliencia de Red (Nginx Auto-Repair)

El Frontend implementa el estándar **Protocol Omega - Variante A**.

*   **Resolver**: `127.0.0.11` (Docker DNS Embed).
*   **TTL**: 30 segundos.
*   **Proxy Pass Dinámico**: Uso de variables (`set $backend "orchestrator_service"`) para forzar la re-resolución de IPs.
*   **Timeouts**: 300 segundos para permitir cadenas de pensamiento complejas (CoT) de los Agentes sin errores 504.

---

## 3. Gestión de Secretos (Encryption at Rest)

### Llave Maestra (`ENCRYPTION_KEY`)
Todas las credenciales de terceros (Tokens de Tienda Nube, API Keys de OpenAI específicas del cliente) se cifran en la base de datos usando **Fernet (Symmetric Encryption)**.
*   **Regla de Oro**: Si pierdes la `ENCRYPTION_KEY`, pierdes acceso a todas las integraciones de clientes. **Respáldala en un gestor de contraseñas seguro.**

### Token Interno (`INTERNAL_API_TOKEN`)
Es el "Pasaporte Diplomático". Permite que el Orchestrator hable con el Agent Service sin pasar por la validación de usuario habitual. Debe ser idéntico en todos los microservicios.

---

## 4. Mapa de Variables de Entorno (Producción)

### Orchestrator (`:8000`)
```bash
ADMIN_TOKEN=...              # Acceso al Dashboard
ENCRYPTION_KEY=...           # Cifrado DB
INTERNAL_API_TOKEN=...       # Pasaporte Interno
AGENT_SERVICE_URL=http://agent_service:8001
WHATSAPP_SERVICE_URL=http://whatsapp_service:8002
TIENDANUBE_SERVICE_URL=http://tiendanube_service:8003
REDIS_URL=redis://redis:6379
POSTGRES_DSN=...
NEXUS_V3_ENABLED=true
```

### Agent Service (`:8001`)
```bash
OPENAI_API_KEY=...           # Llave Global (Fallback)
INTERNAL_API_TOKEN=...       # Debe coincidir con Orchestrator
```

### Platform UI (`:80`)
```bash
API_BASE_URL=https://api.tusistema.com  # URL Pública del Orchestrator
ADMIN_TOKEN=...                         # Para validación inicial
APP_VERSION=v3.1.0-omega                # Cache Buster
```

---

> **Nota de Seguridad**: Nunca subas archivos `.env` al repositorio. Configura estas variables directamente en el panel de despliegue (EasyPanel/Render).
