# Future Platform — Omnichannel Chats

## Overview

The Chats page is the unified inbox for all customer conversations across WhatsApp, Instagram, Facebook Messenger, and Web — regardless of which provider handles the connection (Meta Direct, Chatwoot, or YCloud).

## Providers

| Provider | How it works |
|----------|-------------|
| **Meta Direct** | Webhooks from Meta Graph API → `meta_service` → `orchestrator /ingest/message` |
| **Chatwoot** | Webhooks from Chatwoot → `whatsapp_service` → `orchestrator POST /chat` |
| **YCloud** | Webhooks from YCloud → `whatsapp_service` → `orchestrator POST /chat` |

All providers feed into the same `chat_conversations` + `chat_messages` tables.

## Filtering

The Chats UI supports two independent filters:

- **Channel filter:** WhatsApp, Instagram, Facebook, Intervention (human override)
- **Provider filter:** Meta Direct, Chatwoot, YCloud, All

Backend: `GET /admin/chats/summary?channel=instagram&provider=meta_direct`

## Conversation Data Model

```sql
chat_conversations:
  id                  UUID PRIMARY KEY
  tenant_id           INTEGER
  customer_id         UUID (FK customers)
  channel             VARCHAR(32)     -- 'whatsapp', 'instagram', 'facebook'
  provider            VARCHAR(32)     -- 'meta_direct', 'chatwoot', 'ycloud'
  platform_origin     VARCHAR(32)     -- original platform
  source_identifier   VARCHAR(255)    -- asset name (e.g., "Mi Pagina FB")
  source_entity_id    VARCHAR(128)    -- Page ID / Phone ID
  external_user_id    VARCHAR(128)    -- User PSID or phone
  display_name        VARCHAR(255)    -- Resolved sender name
  avatar_url          TEXT            -- Sender profile picture
  status              VARCHAR(32)     -- 'open', 'closed', 'human_override'
  human_override_until TIMESTAMPTZ    -- Locks AI responses
  last_message_at     TIMESTAMPTZ
  last_message_preview TEXT
  meta                JSONB           -- { sender_name, sender_avatar, username, inbox_name }
```

## UI Features

- **Provider badge:** META / CHATWOOT badge on each conversation
- **Channel icon:** WhatsApp (green), Instagram (pink), Facebook (blue), Chatwoot (cyan)
- **Avatar:** Profile picture from Meta Graph API (Instagram + Facebook)
- **Sender name:** Resolved from Graph API (not raw PSID)
- **Source identifier:** Shows which page/account received the message
- **Human Override toggle:** Locks conversation from AI, allows manual replies
- **24h session window:** For WhatsApp, shows template selector after 24h inactivity
- **Polling:** Chat list refreshes every 10s, messages every 3s

## Message Sending

Manual messages from the Chats UI go through:
```
Frontend POST /admin/whatsapp/send
    → Resolve conversation + provider
    → unified_message_delivery (background task)
    → whatsapp_service /messages/relay
    → Deliver via correct provider API
```

## Human Override

When enabled:
- AI agent stops responding to that conversation
- Human supervisor can send manual messages
- Locked until manually unlocked or timeout (set to 2099 = indefinite)
- Visual indicator: amber "HUMAN OVERRIDE" badge

## Identity Link (Protocol Omega)

Each sender is linked to a `customers` record:
- Instagram: matched by `instagram_psid`
- Facebook: matched by `facebook_psid`
- WhatsApp: matched by `phone_number`

This allows cross-channel identity: the same person messaging on Instagram and WhatsApp can be linked to the same customer record.
