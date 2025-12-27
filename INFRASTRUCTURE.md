# 🛡️ Nexus v4.0 Infrastructure Guide (Protocol Omega)

Este documento define la **Topología de Red** (Submarino Presurizado) y las **Políticas de Seguridad** para el despliegue de Nexus v4.0.

---

## 1. Topología de Red (Aislamiento de Microservicios)

Nexus opera sobre una red virtual privada de Docker. Solo los puntos de entrada estratégicos están expuestos.

### 🌍 Puntos de Entrada Públicos
| Servicio | Rol | Acceso |
| :--- | :--- | :--- |
| **Frontend React** | UI Administrativa | `https://multiagents-frontend...` |
| **Orchestrator** | API & Webhooks | `https://multiagents-orchestrator...` |
| **BFF Service** | Real-time Stream | `https://multiagents-bff...` |

### 🔒 Red Interna (Docker DNS)
La comunicación entre servicios no sale a internet. Se utiliza el DNS interno de Docker:
- `http://orchestrator:8000`
- `http://agent_service:8001`
- `http://bff_service:3000`
- `redis://redis:6379`

---

## 2. Gestión de Seguridad (Build-Time Protocol)

### 🔐 El Token de Administración (`ADMIN_TOKEN`)
En v4.0, la seguridad se basa en una coincidencia exacta de tokens entre el cliente y el servidor.

> [!IMPORTANT]
> **Doble Configuración Requerida**:
> 1. **Backend (Orchestrator)**: Configurado en **Environment Variables** como `ADMIN_TOKEN`.
> 2. **Frontend (React)**: Configurado en **Build Arguments** como `VITE_ADMIN_TOKEN`. 

Si estos tokens no coinciden, el sistema devolverá errores `401 Unauthorized` al intentar listar agentes o tiendas.

### 🏗️ Build Arguments (Easypanel)
Dado que el frontend es estático, el `Dockerfile` v4.0 requiere capturar las variables durante el proceso de construcción:
- `VITE_ADMIN_TOKEN`: Tu secreto de acceso.
- `VITE_API_BASE_URL`: URL pública del Orquestador.

---

## 3. Matriz de Variables por Servicio

### Orchestrator (Python)
- `ADMIN_TOKEN`: Secreto maestro.
- `DATABASE_URL`: Conexión de persistencia.
- `REDIS_URL`: Sistema de mensajes/cache.

### BFF (Node.js)
- `ORCHESTRATOR_URL`: `http://orchestrator:8000` (Interno).
- `ADMIN_TOKEN`: Debe coincidir con el Orquestador.

### Frontend (Build-Time)
- `VITE_ADMIN_TOKEN`: Se inyecta en el JS durante `npm run build`.
- `VITE_API_BASE_URL`: Destino de todas las llamadas API.

---

> **Nota de Resiliencia**: Nexus v4.0 implementa **Auto-Reparación de Infraestructura**. Si un servicio cae, Docker lo reinicia automáticamente; si la base de datos se desvía, el orquestador recompone el esquema en el próximo arranque.

**© 2025 Platform AI Solutions - Nexus Architecture**
