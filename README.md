---

# 🛸 Nexus v5.1: Sovereign Architecture

> **Plataforma Multi-Agente de Alto ROI para E-Commerce (TiendaNube + WhatsApp + Meta)**
> *Arquitectura Soberana, Multi-Tenant y Audit-Ready.*

---

## 🔥 5 Pilares de la Evolución v5.1

### 🛡️ 1. Bóveda de Credenciales Soberana (Sovereign Vault)
Eliminamos la dependencia del archivo `.env` para llaves de API críticas.
*   **Antes:** `OPENAI_API_KEY` global compartida.
*   **Ahora:** Cada inquilino (Tenant) tiene sus propias llaves encriptadas (AES-256) en la base de datos.
*   **Seguridad:** Audit-Ready. Aislamiento total de cuotas y consumo de recursos entre clientes.

### 📧 2. Protocolo de Correo Híbrido (Omega)
Resolución definitiva del conflicto de identidad en emails.
*   **System Path:** Nexus usa un SMTP global (Brevo) para notificaciones críticas de infraestructura.
*   **Agent Path:** Cada bot usa el SMTP propio de la tienda para hablar con sus clientes.
*   **Visibilidad:** Detección en tiempo real de bloqueos de IP y errores DNS (Error 550).

### 🤖 3. Inteligencia Multi-Cloud por Inquilino
Libertad creativa descentralizada.
*   **Gemini & Imagen 3:** Inyección dinámica de modelos de Google AI. cada tienda carga su propia llave.
*   **Galaxy RAG:** Bases de conocimiento vectoriales independientes y segmentadas por `tenant_id`.

### 🗄️ 4. Blindaje Estructural (Database Armour)
Corrección de colisiones en sistemas masivos.
*   **Restricción Única Inteligente:** `UNIQUE(name, tenant_id)`.
*   **Escalabilidad:** Permite que 1000 tiendas tengan una credencial llamada "openai_key" sin conflictos.

### 🪄 5. Auto-Sedimentación
Migración sin dolor.
*   **Bootloader:** Al arrancar, el sistema detecta si hay llaves en `.env` y las "siembra" automáticamente en la bóveda del primer inquilino.
*   **Limpieza:** Tras el primer arranque, el `.env` puede (y debe) ser purgado de secretos sensibles.

---

## 🚀 Guía de Despliegue Rápido

### Requisitos
*   Docker & Docker Compose
*   Python 3.11+
*   Node.js 18+

### Instalación Zero-Config
```bash
# 1. Clona el repositorio
git clone <repo_url>

# 2. Configura variables mínimas (Ver .env.example)
# Solo necesitas ADMIN_TOKEN y credenciales de BD/Redis.

# 3. Despliega
docker-compose up -d --build
```
*El sistema realizará la Auto-Sedimentación en el primer inicio.*

---

## 📚 Documentación Oficial

*   **[Manual de Vuelo v5.1](./Manual%20de%20Vuelo%20Nexus%20v5.md)**: Operaciones diarias, gestión de credenciales y monitoreo.
*   **[Deep Dive Técnico](./docs/TECHNICAL_DEEP_DIVE_V5_1.md)**: Detalles de arquitectura, base de datos y seguridad.
*   **[Protocolo Meta Uplink](./docs/META_UPLINK_PROTOCOL.md)**: Guía de integración con Facebook, Instagram y WhatsApp.

---

**© 2026 Platform AI Solutions - Nexus Core Team**
