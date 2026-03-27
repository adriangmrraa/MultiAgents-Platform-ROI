# Meta Native Connection — Guia Completa de Implementacion

Documentacion tecnica para replicar la conexion nativa de Meta (Facebook, Instagram, WhatsApp) via Embedded Signup / Facebook Login for Business con popup.

---

## Indice

1. [Arquitectura General](#1-arquitectura-general)
2. [Prerequisitos en Meta Developer Portal](#2-prerequisitos-en-meta-developer-portal)
3. [Variables de Entorno](#3-variables-de-entorno)
4. [Frontend: Popup de Conexion](#4-frontend-popup-de-conexion)
5. [Backend: Flujo de Conexion](#5-backend-flujo-de-conexion)
6. [Webhooks: Recepcion de Mensajes](#6-webhooks-recepcion-de-mensajes)
7. [Orchestrator: Ingestion y AI Agent](#7-orchestrator-ingestion-y-ai-agent)
8. [Delivery: Envio de Respuestas](#8-delivery-envio-de-respuestas)
9. [Base de Datos: Esquema Requerido](#9-base-de-datos-esquema-requerido)
10. [Microservicios y Docker](#10-microservicios-y-docker)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE CONEXION                           │
│                                                                     │
│  Frontend (React)    Orchestrator     Meta Service     Meta API     │
│       │                   │               │               │         │
│  1. Click "Conectar"      │               │               │         │
│       │───FB.login()──────┼───────────────┼──────────────►│         │
│       │◄──code/token──────┼───────────────┼───────────────│         │
│  2. POST /admin/meta/connect              │               │         │
│       │──────────────────►│               │               │         │
│  3.   │                   │──POST /connect►│               │         │
│  4.   │                   │               │──exchange code►│         │
│       │                   │               │◄──long token───│         │
│  5.   │                   │               │──/me/accounts─►│         │
│       │                   │               │◄──pages/IG/WA──│         │
│  6.   │                   │               │──subscribe────►│         │
│       │                   │               │◄──success──────│         │
│  7.   │                   │◄──credentials──│               │         │
│       │                   │  (sync to DB)  │               │         │
│  8.   │◄──assets summary──│               │               │         │
│       │  (show wizard)     │               │               │         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     FLUJO DE MENSAJES                               │
│                                                                     │
│  Usuario DM    Meta Platform   Meta Service   Orchestrator   Relay  │
│      │              │              │              │            │     │
│  1.  │──mensaje────►│              │              │            │     │
│  2.  │              │──webhook────►│              │            │     │
│  3.  │              │              │──normalize───►│            │     │
│      │              │              │ POST /ingest  │            │     │
│  4.  │              │              │              │──resolve    │     │
│      │              │              │              │  tenant     │     │
│  5.  │              │              │              │──persist    │     │
│      │              │              │              │  message    │     │
│  6.  │              │              │              │──trigger    │     │
│      │              │              │              │  AI agent   │     │
│  7.  │              │              │              │──response──►│     │
│  8.  │              │◄─────────────┼──────────────┼─Graph API──│     │
│  9.  │◄──respuesta──│              │              │            │     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisitos en Meta Developer Portal

### 2.1 Crear App de Meta

1. Ir a https://developers.facebook.com/apps/
2. Crear una nueva app tipo **Business**
3. Anotar el **App ID** y **App Secret**

### 2.2 Configurar Facebook Login for Business

1. En la app, agregar el producto **Facebook Login for Business**
2. Crear una **Configuration** (config_id):
   - Permisos requeridos:
     - `pages_messaging` (enviar/recibir mensajes de Messenger)
     - `pages_manage_metadata` (suscribirse a webhooks)
     - `instagram_basic` (leer info de cuenta IG)
     - `instagram_manage_messages` (enviar/recibir DMs de IG)
     - `whatsapp_business_management` (gestionar WABA)
     - `whatsapp_business_messaging` (enviar/recibir mensajes WA)
     - `business_management` (acceder a Business Manager)
   - Response type: `code`
3. Anotar el **config_id** generado

### 2.3 Configurar Webhooks

1. En **Messenger > Settings > Webhooks**:
   - Callback URL: `https://<tu-meta-service-url>/webhook`
   - Verify Token: el mismo que setees en `META_VERIFY_TOKEN`
   - Suscribir a: `messages`, `messaging_postbacks`, `message_reads`, `message_deliveries`

2. En **Instagram > Webhooks** (si aplica):
   - Misma callback URL
   - Suscribir a: `messages`

3. En **WhatsApp > Configuration > Webhooks**:
   - Misma callback URL
   - Suscribir a: `messages`

### 2.4 Configurar Data Deletion Callback

- URL: `https://<tu-meta-service-url>/privacy/data-deletion`
- Requerido por Meta para aprobar la app

### 2.5 Dominios Permitidos

En **Facebook Login for Business > Settings**:
- Agregar el dominio de tu frontend a **Valid OAuth Redirect URIs** (aunque con `config_id` + `response_type: code`, no siempre es necesario)

---

## 3. Variables de Entorno

### 3.1 Frontend (React/Vite)

| Variable | Descripcion | Ejemplo |
|----------|------------|---------|
| `VITE_FACEBOOK_APP_ID` | App ID de Meta Developer | `123456789012345` |
| `VITE_META_CONFIG_ID` | Config ID de Facebook Login for Business | `987654321098765` |
| `VITE_META_EMBEDDED_SIGNUP` | Habilita Embedded Signup para WhatsApp (solo si eres Tech Provider aprobado) | `false` |
| `VITE_FACEBOOK_API_VERSION` | Version de Graph API (opcional, default v22.0) | `v22.0` |
| `VITE_API_URL` | URL del orchestrator | `https://api.tuapp.com` |

### 3.2 Meta Service

| Variable | Descripcion | Ejemplo |
|----------|------------|---------|
| `META_APP_ID` | App ID de Meta (para exchange de code) | `123456789012345` |
| `META_APP_SECRET` | App Secret de Meta | `abc123def456...` |
| `META_VERIFY_TOKEN` | Token de verificacion para webhook challenge | `mi_token_secreto` |
| `META_GRAPH_API_VERSION` | Version de Graph API (default v22.0) | `v22.0` |
| `META_REDIRECT_URI` | Override forzado de redirect_uri para exchange (opcional) | `https://app.tudominio.com` |
| `ORCHESTRATOR_URL` | URL interna del orchestrator | `http://orchestrator_service:8000` |
| `INTERNAL_SECRET_KEY` | Secret compartido para comunicacion inter-servicio | `mi_secret_key` |
| `FRONTEND_URL` | URL del frontend (fallback para redirect_uri) | `https://app.tudominio.com` |

### 3.3 Orchestrator Service

| Variable | Descripcion | Ejemplo |
|----------|------------|---------|
| `INTERNAL_API_TOKEN` | Token de autenticacion interna (debe coincidir con `INTERNAL_SECRET_KEY` del meta_service) | `mi_secret_key` |
| `META_SERVICE_URL` | URL interna del meta_service | `http://meta_service:8000` |
| `WHATSAPP_SERVICE_URL` | URL del relay/delivery service | `http://whatsapp_service:8002` |
| `AGENT_SERVICE_URL` | URL del servicio de agente de IA | `http://agent_service:8001` |
| `REDIS_URL` | URL de Redis para buffer y pub/sub | `redis://redis:6379` |

### 3.4 Relay/Delivery Service (whatsapp_service)

| Variable | Descripcion | Ejemplo |
|----------|------------|---------|
| `ORCHESTRATOR_URL` | URL del orchestrator (para fetch de credentials) | `http://orchestrator_service:8000` |
| `INTERNAL_SECRET_KEY` | Secret compartido | `mi_secret_key` |

---

## 4. Frontend: Popup de Conexion

### 4.1 Cargar el SDK de Facebook

Hook `useFacebookSdk.ts`:

```typescript
// 1. Se carga el script de Facebook SDK: https://connect.facebook.net/es_LA/sdk.js
// 2. Se inicializa con FB.init({ appId, cookie: true, xfbml: true, version: 'v22.0' })
// 3. El hook retorna `isReady: boolean` cuando el SDK esta listo
```

Clave: El `appId` viene de `VITE_FACEBOOK_APP_ID`.

### 4.2 Abrir el Popup de Login

Archivo: `MetaSettings.tsx`

```typescript
FB.login((response) => {
    const code = response.authResponse?.code;
    const accessToken = response.authResponse?.accessToken;
    // Enviar code o accessToken al backend
}, {
    config_id: import.meta.env.VITE_META_CONFIG_ID,
    response_type: 'code',
    override_default_response_type: true,
    // Si WhatsApp Embedded Signup esta habilitado:
    extras: {
        feature: 'whatsapp_embedded_signup',
        setup: {}
    }
});
```

**Comportamiento**:
- Se abre un popup de Meta donde el usuario selecciona las Pages, Instagram y WhatsApp que quiere conectar
- Meta retorna un `code` (authorization code) o un `accessToken` directo
- El frontend envia esto al backend via `POST /admin/meta/connect`

### 4.3 Wizard Post-Conexion

Archivo: `MetaOnboardingWizard.tsx`

Despues de conectar, se muestra un wizard con los assets descubiertos:
- **Paginas de Facebook**: lista con nombre e ID
- **Cuentas de Instagram**: username y linked page
- **WhatsApp Business Accounts**: nombre y numeros de telefono

El usuario selecciona cuales activar y se envian via `POST /admin/integrations/update-channels`.

---

## 5. Backend: Flujo de Conexion

### 5.1 Proxy en el Orchestrator

Archivo: `orchestrator_service/admin_routes.py` — endpoint `POST /admin/meta/connect`

```
Frontend → POST /admin/meta/connect (con JWT auth)
    → Resuelve tenant_id del usuario logueado
    → Proxy a meta_service POST /connect con { code, tenant_id, redirect_uri }
    → Retorna assets descubiertos al frontend
```

### 5.2 Meta Service: Exchange de Token

Archivo: `meta_service/core/auth.py` — metodo `exchange_code()`

**Estrategia de exchange** (en orden):

1. **Sin redirect_uri** (Facebook Login for Business):
   ```
   GET /oauth/access_token?client_id={APP_ID}&client_secret={APP_SECRET}&code={CODE}
   ```

2. **Con redirect_uri** (fallback standard OAuth):
   ```
   GET /oauth/access_token?client_id={APP_ID}&client_secret={APP_SECRET}&code={CODE}&redirect_uri={URI}
   ```
   Se prueban multiples URIs: env override, URL completa del frontend, origin, origin+/

3. **Upgrade a Long-Lived Token**:
   ```
   GET /oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={TOKEN}
   ```
   Tokens long-lived duran ~60 dias. SUAT (System User Access Tokens) no expiran.

### 5.3 Meta Service: Descubrimiento de Assets

Archivo: `meta_service/core/auth.py` — metodo `get_accounts()`

**Paso 1: Pages + Instagram**
```
GET /me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url},tasks
```

- Por cada Page con permisos MANAGE/MODERATE/CREATE_CONTENT:
  - Se guarda el Page Token (especifico por pagina)
  - Se auto-suscribe a webhooks (paso 5.4)
  - Si tiene `instagram_business_account`, se extrae la cuenta IG vinculada

**Paso 2: WhatsApp Business Accounts**
```
GET /me/whatsapp_business_accounts?fields=id,name,currency,timezone_id,message_template_namespace
```

- Por cada WABA:
  ```
  GET /{waba_id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating
  ```

### 5.4 Meta Service: Suscripcion a Webhooks

Archivo: `meta_service/core/auth.py` — metodo `subscribe_page()`

Se ejecuta automaticamente durante el descubrimiento de assets:

```
POST /{page_id}/subscribed_apps?access_token={PAGE_TOKEN}&subscribed_fields=messages,messaging_postbacks,message_reads,message_deliveries
```

Esto le dice a Meta: "Envia los webhooks de mensajes de esta Page a MI app".

Para Instagram: los DMs de IG se reciben a traves del webhook de la Page vinculada (no hay suscripcion separada para IG DMs).

Para WhatsApp: la suscripcion se hace a nivel de WABA en el Dashboard de Meta, o via `POST /{phone_number_id}/register`.

### 5.5 Meta Service: Sync de Credenciales al Orchestrator

Archivo: `meta_service/core/client.py` — metodo `sync_credentials()`

```
POST {ORCHESTRATOR_URL}/admin/credentials/internal-sync
Headers: { X-Internal-Secret: {INTERNAL_SECRET_KEY} }
Body: {
    "tenant_id": 123,
    "provider": "meta",
    "credentials": {
        "user_access_token": "EAAG...",
        "assets": {
            "pages": [{ "id": "111", "name": "Mi Page", "access_token": "EAAG..." }],
            "instagram": [{ "id": "222", "username": "mi_ig", "linked_page_id": "111", "access_token": "EAAG..." }],
            "whatsapp": [{ "id": "333", "name": "Mi WABA", "phone_numbers": [...], "access_token": "EAAG..." }]
        }
    }
}
```

### 5.6 Orchestrator: Almacenamiento de Credenciales

Archivo: `orchestrator_service/admin_routes.py` — endpoint `POST /admin/credentials/internal-sync`

Las credenciales se almacenan **encriptadas** en la tabla `credentials`:

| Credential Name | Valor | Para que se usa |
|----------------|-------|-----------------|
| `META_USER_LONG_TOKEN` | Token long-lived del usuario | Backup / refresh |
| `META_PAGE_TOKEN_{page_id}` | Page Access Token especifico | Enviar mensajes via esa Page |
| `meta_page_token` | Primer Page Token (generico) | Fallback para relay |
| `META_IG_TOKEN_{ig_id}` | Token para cuenta IG (= page token vinculado) | Enviar DMs IG |
| `META_WA_TOKEN_{waba_id}` | Token de WABA | Enviar mensajes WA Cloud API |

Los assets se guardan en la tabla `business_assets` (sin tokens, solo metadata):

```sql
INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active)
-- asset_type: 'facebook_page', 'instagram_account', 'whatsapp_waba'
-- content: { "id": "...", "name": "...", "status": "active", ... }
```

---

## 6. Webhooks: Recepcion de Mensajes

### 6.1 Verificacion del Webhook (Challenge)

Archivo: `meta_service/main.py` — endpoint `GET /webhook`

Meta envia un GET de verificacion al configurar el webhook:

```
GET /webhook?hub.mode=subscribe&hub.verify_token=MI_TOKEN&hub.challenge=12345
```

El servicio verifica que `hub.verify_token` coincida con `META_VERIFY_TOKEN` y retorna `hub.challenge` como int.

### 6.2 Recepcion de Eventos

Archivo: `meta_service/main.py` — endpoint `POST /webhook`

1. **Verificar firma** (`X-Hub-Signature-256`): HMAC-SHA256 del body con `META_APP_SECRET`
2. **Normalizar payload** a `SimpleEvent` estandar
3. **Reenviar** al orchestrator via `POST /ingest/message`

### 6.3 Normalizacion de Payloads

Archivo: `meta_service/core/webhooks.py`

Meta envia payloads diferentes segun la plataforma:

**Facebook Messenger** (`object: "page"`):
```json
{
    "object": "page",
    "entry": [{
        "messaging": [{
            "sender": { "id": "PSID_DEL_USUARIO" },
            "recipient": { "id": "PAGE_ID" },
            "timestamp": 1234567890,
            "message": { "mid": "m_xxx", "text": "Hola" }
        }]
    }]
}
```

**Instagram DM** (`object: "instagram"`):
```json
{
    "object": "instagram",
    "entry": [{
        "messaging": [{
            "sender": { "id": "IGSID_DEL_USUARIO" },
            "recipient": { "id": "IG_ACCOUNT_ID" },
            "timestamp": 1234567890,
            "message": { "mid": "m_xxx", "text": "Hola" }
        }]
    }]
}
```

**WhatsApp Cloud API** (`object: "whatsapp_business_account"`):
```json
{
    "object": "whatsapp_business_account",
    "entry": [{
        "changes": [{
            "value": {
                "messaging_product": "whatsapp",
                "metadata": { "display_phone_number": "5491122334455", "phone_number_id": "PH_ID" },
                "contacts": [{ "profile": { "name": "Juan" }, "wa_id": "5491155667788" }],
                "messages": [{
                    "from": "5491155667788",
                    "id": "wamid.xxx",
                    "type": "text",
                    "text": { "body": "Hola" }
                }]
            }
        }]
    }]
}
```

**SimpleEvent normalizado** (output comun para todos):
```json
{
    "provider": "meta",
    "platform": "instagram",
    "tenant_identifier": "PAGE_ID_O_IG_ID",
    "event_type": "message",
    "timestamp": 1234567890,
    "recipient_id": "PAGE_ID",
    "sender_id": "PSID_DEL_USUARIO",
    "sender_name": "User",
    "payload": {
        "id": "m_xxx",
        "type": "text",
        "text": "Hola",
        "media_url": null
    }
}
```

**Filtro de echo**: Los mensajes enviados POR la pagina (no al usuario) vienen con `message.is_echo: true`. Estos se filtran para evitar loops infinitos.

---

## 7. Orchestrator: Ingestion y AI Agent

### 7.1 Endpoint de Ingestion

Archivo: `orchestrator_service/app/routes/ingest_routes.py` — endpoint `POST /ingest/message`

**Autenticacion**: Header `X-Internal-Secret` verificado contra `INTERNAL_API_TOKEN`.

**Flujo paso a paso**:

1. **Resolver Tenant**: Busca en `business_assets` por `content->>'id' = recipient_id`
2. **Fetch Perfil del Sender**: Llama a Graph API para obtener nombre y avatar
3. **Crear/Encontrar Customer**: Busca por `instagram_psid`, `facebook_psid`, o `phone_number` en tabla `customers`
4. **Sync Conversacion**: Crea o actualiza en `chat_conversations` con `provider='meta_direct'`
5. **Persistir Mensaje**: INSERT en `chat_messages` con `role='user'`
6. **Redis Publish**: Publica en `events:tenant:{id}:assets` para actualizar UI en tiempo real
7. **Trigger AI Agent**: Buffer en Redis + lanzar `process_buffer_task`

### 7.2 Buffer y Debounce

```python
buffer_key = f"buffer:{sender_id}"
pending_key = f"pending:{sender_id}"

# Agregar mensaje al buffer
await redis_client.rpush(buffer_key, content)

# Solo disparar tarea si no hay una pendiente
if not await redis_client.get(pending_key):
    await redis_client.setex(pending_key, 5, "active")
    asyncio.create_task(process_buffer_task(...))
```

Dentro de `process_buffer_task` (archivo `main.py`):
- Espera que no haya timer activo (debounce de silencio)
- Consume todo el buffer atomicamente via Lua script
- Llama a `execute_agent_v3_logic` con el texto combinado

### 7.3 Ejecucion del Agente de IA

Archivo: `orchestrator_service/main.py` — funcion `execute_agent_v3_logic()`

1. Fetch tenant config
2. Check politica 24h (ventana de respuesta)
3. Fetch historial omnicanal (via customer_id)
4. Fetch agentes activos (`agents WHERE is_active = TRUE`)
5. Intent routing (si hay multiples agentes, LLM clasifica cual debe responder)
6. Construir system prompt con variables inyectadas
7. Llamar al Agent Service via streaming (`POST /v1/agent/execute`)
8. Procesar respuesta (split por `|||`, auto-split, UTM tracking)
9. Persistir respuesta como `chat_messages` con `role='assistant'`
10. Publicar en Redis para UI
11. Enviar via `unified_message_delivery`

---

## 8. Delivery: Envio de Respuestas

### 8.1 Unified Message Delivery

Archivo: `orchestrator_service/admin_routes.py` — funcion `unified_message_delivery()`

1. Consulta la conversacion para obtener `provider` y metadata
2. Si `provider = 'meta_direct'`: ruta a relay con `provider='meta_direct'`
3. Envia al relay service via `POST /messages/relay`

### 8.2 Relay Service

Archivo: `whatsapp_service/main.py` — endpoint `POST /messages/relay`

Para `provider='meta_direct'`:

**Instagram / Facebook**:
```
POST https://graph.facebook.com/v22.0/me/messages
Params: { access_token: PAGE_TOKEN }
Body: {
    "recipient": { "id": "PSID_DEL_USUARIO" },
    "message": { "text": "Respuesta del agente" },
    "messaging_type": "RESPONSE"
}
```

El Page Token se obtiene via `GET /admin/internal/credentials/meta_page_token?tenant_id={ID}` al orchestrator, que lo desencripta de la tabla `credentials`.

**WhatsApp Cloud API**:
```
POST https://graph.facebook.com/v22.0/{phone_number_id}/messages
Headers: { Authorization: Bearer {WA_TOKEN} }
Body: {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "5491155667788",
    "type": "text",
    "text": { "body": "Respuesta del agente" }
}
```

---

## 9. Base de Datos: Esquema Requerido

### Tablas necesarias:

```sql
-- Almacena tokens encriptados
CREATE TABLE credentials (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    name TEXT NOT NULL,
    value TEXT NOT NULL,          -- Valor encriptado
    category TEXT,                -- 'meta', 'openai', etc.
    scope TEXT DEFAULT 'tenant',  -- 'tenant' o 'global'
    credential_type_id INTEGER,
    is_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catalogo de tipos de credenciales (para lookup robusto)
CREATE TABLE credential_types (
    id SERIAL PRIMARY KEY,
    internal_key TEXT UNIQUE NOT NULL,  -- 'META_PAGE_ACCESS_TOKEN', 'OPENAI_API_KEY'
    display_name TEXT,
    category TEXT
);

-- Assets descubiertos (pages, IG accounts, WABAs)
CREATE TABLE business_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    asset_type TEXT NOT NULL,      -- 'facebook_page', 'instagram_account', 'whatsapp_waba'
    content JSONB NOT NULL,        -- { id, name, username, phone_numbers, status }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversaciones omnicanal
CREATE TABLE chat_conversations (
    id TEXT PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    channel TEXT,                  -- 'instagram', 'facebook', 'whatsapp'
    channel_source TEXT,           -- Mismo que channel para Meta Direct
    external_user_id TEXT,         -- PSID del usuario
    customer_id UUID,              -- Referencia a customers
    status TEXT DEFAULT 'open',
    provider TEXT,                 -- 'meta_direct', 'chatwoot', 'ycloud'
    platform_origin TEXT,          -- 'instagram', 'facebook', 'whatsapp'
    source_identifier TEXT,        -- Nombre del asset (ej: nombre de la Page)
    source_entity_id TEXT,         -- ID del asset (Page ID, IG ID)
    display_name TEXT,             -- Nombre del contacto
    avatar_url TEXT,
    meta JSONB,
    human_override_until TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensajes
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    tenant_id INTEGER,
    conversation_id TEXT REFERENCES chat_conversations(id),
    role TEXT,                     -- 'user', 'assistant', 'system', 'human_supervisor'
    content TEXT,
    from_number TEXT,              -- Sender identifier
    channel_source TEXT,           -- 'instagram', 'facebook', 'whatsapp'
    correlation_id TEXT,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes (identidad unificada)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id INTEGER REFERENCES tenants(id),
    phone_number TEXT,
    instagram_psid TEXT,
    facebook_psid TEXT,
    name TEXT,
    email TEXT,
    circle TEXT DEFAULT 'unknown',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 10. Microservicios y Docker

### 10.1 Estructura de servicios

```
meta_service/           # "The Meta Diplomat" — Conexion + Webhooks
├── main.py             # FastAPI app, endpoints /connect, /webhook, /subscribe, /messages/send
├── core/
│   ├── auth.py         # OAuth exchange, asset discovery, page subscription
│   ├── webhooks.py     # Normalizacion de payloads de Meta
│   └── client.py       # HTTP client para comunicarse con el orchestrator
└── requirements.txt    # fastapi, httpx, structlog, pydantic

orchestrator_service/   # Cerebro central
├── main.py             # process_buffer_task, execute_agent_v3_logic
├── admin_routes.py     # /credentials/internal-sync, /meta/connect, unified_message_delivery
└── app/routes/
    └── ingest_routes.py  # POST /ingest/message

whatsapp_service/       # Relay de delivery universal
└── main.py             # POST /messages/relay (meta_direct, chatwoot, ycloud)
```

### 10.2 Docker Compose (ejemplo)

```yaml
meta_service:
  build: ./meta_service
  ports:
    - "8004:8000"
  environment:
    - PORT=8000
    - META_APP_ID=${META_APP_ID}           # IMPORTANTE: necesario para code exchange
    - META_APP_SECRET=${META_APP_SECRET}
    - META_VERIFY_TOKEN=${META_VERIFY_TOKEN}
    - META_GRAPH_API_VERSION=v22.0
    - ORCHESTRATOR_URL=http://orchestrator_service:8000
    - INTERNAL_SECRET_KEY=${INTERNAL_API_TOKEN}
    - FRONTEND_URL=${FRONTEND_URL}
  depends_on:
    - orchestrator_service
```

### 10.3 Webhook URL Publica

El `meta_service` debe estar expuesto a internet con HTTPS para que Meta pueda enviar webhooks:

```
https://<tu-meta-service-publico>/webhook
```

En EasyPanel u otro hosting, se configura un reverse proxy con SSL hacia el puerto 8000 del contenedor.

---

## 11. Troubleshooting

### El popup de Meta no se abre
- Verificar que `VITE_FACEBOOK_APP_ID` y `VITE_META_CONFIG_ID` estan seteados
- Verificar que el SDK de Facebook no esta bloqueado (ad blockers, VPN)
- Revisar la consola del navegador para errores de `FB.login`

### El code exchange falla
- Verificar que `META_APP_ID` y `META_APP_SECRET` estan en el meta_service
- Verificar que el code no ha expirado (duran ~10 minutos)
- Revisar logs del meta_service para ver cual estrategia de redirect_uri fallo

### Los webhooks no llegan
- Verificar que la URL del webhook es accesible publicamente con HTTPS
- Verificar que `META_VERIFY_TOKEN` coincide entre Meta Dashboard y la env var
- En Meta Dashboard > Webhooks, usar "Test" para enviar un payload de prueba
- Verificar que la app tiene los subscribed_fields correctos

### Los mensajes llegan pero el agente no responde
- **Causa mas comun**: Error silencioso en `execute_agent_v3_logic` por incompatibilidad de timezone en el check de 24h. Solucion: usar `datetime.now(timezone.utc)` en vez de `datetime.utcnow()`
- Verificar que existe al menos un agente activo (`agents WHERE tenant_id = X AND is_active = TRUE`)
- Verificar que el Agent Service (`AGENT_SERVICE_URL`) esta operativo
- Revisar logs del orchestrator: buscar `agent_execution_v3_logic_failed` o `agent_trigger_failed`

### El agente responde pero no llega al usuario
- Verificar que `meta_page_token` existe en credentials para ese tenant
- Verificar que el relay service esta operativo (`WHATSAPP_SERVICE_URL`)
- Revisar logs del relay: buscar `RELAY: Missing Meta Page Token`
- Para Instagram: el Page Token de la Page VINCULADA al IG debe tener permisos

### Loops infinitos de mensajes
- Verificar que el filtro de echo esta implementado (check `message.is_echo` en webhooks.py)
- Sin este filtro, cada respuesta del bot genera un nuevo webhook que vuelve a disparar al agente
