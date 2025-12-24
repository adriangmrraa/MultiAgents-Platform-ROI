# 🤝 Guía de Operaciones (MultiAgents-Platform-ROI)

Este documento detalla los **procedimientos operativos** para mantener, desplegar y escalar la plataforma ROI. 

---

## 2. 🚀 Guía de Despliegue en EasyPanel (Hetzner/VPS)

Esta es la ruta recomendada para escalabilidad y ahorro de costos. Sigue estos pasos para un despliegue limpio:

### Paso 1: Crear el Proyecto
1.  En EasyPanel, haz clic en **"Create Project"** y nómbralo `multiagents`.

### Paso 2: Crear los Servicios de Infraestructura
1.  **PostgreSQL**: Ve a "Services" -> "Add Service" -> **App** (o usa el template de Postgres). 
    *   Si usas "App", usa la imagen `postgres:13`.
    *   Configura las variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
2.  **Redis**: Añade un servicio tipo **App** con la imagen `redis:alpine`.

### Paso 3: Desplegar los Microservicios (Apps)
Para cada uno de los 4 microservicios, añade un servicio tipo **App** -> **GitHub**:
1.  Conecta tu repositorio.
2.  **Configuración de Carpeta (Docker Context)**:
    *   Para `orchestrator`: Docker Source Path = `./orchestrator_service`.
    *   Para `agent-core`: Docker Source Path = `./agent_service`.
    *   Para `tiendanube`: Docker Source Path = `./tiendanube_service`.
    *   Para `whatsapp`: Docker Source Path = `./whatsapp_service`.
    *   Para `bff`: Docker Source Path = `./bff_service`.
    *   Para `frontend`: Docker Source Path = `./frontend_react`.

### Paso 4: Variables de Entorno y Networking
EasyPanel asigna nombres de host automáticos dentro del proyecto. Configura las variables en cada App:

*   **Orchestrator**:
    *   `POSTGRES_DSN`: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`
    *   `REDIS_URL`: `redis://redis:6379`
    *   `AGENT_SERVICE_URL`: `http://agent-core:8001`
    *   `TIENDANUBE_SERVICE_URL`: `http://tiendanube:8002`
    *   `WHATSAPP_SERVICE_URL`: `http://whatsapp:8002`
*   **Agent Core**:
    *   `OPENAI_API_KEY`: Tu clave global.
    *   `INTERNAL_API_TOKEN`: Debe coincidir con el del Orchestrator.
*   **BFF**:
    *   `ORCHESTRATOR_URL`: `http://orchestrator:8000`
*   **Frontend**:
    *   `VITE_API_BASE_URL`: La URL pública (`https://bff...`) de tu App del BFF.

---

---

## 3. ⚙️ Configuración de Nueva Tienda (Multi-Tenant)

Para agregar un nuevo cliente (Tienda) al bot:

**Vía Base de Datos (Recomendado):**
1.  Inserta una fila en la tabla `tenants`.
2.  Datos obligatorios:
    *   `store_name`: Nombre visible.
    *   `bot_phone_number`: Número de WhatsApp (Formato: `54911...`). **CRÍTICO**: Debe coincidir con el `to` del webhook de YCloud.
    *   `tiendanube_store_id` y `tiendanube_access_token`: Credenciales de la API.
    *   `system_prompt_template`: El "cerebro" inicial del bot.

**Vía UI (Si está habilitado):**
1.  Ve a `/admin/tenants` (o sección Configuración).
2.  Usa el formulario para crear/editar.

---

## 4. ✋ Configuración de Derivación Humana (Handoff)

Cómo configurar que el bot se apague y avise a un humano:

1.  **Habilitación**:
    *   En la tabla `tenant_human_handoff_config`, setear `enabled = true`.
2.  **Destino**:
    *   Configurar `destination_email`.
    *   Configurar credenciales SMTP (`smtp_host`, `smtp_user`, `smtp_password_encrypted`).
3.  **Triggers (Disparadores)**:
    *   El bot usa la tool `derivhumano` cuando detecta intención (ej: "quiero hablar con alguien").
    *   Puedes forzarlo manualmente desde el Chat de la UI (Botón "Human Override").

---

## 5. 🛠️ Troubleshooting (Solución de Problemas)

**Problema: "El bot no responde en WhatsApp"**
1.  ¿Está el servidor corriendo? Revisa EasyPanel.
2.  ¿Llega el Webhook? Revisa los logs (`POST /chat/webhook`).
    *   Si ves `Tenant not found for phone...`: Revisa que el número en la tabla `tenants` coincida EXACTAMENTE con el que envía YCloud.
3.  ¿Error de OpenAI? Revisa si la API Key es válida.

**Problema: "El bot inventa productos o precios"**
1.  Revisa el `system_prompt_template`.
2.  Asegúrate de que la variable `{STORE_CATALOG_KNOWLEDGE}` se esté inyectando correctamente.
3.  Verifica que la tool `search_specific_products` esté funcionando (mira los logs de `tiendanube_service`).

**Problema: "Los cambios en el código no se ven"**
1.  ¿Hiciste `git push`?
2.  ¿Terminó el deploy en EasyPanel?
3.  Intenta reiniciar el contenedor manualmente si es necesario.

---

## 6. 🧹 Limpieza de Código (Refactoring Workflow)

Si vas a limpiar código (ej: quitar hardcoding):
1.  Identifica todas las ocurrencias (`grep_search`).
2.  Crea un plan de reemplazo seguro (usando `os.getenv` con valores por defecto seguros).
3.  Prueba localmente o verifica que la lógica de fallback funcione.
4.  Avisa al usuario qué variables de entorno NUEVAS necesita agregar en EasyPanel.
