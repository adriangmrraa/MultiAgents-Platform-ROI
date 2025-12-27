# Nexus v4.4 - Guía de Integración con Chatwoot

Este documento detalla la arquitectura, implementación y configuración de **Chatwoot** como centro de mensajería omnicanal para la plataforma Nexus.

---

## 1. Arquitectura de Integración

Nexus utiliza **Chatwoot** como un "Gateway Unificado" para la entrada y salida de mensajes. Esto permite soportar múltiples canales (WhatsApp, Messenger, Instagram, Email, Web Widget) sin tener que escribir adaptadores específicos para cada uno en el Orchestrator.

### Flujo de Datos

1.  **Entrada (User -> Agent)**:
    *   El usuario envía un mensaje a través de cualquier canal conectado a Chatwoot (ej. Instagram Direct).
    *   Chatwoot recibe el mensaje y dispara un **Webhook** hacia el Orchestrator (`POST /chat`).
    *   **Orchestrator** procesa el payload, identifica el `source_id` (Chatwoot Conversation ID) y extrae el contenido.

2.  **Procesamiento (Nexus AI)**:
    *   La lógica del agente en Nexus analiza el texto y, si es necesario, genera una respuesta.
    *   Si hay intervención humana ("Human Override"), el agente se silencia automáticamente.

3.  **Salida (Agent -> User)**:
    *   Nexus envía la respuesta llamando a la API de Chatwoot (`POST /api/v1/accounts/{id}/conversations/{id}/messages`).
    *   Chatwoot se encarga de entregar el mensaje al canal final (ej. el usuario de Instagram).

---

## 2. Implementación Técnica (v4.4+)

### 2.1 Webhook Unificado (`/chat`)
El endpoint `/chat` del Orchestrator ha sido estandarizado para manejar payloads de Chatwoot. 

**Características Clave:**
*   **Detección de Proveedor**: Identifica automáticamente si el webhook viene de Chatwoot mediante `provider: "chatwoot"`.
*   **Mapeo de Roles**:
    *   `message_type: "incoming"` -> **User** (Mensaje del cliente).
    *   `message_type: "outgoing"` -> **Assistant** (Mensaje del agente o humano desde Chatwoot).
*   **Human Handoff**: Detecta cambios de estado o asignación de agentes en Chatwoot para activar/desactivar el modo automático en Nexus.

### 2.2 Soporte Multimedia (Nuevo en v4.4)
El sistema ahora soporta la ingesta y visualización completa de archivos adjuntos.

*   **Ingesta**: El Orchestrator parsea el array `attachments` del payload de Chatwoot.
*   **Almacenamiento**:
    *   Los metadatos se guardan en la tabla `chat_media`.
    *   El contenido se clasifica por tipo: `image`, `video`, `audio`, `file`.
*   **Visualización (Frontend)**:
    *   **Imágenes**: Renderizado directo con previsualización.
    *   **Videos**: Reproductor HTML5 integrado en el chat.
    *   **Audios**: Reproductor de audio nativo con soporte para notas de voz.
    *   **Documentos**: Enlace de descarga seguro.

---

## 3. Guía de Configuración (Paso a Paso)

Sigue estos pasos para configurar una nueva instancia de Chatwoot con Nexus.

### Prerrequisitos
*   Una instancia de Chatwoot desplegada y funcionando (ej. `chat.tu-dominio.com`).
*   Acceso de Administrador a Chatwoot.
*   URL pública de tu Orchestrator (ej. `https://api.nexus-platform.com`).

### Paso 1: Crear un Token de Agente (Bot)
Nexus necesita una "Personal Access Token" te un usuario "Bot" en Chatwoot para enviar mensajes.
1.  En Chatwoot, ve a **Configuración de Perfil**.
2.  Copia el **Access Token**.
3.  Configura este token en las variables de entorno de Nexus (`CHATWOOT_API_TOKEN`).

### Paso 2: Crear Bandejas de Entrada (Inboxes)
Crea una Inbox para cada canal que desees conectar (WhatsApp, API, Facebook, etc.).

1.  Ve a **Ajustes > Bandejas de entrada**.
2.  Haz clic en **"Añadir bandeja de entrada"**.
3.  Selecciona el canal (por ejemplo, "API" para pruebas o conexión genérica).
4.  Asigna un nombre (ej. "Nexus Bot").
5.  Completa la creación y anota el **Inbox ID** (aunque Nexus suele descubrirlo dinámicamente si es necesario, lo importante es el webhook).

### Paso 3: Configurar el Webhook
Esta es la parte crítica para que Nexus "escuche".

1.  Dentro de la configuración de la Bandeja de Entrada creada (o en **Ajustes > Integraciones > Webhooks** para un webhook global a nivel de cuenta).
2.  Haz clic en **"Añadir Webhook"**.
3.  **URL del Webhook**: Ingresa `https://<TU-ORCHESTRATOR-URL>/chat`.
4.  **Eventos a suscribir**: Selecciona **Message Created** (Creación de mensaje). *Opcional: Message Updated si deseas sincronizar ediciones.*
5.  Guardar.

### Paso 4: Validar la Conexión
1.  Abre el Chat Widget de tu Inbox (o envía un mensaje al canal conectado, como WhatsApp).
2.  Escribe "Hola".
3.  Verifica dos cosas:
    *   En **Chatwoot**: El mensaje aparece en la conversación.
    *   En **Nexus Platform UI**: Ve a la sección "Gestión Multicanal". Deberías ver la conversación creada y el mensaje "Hola".
4.  Si el Agente está activo, debería responder automáticamente y la respuesta aparecerá en Chatwoot.

### Solución de Problemas Comunes
*   **Bucle Infinito (Echo Loop)**: Si el agente se responde a sí mismo.
    *   *Solución*: Asegúrate de que Nexus ignore los mensajes con `message_type: outgoing` o `private: true`. (Esto ya está parcheado en v4.4).
*   **Imágenes no cargan**:
    *   *Solución*: Verifica que el contenedor de Chatwoot tenga configurado correctamente el almacenamiento (S3 o disco local) y que las URLs de adjuntos sean públicas/accesibles por el Orchestrator.
