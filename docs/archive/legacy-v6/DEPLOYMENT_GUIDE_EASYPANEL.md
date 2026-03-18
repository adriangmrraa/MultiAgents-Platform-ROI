# 🛸 Guía Maestra de Despliegue en EasyPanel (v7.6 Sovereign Platinum)

Nexus está diseñado para operar bajo una arquitectura de microservicios dockerizados, lo que permite una escalabilidad masiva y un aislamiento total entre componentes. Esta guía detalla cómo desplegar la plataforma completa usando la plantilla unificada `easypanel.json`.

---

## 🏗️ 1. Arquitectura de Despliegue

Nexus no es un monolito; es un ecosistema. En EasyPanel, esto se traduce en un **Proyecto** que orquestas múltiples **Servicios (Apps)** conectados por una red interna privada.

### Componentes del Ecosistema:
*   **Orchestrator**: El cerebro que maneja la lógica de agentes, bases de datos y ruteo.
*   **Agent Service**: Motor de ejecución de IA (Llamadas a LLMs y herramientas).
*   **BFF (Backend for Frontend)**: Capa de seguridad y optimización para la UI.
*   **Meta Service**: Diplomático encargado de webhooks y OAuth de Facebook/IG/WhatsApp.
*   **Chatwoot Stack**: Suite completa para intervención humana (App + Redis + DB + Sidekiq).
*   **Supabase Stack**: Infraestructura para RAG (Vectores) y Auth opcional.
*   **Frontend**: Aplicación React v7.6.

---

## ⚡ 2. Despliegue con Plantilla (`easypanel.json`)

Para un despliegue rápido y profesional, utiliza el archivo `easypanel.json` ubicado en la raíz del proyecto.

1.  **Crea un Proyecto** en EasyPanel con el nombre que desees (ej: `nexus-pro`).
2.  **Importa la Plantilla**: Copia el contenido de `easypanel.json` en la sección de importación de EasyPanel.
3.  **Lógica Dinámica**: La plantilla utiliza `$(PROJECT_NAME)` para que todos los servicios y dominios se nombren automáticamente según el nombre que elegiste para el proyecto.

---

## 🔑 3. Configuración de Variables (Environment)

> [!IMPORTANT]
> Debes reemplazar los placeholders `REDACTED_*` en el dashboard de EasyPanel tras la importación.

### Variables Críticas:
*   **`ENCRYPTION_KEY`**: Clave Fernet (AES-256) para la bóveda de credenciales. **No la pierdas**, o no podrás desencriptar las llaves de tus clientes.
*   **`INTERNAL_SECRET_KEY`**: Token de handshake entre microservicios.
*   **`OPENAI_API_KEY`**: Necesaria en el `agent-service` para el razonamiento de la IA.
*   **`POSTGRES_DSN`**: URL interna de conexión a la base de datos principal.

---

## 🌐 4. Redes y Dominios

### Comunicación Interna (Docker Business)
Los servicios se hablan usando el nombre del servicio dentro de la red del proyecto. EasyPanel resuelve esto automáticamente.
*   *Ejemplo*: El Orchestrator llama al servicio de WhatsApp en `http://whatsapp:8002`.

### Comunicación Externa (Public Gateway)
Solo los servicios que interactúan con el usuario o proveedores externos tienen dominios públicos asignados:
*   **Frontend**: `$(PROJECT_NAME)-frontend.easypanel.host`
*   **Orchestrator**: `$(PROJECT_NAME)-orchestrator.easypanel.host` (Recibe API calls del front).
*   **Meta Service**: Necesita dominio público para los Webhooks de Meta.

---

## 🛠️ 5. Troubleshooting y Self-Healing

### A. El Problema de la Red (IP vs Hostname)
Si un servicio no puede conectar con la base de datos:
1.  **Hostname Check**: Asegúrate de que el Host coincida con `$(PROJECT_NAME)_postgres`.
2.  **IP Directa**: Si el DNS interno falla, usa la IP del contenedor (`hostname -i` desde la consola del servicio).

### B. Configuración de CORS
Para evitar bloqueos de seguridad:
1.  En el servicio `orchestrator`, la variable **`ALLOWED_ORIGINS`** debe contener la URL pública de tu frontend (ej: `https://nexus-frontend.easypanel.host`).

---

## 📜 6. Verificación Post-Despliegue

Una vez que todos los contenedores estén en verde, verifica la salud del sistema:
1.  **Health Check**: `https://tu-api.host/health`
2.  **DB Init**: `https://tu-api.host/admin/system/init-db` (Debe responder `status: ok`).

---
**© 2026 Platform AI Solutions - Sovereign Systems Division**
