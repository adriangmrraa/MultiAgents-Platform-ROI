# 🤝 Guía de Operaciones (Platform AI Solutions)

Este documento detalla los **procedimientos operativos** para mantener, desplegar y escalar la plataforma de inteligencia artificial.

---

## 1. 🐣 Conceptos Básicos para Principiantes

Si eres nuevo en este proyecto, estos son los términos clave que debes conocer:

*   **Tenant (Inquilino)**: Es cada cliente o tienda individual que usa el bot. El sistema es "Multi-tenant", lo que significa que un solo servidor puede manejar muchas tiendas diferentes al mismo tiempo.
*   **Orchestrator (Orquestador)**: Es el "cerebro logístico". Decide a dónde van los mensajes, guarda el historial del chat y maneja la base de datos.
*   **Agent (Agente)**: Es la "inteligencia pura". No guarda nada, solo recibe información y genera una respuesta inteligente usando IA.
*   **Handoff (Derivación)**: Es el proceso de "apagar" la IA para que un humano pueda hablar directamente con el cliente.

------
## 2. 🔑 Generación de Llaves de Seguridad

Para variables como `ENCRYPTION_KEY` o `ADMIN_TOKEN`, necesitas crear una cadena de texto larga y aleatoria. Aquí tienes cómo hacerlo si no tienes herramientas técnicas avanzadas:

### Opción A: Usando PowerShell (Windows)
Si estás en Windows, abre una terminal y pega esto:
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Opción B: Usando Python (Cualquier sistema)
Si tienes Python instalado, ejecuta esto:
```python
python -c "import secrets; print(secrets.token_hex(32))"
```

### Opción C: Generador Online
Usa cualquier sitio web de confianza como [1Password Password Generator](https://1password.com/password-generator/) configurado para generar una cadena de 32 a 64 caracteres.

> [!WARNING]
> Una vez que elijas una `ENCRYPTION_KEY` y guardes tu primer cliente, **NUNCA la cambies**, o no podrás volver a leer sus datos.

---

## 2. 🚀 Guía de Despliegue en EasyPanel (Hetzner/VPS)

Esta es la ruta recomendada para escalabilidad y ahorro de costos. Sigue estos pasos para un despliegue limpio:

### Paso 1: Crear el Proyecto
1.  En EasyPanel, haz clic en **"Create Project"** y nómbralo `platform-ai`.

### Paso 2: Crear los Servicios de Infraestructura
1.  **PostgreSQL**: Ve a "Services" -> "Add Service" -> **App** (o usa el template de Postgres). 
    *   Si usas "App", usa la imagen `postgres:13`.
    *   Configura las variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
2.  **Redis**: Añade un servicio tipo **App** con la imagen `redis:alpine`.

### Paso 3: Desplegar los Microservicios (Apps)
Para cada uno de los 5 microservicios base, añade un servicio tipo **App** -> **GitHub**:
1.  Conecta tu repositorio.
2.  **Configuración de Carpeta (Docker Context)**:
    *   Para `orchestrator`: Docker Source Path = `./orchestrator_service`.
    *   Para `agent-service`: Docker Source Path = `./agent_service`.
    *   Para `tiendanube`: Docker Source Path = `./tiendanube_service`.
    *   Para `whatsapp`: Docker Source Path = `./whatsapp_service`.
    *   Para `ui`: Docker Source Path = `./platform_ui`.

### Paso 4: Variables de Entorno y Networking
EasyPanel asigna nombres de host automáticos dentro del proyecto. Configura las variables en cada App:

*   **Orchestrator**:
    *   `POSTGRES_DSN`: `postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`
    *   `REDIS_URL`: `redis://redis:6379`
    *   `AGENT_SERVICE_URL`: `http://agent-service:8001`
    *   `TIENDANUBE_SERVICE_URL`: `http://tiendanube:8003`
    *   `WHATSAPP_SERVICE_URL`: `http://whatsapp:8002`
    *   `ENCRYPTION_KEY`: Una cadena larga y aleatoria para proteger los tokens de los clientes.
*   **Agent Service**:
    *   `OPENAI_API_KEY`: Clave global (fallback).
    *   `INTERNAL_API_TOKEN`: Token compartido.
*   **UI (Frontend)**:
    *   `API_BASE`: La URL pública (`https://api...`) del Orchestrator.

---

---

## 3. ⚙️ Configuración de Nueva Tienda (Multi-Tenant)

ParaAA


**Víaa Base de Datos (Recomendado):**
1.  Inserta una fila en la tabla `tenants`.
2.  Datos obligatorios:
    *   `store_name`: Nombre visible.
    *   `bot_phone_number`: Número de WhatsApp (Formato: `54911...`). **CRÍTICO**: Debe coincidir con el `to` del webhook de YCloud.
    *   `tiendanube_store_id` y `tiendanube_access_token`: Credenciales de la API.
    *   `system_prompt_template`: El "cerebro" inicial del bot.

**Vía UI (Si está habilitado):**
1.  Ve a `/admin/tenants` (o sección Configuración).
2.  Usa el formulario para crear/editar.

---------

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
