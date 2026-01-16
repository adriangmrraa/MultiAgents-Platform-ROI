# 🛡️ Nexus v5.1 Infrastructure Guide (Sovereign Edition)

Este documento define la **Topología de Red**, las **Políticas de Seguridad** y la **Matriz de Resiliencia** del ecosistema Nexus v5.1.

---

## 1. Topología de Red (Nexus Sovereign Mesh)

Nexus opera en una red descentralizada donde el Orquestador actúa como el búnker central de datos y secretos.

### Mapa de Comunicación (Docker Network)
```mermaid
graph TD
    User((Usuario)) --> FE[Frontend React Port 80]
    FE --> OR[Orchestrator Port 8000]
    OR --> DB[(PostgreSQL + Vault)]
    OR --> RD[(Redis Cache)]
    OR --> TN[TiendaNube Service Port 8003]
    OR --> WA[WhatsApp Service Port 8002]
    OR --> MT[Meta Service (Diplomat) Port 8004/8000]
```

### Puertos y Accesos
- **Públicos**: `80` (UI), `8000` (API/Webhooks).
- **Internos**: `5432` (DB), `6379` (Redis). Todos los puertos internos están cerrados al trafico exterior mediante el firewall de EasyPanel/Docker.

---

## 2. Gestión de Seguridad (Sovereign Vault)

A partir de la v5.1, la seguridad se desvincula de los archivos `.env` planos para pasar a una **Bóveda Cifrada en DB**.

- **Cifrado AES-256**: Los secretos se procesan con `cryptography.fernet`.
- **Aislamiento Multi-Tenant**: Las credenciales están particionadas por `tenant_id`.
- **Secretos de Runtime**:
    - `ADMIN_TOKEN`: Autenticación para el panel administrativo.
    - `ENCRYPTION_KEY`: Llave maestra de la bóveda.
    - `DATABASE_URL` / `REDIS_URL`: Conectividad de infraestructura.
    - `INTERNAL_SECRET_KEY`: Llave de alta seguridad para comunicación entre microservicios (Orquestador <-> Meta).

---

## 3. Matriz de Resiliencia (Protocolo Omega)

| Escenario | Protocolo de Respuesta | Estado |
| :--- | :--- | :--- |
| **Caída de Orquestador** | Auto-restart por Docker Healthcheck. | `AUTO-HEAL` |
| **Error de API Key** | Notificación al usuario para recarga en la Bóveda. | `Sovereign Alert` |
| **Schema Drift** | El orquestador repara la tabla al arrancar (Main.py). | `Schema Surgeon` |
| **Sobrecarga de RAG** | Throttling automático y batching de embeddings. | `Queue Managed` |

---

## 4. Build & Runtime Arguments

Para un despliegue exitoso, asegúrate de configurar estos parámetros en tu proveedor de hosting:

- `POSTGRES_URL`: Conexión a la DB principal.
- `REDIS_URL`: Conexión para el sistema de eventos SSE.
- `ADMIN_TOKEN`: Clave para el `X-Admin-Token` del frontend.
- `ENCRYPTION_KEY`: Genera una llave Fernet válida (`cryptography.fernet.Fernet.generate_key()`).
- `PORT`: Generalmente `8000` para el Orquestador.

---

---

## 5. Guía de Resiliencia SMTP
Para garantizar que los correos de Nexus no sean bloqueados por proveedores de hosting tradicionales (como Ferozo/DonWeb):

### Configuración Recomendada (Brevo Relay)
- **Host**: `smtp-relay.brevo.com`
- **Port**: `587` (STARTTLS).
- **Security**: Evitar el puerto 465 en entornos Cloud si hay firewalls restrictivos.

### Coexistencia de DNS (Ferozo + Brevo)
Si el dominio ya maneja correos en otro proveedor:
1.  **DKIM/CNAME**: Agregar los registros de Brevo sin tocar los existentes.
2.  **DMARC Merge**: No duplicar el registro `_dmarc`. Fusionar así:
    `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`
3.  **SPF**: Solo es necesario agregar el `include:spf.brevo.com` si se desea máxima autoridad.

---

**© 2026 Platform AI Solutions - Sovereign Infrastructure Team**
