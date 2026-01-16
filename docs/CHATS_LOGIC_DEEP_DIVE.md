# 💬 Gestión Multicanal (Chats Logic Deep Dive)

Este documento detalla la lógica interna de la vista `Chats.tsx`, el centro de control operacional para la mensajería omnicanal de Nexus.

---

## 🏗️ Arquitectura de Comunicación

La vista de Chats no es simplemente un lector de base de datos; implementa un patrón de **Sincronización Híbrida** para garantizar que los mensajes lleguen en tiempo real sin saturar el servidor.

### Componentes Clave
1.  **Frontend (`Chats.tsx`)**: Interfaz unificada para WhatsApp, Instagram y Facebook.
2.  **API Polling (`/admin/chats/summary`)**: Mecanismo de actualización de lista de contactos.
3.  **Message Loop (`loadHistory`)**: Loop optimizado para traer nuevos mensajes de la conversación activa.
4.  **Send Tunnel (`/admin/whatsapp/send`)**: Túnel único de salida unificado.

---

## 🔄 Flujo de Datos

### 1. Carga de Conversaciones (The Omni-List)
Al iniciar, el sistema llama a `loadChats`:
-   **Endpoint**: `GET /admin/chats/summary`
-   **Filtros**:
    -   `human_override=true`: Solo ver chats bloqueados por humanos.
    -   `channel`: Filtrar por origen (WhatsApp/IG/FB).
-   **Polling**: Se ejecuta cada **10 segundos** para detectar nuevos chats entrantes.
-   **Paginación**: Scroll infinito (`limit=20`) usando `handleScroll`.

### 2. Sincronización de Mensajes (Active Loop)
Cuando seleccionas un chat (`selectedChatId`), se activa un loop dedicado de alta frecuencia:
-   **Frecuencia**: 3 segundos.
-   **Endpoint**: `GET /admin/chats/{id}/messages`
-   **Optimización**: El backend devuelve todo el historial. En futuras versiones (v6), esto migrará a Delta Sync (solo lo nuevo).
-   **Renderizado**:
    -   **Texto**: Detecta enlaces y los hace clicables.
    -   **Adjuntos**: Renderiza imágenes, videos y audios basándose en el array `attachments` del payload JSON.
    -   **Legacy**: Soporta el formato antiguo `[AUDIO_URL:...]` para retrocompatibilidad.

### 3. Envío de Mensajes (Unified Outbox)
El operador escribe y envía:
1.  **Optimistic UI**: El mensaje aparece inmediatamente en pantalla (grisado o normal) antes de confirmar.
2.  **API Call**: `POST /admin/whatsapp/send`.
3.  **Payload**:
    ```json
    {
      "conversation_id": "uuid",
      "message": "Hola, ¿en qué puedo ayudarte?",
      "channel_source": "instagram" // Vital para saber a qué API externa llamar
    }
    ```
4.  **Backend Routing**: El orquestador detecta `channel_source` y enruta al microservicio correcto (`whatsapp_service` o `meta_service`).

---

## ⚡ Funcionalidades Especiales

### A. Intervención Humana (Handoff)
El switch "Agente Activo / Intervención Humana" es un control crítico de soberanía.
-   **Acción UI**: Toggle switch.
-   **Efecto Backend**:
    -   Llama a `/admin/conversations/{id}/human-override`.
    -   Establece la flag `is_locked = true` en la tabla `chat_conversations`.
    -   **Consecuencia**: El bot dejará de responder automáticamente a este usuario hasta que se desactive el switch o expire el tiempo (si configurado).

### B. Indicadores Visuales
-   **Estado**: Un punto verde indica "Online" (basado en la última interacción).
-   **Fuente**: Un icono pequeño (Logo WA/IG/FB) indica el origen del chat.
-   **Borde de Color**: 
    -   Verde: WhatsApp
    -   Rosa: Instagram
    -   Azul: Facebook

---

## 💾 Persistencia

-   **Tablas**: `chat_conversations` (cabeceras) y `chat_messages` (contenido).
-   **Adjuntos**: Se almacenan como JSONB en la columna `attachments` de `chat_messages`.

---

## 🔬 Especificaciones Técnicas (Debugging Guide)

Esta sección es para desarrolladores que necesitan depurar errores en la vista `Chats.tsx`.

### 1. Estados Críticos (React State)
| Estado | Tipo | Descripción | Error Común |
| :--- | :--- | :--- | :--- |
| `contacts` | `Contact[]` | Lista de conversaciones activas. | Si está vacío `[]`, verificar respuesta de `/summary`. |
| `selectedChatId` | `string` | UUID de la conversación seleccionada. | Si es `undefined`, el panel derecho no cargará. |
| `messages` | `Message[]` | Array de mensajes del chat actual. | Puede venir desordenado; el frontend debe ordenar por fecha. |
| `isHumanOverride` | `boolean` | Estado del switch de handoff. | Si no se actualiza, falló el PATCH a `/human-override`. |

### 2. Endpoints & Payloads

#### A. Listar Conversaciones
*   **Request**: `GET /api/admin/chats/summary?human_filter=all&limit=20`
*   **Response (200 OK)**:
    ```json
    [
      {
        "id": "uuid-v4",
        "customer_phone": "54911...",
        "last_message": "Hola",
        "timestamp": "2024-01-01T12:00:00Z",
        "channel_source": "whatsapp",
        "unread_count": 0,
        "is_locked": false, // Indica Human Override
        "participants": ["..."]
      }
    ]
    ```
*   **Punto de Falla**: Si `id` viene nulo, la lista no será clicable.

#### B. Obtener Historial
*   **Request**: `GET /api/admin/chats/{chatId}/messages`
*   **Response**:
    ```json
    [
      {
        "id": 101,
        "sender": "user", // o "bot"
        "content": "Quiero zapatos",
        "timestamp": "...",
        "attachments": [{"type": "image", "url": "..."}] // Crítico para multimedia
      }
    ]
    ```

#### C. Enviar Mensaje
*   **Request**: `POST /api/admin/whatsapp/send`
*   **Body**:
    ```json
    {
      "conversation_id": "uuid-v4",
      "message": "Texto...",
      "channel_source": "whatsapp" // OBLIGATORIO. Si falta, el backend no sabe qué driver usar.
    }
    ```

#### D. Activar Handoff (Human Override)
*   **Request**: `POST /api/admin/conversations/{chatId}/human-override`
*   **Body**: `{ "locked": true }`
*   **Efecto**: Bloquea al bot para que NO responda en este chat.

### 3. Logs de Consola Comunes
*   `⚠️ Chat ID undefined`: Ocurre cuando se hace click en un contacto que no tiene `id` válido en la respuesta `/summary`.
*   `Failed to fetch messages`: Error de red o endpoint 500 en `/messages`.
*   `Error sending message`: Generalmente por falta de `channel_source` o problemas con la API de Meta.

