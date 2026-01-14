# 🛡️ Nexus v5 Infrastructure Guide (Titan Protocol)

Este documento define la **Topología de Red** y las **Políticas de Seguridad** para el despliegue de Nexus v4.4.

---

## 1. Topología de Red (Omnicanalidad Nexus)

Nexus opera sobre una red virtual privada, protegiendo la lógica de negocio y exponiendo solo lo necesario.

### 🌍 Puntos de Entrada Públicos
| Servicio | Rol | Acceso |
| :--- | :--- | :--- |
| **Frontend React** | UI Administrativa | `https://multiagents-frontend...` |
| **Orchestrator** | API, Webhooks & SSE | `https://multiagents-orchestrator...` |

### 🔒 Red Interna (Docker DNS)
- `http://orchestrator:8000` (Centro de Gravedad)
- `http://agent_service:8001` (Neural Core)
- `http://chatwoot_service:8002` (Gateway Universal)
- `redis://redis:6379` (Telemetry & State)
- **Resolver DNS**: `127.0.0.11` (Docker Embedded)

---

## 2. Gestión de Seguridad v4.4

### 🔐 Autenticación Maestro-Satélite
- **Admin API**: Requiere `X-Admin-Token` en todas las peticiones a `/admin/*`.
- **SSE Stream**: Permite `?token=` en la URL para el stream de consola (necesario para compatibilidad nativa de `EventSource`).

### 🏗️ Build Arguments
- `VITE_ADMIN_TOKEN`: Inyectado en la construcción del frontend.
- `VITE_API_BASE_URL`: Apunta al Orquestador.

---

## 3. Matriz de Resiliencia

Nexus v4.4 implementa **Auto-Reparación Estructural**:
1.  **Arranque**: El orquestador audita el esquema de la base de datos.
2.  **Reparación**: Si falta el soporte para multicanalidad (`channel_source`, `meta`), el sistema inyecta las columnas automáticamente.
3.  **Omega Standard**: Uso estricto de UUIDs para garantizar que la telemetría nunca sufra colisiones de ID.

------

**© 2025 Platform AI Solutions - Nexus Architecture**
