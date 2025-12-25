# 🛡️ Nexus v3.3 Infrastructure Guide (Protocol Omega)

Este documento define la **Topología de Red** y las **Políticas de Seguridad** finales para el despliegue de Platform AI Solutions.

---

## 1. Topología de Red (Aislamiento Estricto)

El sistema utiliza una arquitectura de **"Submarino Presurizado"**. Solo las escotillas necesarias están abiertas al exterior; el resto de la maquinaria opera en un vacío privado.

### 🌍 Zona Pública (Expuesta a Internet)
Solo estos servicios deben tener un Dominio Público asignado en EasyPanel:

| Servicio | Puerto Público | Dominio (Ejemplo) | Propósito |
| :--- | :--- | :--- | :--- |
| **Frontend React** | `443` (HTTPS) | `app.tusistema.com` | Acceso Administrativo (Dashboard) |
| **Orchestrator** | `443` (HTTPS) | `api.tusistema.com` | Webhooks de WhatsApp y API Backend |

### 🔒 Zona Privada (Docker Internal Network)
Estos servicios **NO** deben tener dominio público. Se comunican exclusivamente vía la red interna de Docker (`127.0.0.11` DNS).

| Servicio | Puerto Interno | Dirección DNS |
| :--- | :--- | :--- |
| **Agent Service** | `8001` | `http://agent_service:8001` |
| **WhatsApp Service** | `8002` | `http://whatsapp_service:8002` |
| **TiendaNube Service** | `8003` | `http://tiendanube_service:8003` |
| **BFF Service** | `3000` | `http://bff_service:3000` |
| **Redis** | `6379` | `redis://redis:6379` |
| **PostgreSQL** | `5432` | `postgresql://postgres...` |

---

## 2. Gestión de Secretos (Encryption at Rest)

### Llave Maestra (`ENCRYPTION_KEY`)
Todas las credenciales de terceros (Tokens de Tienda Nube, API Keys de OpenAI específicas del cliente) se cifran en la base de datos usando **Fernet (Symmetric Encryption)**.

### Token Interno (`INTERNAL_API_TOKEN`)
Es el "Pasaporte Diplomático". Permite que el Orchestrator hable con el Agent Service sin pasar por la validación de usuario habitual. **Debe ser idéntico en todos los microservicios.**

### Token Admin (`ADMIN_TOKEN`)
Protege el Dashboard y los endpoints administrativos.
**CRÍTICO**: Debe ser IGUAL en el entorno del **Orchestrator** (`ADMIN_TOKEN`) y del **Frontend** (`VITE_ADMIN_TOKEN`).

---

## 3. Mapa de Variables de Entorno (Producción)

### Orchestrator (`:8000`)
```bash
ADMIN_TOKEN=...              # Acceso al Dashboard (Match con VITE_ADMIN_TOKEN)
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

### Frontend React (`:80`)
```bash
VITE_API_BASE_URL=https://api.tusistema.com  # URL Pública del Orchestrator
VITE_ADMIN_TOKEN=...                         # Match con Orchestrator ADMIN_TOKEN
```

---

> **Nota de Seguridad**: Nunca subas archivos `.env` al repositorio. Configura estas variables directamente en el panel de despliegue (EasyPanel/Render).
