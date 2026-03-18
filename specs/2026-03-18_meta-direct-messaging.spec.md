# SPEC: Meta Direct Messaging — Recibir y mostrar mensajes de Instagram, Facebook y WhatsApp conectados via Embedded Signup

## Fecha: 2026-03-18
## Prioridad: P0 — Critica (canales conectados pero mensajes no llegan a la UI)

---

## PROBLEMA

Los canales de Instagram y Facebook se conectan correctamente via Meta Embedded Signup (popup), los webhooks se subscriben exitosamente, pero:

1. Los mensajes recibidos en Instagram/Facebook **no aparecen en la pagina de Chats**
2. La pagina de Chats actualmente solo muestra mensajes de **Chatwoot** y **YCloud**
3. No hay filtro por fuente/provider en la UI de Chats
4. Los webhooks de Meta llegan al `meta_service` pero puede que no se reenvien correctamente al orchestrator

---

## OBJETIVO

Que los mensajes de Instagram, Facebook y WhatsApp conectados via Meta Embedded Signup:
- Lleguen al backend via webhook
- Se persistan en `chat_conversations` y `chat_messages`
- Se muestren en la pagina de Chats junto con los de Chatwoot y YCloud
- Se puedan filtrar por provider (Chatwoot, Meta Direct, YCloud)
- El agente de IA pueda responder via la Graph API de Meta
- Las respuestas se envien correctamente por el canal de origen

---

## FLUJO END-TO-END

```
Usuario envia DM en Instagram/Messenger/WhatsApp
    ↓
Meta Webhook → meta_service POST /webhook
    ↓
meta_service normaliza el payload (SimpleEvent)
    ↓
meta_service reenvia a orchestrator POST /ingest/message
    ↓
orchestrator resuelve tenant (via page_id/phone_number)
    ↓
orchestrator persiste en chat_conversations + chat_messages
    ↓
orchestrator ejecuta el agente de IA
    ↓
agente genera respuesta
    ↓
orchestrator envia respuesta via meta_service POST /messages/send o /whatsapp/send
    ↓
Frontend de Chats muestra la conversacion completa
```

---

## SCOPE

### Backend (orchestrator_service)
1. Verificar endpoint `POST /ingest/message` — que funcione con eventos de Meta
2. Verificar resolucion de tenant por `page_id` / `phone_number` / `ig_id`
3. Verificar persistencia en `chat_conversations` y `chat_messages`
4. Verificar que el agente se ejecute y responda
5. Verificar que la respuesta se envie via Meta Graph API
6. Agregar campo `channel_source` para diferenciar Chatwoot vs Meta Direct vs YCloud

### Backend (meta_service)
1. Verificar que webhooks se reciban correctamente
2. Verificar que el forwarding a orchestrator funcione
3. Verificar que la URL del orchestrator sea correcta

### Frontend (Chats page)
1. Agregar filtro por provider/source: "Todos", "Meta Direct", "Chatwoot", "YCloud"
2. Mostrar indicador visual de canal (icono FB/IG/WA) en cada conversacion
3. Mostrar conversaciones de Meta Direct en la misma lista que las demas

### Webhook Setup (Meta Dashboard)
1. Verificar callback URL: `https://multiagents-meta.yn8wow.easypanel.host/webhook`
2. Verificar verify token
3. Verificar subscribed fields: `messages`, `messaging_postbacks`, `message_reads`, `message_deliveries`

---

## COEXISTENCIA DE PROVIDERS

| Provider | WhatsApp | Instagram | Facebook | Fuente |
|----------|:--------:|:---------:|:--------:|--------|
| Chatwoot | Si | Si | Si | Webhook de Chatwoot |
| YCloud | Si | No | No | Webhook de YCloud |
| Meta Direct | Si* | Si | Si | Webhook de Meta Graph API |

*WhatsApp via Meta Direct requiere WABA conectado (no detectado en la prueba actual)

Todos coexisten. Un tenant puede tener los 3 providers activos simultaneamente.
La pagina de Chats debe mostrar TODOS los mensajes, con filtro por provider.

---

## ARCHIVOS INVOLUCRADOS

### A verificar/modificar:
- `meta_service/main.py` — webhook reception + forwarding
- `meta_service/core/webhooks.py` — payload normalization
- `meta_service/core/client.py` — orchestrator URL + headers
- `orchestrator_service/app/routes/ingest_routes.py` — message ingestion
- `orchestrator_service/admin_routes.py` — tenant resolution by asset
- `orchestrator_service/app/core/engine.py` — agent execution + response sending
- `frontend_react/src/views/Chats.tsx` — UI + filtros

### A leer para contexto:
- `orchestrator_service/app/models/chat.py` — ChatConversation, ChatMessage models
- `whatsapp_service/main.py` — como funciona el flujo actual de YCloud
- `orchestrator_service/main.py` — webhook handlers existentes

---

## CRITERIOS DE ACEPTACION

1. [ ] Enviar DM a Instagram conectado → aparece en Chats en <5 segundos
2. [ ] Enviar mensaje a Facebook Messenger → aparece en Chats en <5 segundos
3. [ ] El agente de IA responde automaticamente al mensaje
4. [ ] La respuesta aparece en el chat del usuario (Instagram/Facebook)
5. [ ] Filtro por provider funciona en la UI
6. [ ] Icono de canal visible en cada conversacion
7. [ ] Mensajes de Chatwoot y YCloud siguen funcionando sin interferencia
8. [ ] WhatsApp via Meta Cloud API funciona si WABA esta conectado
