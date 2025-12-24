# 🤖 MultiAgents-Platform-ROI: Guía Suprema de Mantenimiento

Este documento es el manual definitivo para cualquier IA (LLM) que necesite operar en este sistema. El proyecto ha evolucionado de un prototipo monousuario a una plataforma **Multi-Tenant de Comercial Conversacional** con arquitectura **Nexus**.

---

## 🧱 Guardrails Arquitectónicos (Strategic Decisión)

### 1. Serverful vs Serverless (Por qué NO Vercel para el Core)
**Criterio Inmutable:** El `orchestrator_service` y el `whatsapp_service` deben ejecutarse en entornos **Serverful** (Contenedores 24/7).
*   **Razón**: OpenAI y los agentes de IA tienen latencias variables que exceden los límites de las Serverless Functions. Además, la persistencia de webhooks requiere respuestas inmediatas y persistencia de estado que las funciones efímeras no garantizan de forma nativa para este proyecto.

### 2. Soberanía de Datos y Tráfico
A medida que el tráfico de Media (Audios/Imágenes) crezca, se recomienda migrar de **Render** a **Hetzner + Coolify** para evitar costos prohibitivos de ancho de banda.

El sistema opera bajo el **Protocolo Omega** (Multi-Tenancy) y la arquitectura **Nexus v3** (Decentralized Brain).

### 📡 Traffic Controller (Orchestrator)
El `orchestrator_service` actúa como el casco del portaaviones. Gestiona la base de datos, los webhooks de entrada, la persistencia de mensajes y el ruteo administrativo. **Ya no procesa la IA directamente.**

### 🧠 Core Intelligence (Agent Service)
Ubicado en `agent_service`. Es el cerebro descentralizado. Recibe contexto del orquestador, razona usando LangChain y OpenAI, y ejecuta herramientas (Tools) de forma apátrida (stateless).

### 🎨 Control (Platform UI)
El dashboard administrativo en `platform_ui`. Es una aplicación **Vanilla JS** (legacy) / **React** (v2). En Render se despliega como `type: web` con `runtime: static`. No usa frameworks complejos en el core original, la gestión del estado es crítica.

### 🛡️ MCP Server (Advanced Context)
El sistema soporta el **Model Context Protocol (MCP)** para permitir que agentes de IA externos consulten el contexto operacional (logs, estado de despliegue) de forma segura.

---

## 💾 Base de Datos (PostgreSQL)

### 🚨 Tablas Críticas y Foreign Keys
1.  **`tenants`**: Tabla madre. Todo cuelga de aquí.
2.  **`chat_conversations`**: Metadata de chats.
    *   `human_override_until`: Si está en el futuro, la IA **NO** responde.
3.  **`tenant_human_handoff_config`**: Nueva tabla para SMTP y derivación.
    *   `tenant_id` es **PRIMARY KEY** y **FOREIGN KEY** (1:1 con tenants).
4.  **`credentials`**: Almacén de API Keys.
    *   `scope`: `global` (general) vs `tenant` (específico).
5.  **`nexus-cache` (KeyValue)**: Motor Valkey 8 para persistencia in-memory y colas. En Blueprints se define como `type: keyvalue`.

---

## 📜 Reglas de Oro para Agentes (Precauciones)

### 1. 🐍 Python / FastAPI (Backend)
-   **LA TRAMPA DE PYDANTIC (CRÍTICO):** Nunca definas un `BaseModel` (ej. `HumanOverrideModel`) dentro de una función asíncrona. Esto rompe el parser de Python y lanza un `SyntaxError` bizarro. **Define siempre las clases al nivel superior del archivo.**
-   **Cascada de Borrado Manual:** Para eliminar un tenant, debes seguir este orden exacto en una transacción para no romper las Foreign Keys:
    1.  Eliminar `tenant_human_handoff_config`.
    2.  Eliminar `chat_conversations` (esto dispara el borrado en cascada de mensajes y media).
    3.  Eliminar `credentials` específicos del tenant.
    4.  Eliminar el `tenant`.
-   **Passwords SMTP:** Al devolver la configuración al frontend, el password **DEBE** ir enmascarado como `********`. Al recibir un guardado, si el password trae asteriscos, **NO** lo sobrescribas; mantén el valor actual encriptado en la DB.

### 2. ⚡ JavaScript (Frontend)
-   **Variables Globales de Estado:** Variables como `allChats` **DEBEN** estar definidas en el scope global (inicio de `app.js`). Si las defines dentro de una función como `loadChats`, otras funciones (como `toggleHumanOverride`) fallarán con un `ReferenceError`.
-   **Verificación de Bloqueo:** Para saber si un chat está bloqueado en el UI, nunca compares strings de fecha. Usa:
    ```javascript
    const isLocked = new Date(chat.human_override_until) > new Date();
    ```

### 3. 🔄 Sincronización de Entorno
-   La función `sync_environment()` en `admin_routes.py` sincroniza el tenant "por defecto". 
-   **Regla:** Solo debe crear/actualizar el tenant si las variables de entorno `STORE_NAME` y `BOT_PHONE_NUMBER` **existen y no están vacías**. Si se eliminan del entorno, el sistema ya no debe recrearlas automáticamente, permitiendo el borrado total desde el UI.

---

## 🛠️ Implementación del Human Handoff (Derivación)

### 📧 Flujo de Correo
-   Se utiliza el modo de herramienta `derivhumano` en la IA.
-   El orquestador intercepta el llamado, lee la tabla `tenant_human_handoff_config`, desencripta la contraseña SMTP y envía un correo HTML al propietario.
-   **Trigger:** Al activarse la derivación, se pone `human_override_until` en un valor muy lejano (ej. año 2099) para pausar la IA.

### 🚦 El Toggle de Override
-   Ubicado en la cabecera del chat en el Platform UI.
-   **Estados:**
    -   🔴 **Rojo (Atención Humana)**: Bot silenciado. El humano tiene el control.
    -   🟢 **Verde (Agente Activo)**: El bot responde solo.
-   El frontend debe refrescar este estado basándose en los datos JSON que vienen de `/admin/chats`.

---

## 🚀 Guía de Endpoints (Referencia Rápida)

| Endpoint | Método | Acción |
| :--- | :--- | :--- |
| `/admin/handoff` | GET/POST | Configuración SMTP y reglas de email. |
| `/admin/conversations/{id}/human-override` | POST | Activa/Desactiva el silencio de la IA manualmente. |
| `/admin/tenants/{id}/details` | GET | Devuelve info, conexiones y estado de configuración global. |
| `/admin/chats` | GET | Lista de conversaciones con flags de bloqueo actualizados. |

---

## 📈 Observabilidad
-   Usa la tabla `system_events` para loguear errores graves desde el orquestador.
-   Cualquier error en el envío de emails SMTP debe quedar registrado allí para debugging.

---

## 🔮 Arquitectura "Next Gen" (En Desarrollo)
El proyecto contiene carpetas para una futura migración a React:
1.  **`frontend_react`**: Aplicación React (posiblemente Vite/Next) que reemplazará a `platform_ui`.
2.  **`bff_service`**: "Backend for Frontend". Probablemente un servicio Nodejs/Express intermedio.
    *   **Estado:** Experimental / En desarrollo.
    *   **Precaución:** Los agentes actuales deben priorizar `platform_ui` (Vanilla) y `orchestrator_service` parar mantener la estabilidad del sistema productivo, a menos que se les instruya específicamente trabajar en la migración.

---
**Recuerda:** Este código está diseñado para ser multi-tenant. Siempre usa `tenant_id` en tus consultas para no mezclar datos de diferentes tiendas.
