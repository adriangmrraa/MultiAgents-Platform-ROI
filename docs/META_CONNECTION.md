# Future Platform — Meta Connection

## Overview

Future connects to Instagram, Facebook Messenger, and WhatsApp Business via **Meta Embedded Signup** (popup flow). Once connected, messages arrive in real-time via webhooks and the AI agent responds automatically.

## Supported Channels

| Channel | Connection Method | Message Reception | AI Response |
|---------|------------------|-------------------|-------------|
| Instagram DM | Meta Embedded Signup | Webhook (`object: "instagram"`) | Graph API via page token |
| Facebook Messenger | Meta Embedded Signup | Webhook (`object: "page"`) | Graph API via page token |
| WhatsApp Business | Meta Embedded Signup | Webhook (`object: "whatsapp_business_account"`) | Cloud API via WABA token |

## Connection Flow

```
1. User clicks "Connect Meta" in Future UI
        |
2. Facebook Login for Business popup opens (FB SDK)
        |
3. User grants permissions → Authorization Code returned
        |
4. Frontend sends code to meta_service POST /connect
        |
5. meta_service exchanges code → long-lived token
        |
6. meta_service discovers assets (Pages, IG accounts, WABAs)
        |
7. meta_service syncs credentials to orchestrator POST /admin/credentials/internal-sync
        |
8. Credentials stored encrypted (AES-256) per tenant
        |
9. Frontend shows wizard to select which assets to activate
        |
10. For each selected asset → POST /subscribe → webhooks registered
```

## Webhook Setup (Meta Developer Dashboard)

Configure webhooks for each product in your Meta App:

| Product | Webhook URL | Verify Token | Fields |
|---------|------------|--------------|--------|
| Messenger | `https://<meta-service-host>/webhook` | `META_VERIFY_TOKEN` env var | `messages` |
| Instagram | same URL | same token | `messages` |
| WhatsApp | same URL | same token | `messages` |

The `GET /webhook` endpoint handles Meta's verification challenge. The `POST /webhook` endpoint receives events, verifies the HMAC signature, normalizes the payload, and forwards to the orchestrator.

## Webhook Processing Flow

```
Meta sends POST /webhook to meta_service
    |
    v
1. Verify X-Hub-Signature-256 (HMAC-SHA256 with APP_SECRET)
2. Normalize payload → SimpleEvent:
   - provider: "meta"
   - platform: "facebook" | "instagram" | "whatsapp"
   - recipient_id: Page ID / IG ID / Phone Number
   - sender_id: User PSID
   - payload: { text, media_url }
3. Forward to orchestrator POST /ingest/message
```

## Tenant Resolution

When a webhook arrives, the orchestrator resolves the tenant:

1. **WhatsApp:** Match `recipient_id` against `tenants.bot_phone_number`
2. **Facebook/Instagram:** Match `recipient_id` against `business_assets.content->>'id'`
3. **Fallback:** tenant_id = 1

## Sender Profile Resolution

The orchestrator fetches the sender's name and avatar from Meta Graph API:

- **Instagram:** `GET /{sender_id}?fields=name,username,profile_pic`
- **Facebook:** `GET /{page_id}/conversations?fields=participants&user_id={sender_id}` (name) + `GET /{sender_id}/picture?type=large&redirect=false` (avatar)
- **WhatsApp:** Name comes directly in the webhook payload (`contacts[].profile.name`)

## Credential Storage

During connection, these credentials are stored encrypted:

| Credential Name | Purpose |
|----------------|---------|
| `META_USER_LONG_TOKEN` | Long-lived user access token |
| `META_PAGE_TOKEN_{page_id}` | Per-page access token (for Graph API calls) |
| `meta_page_token` | General page token (relay service lookup) |
| `META_IG_TOKEN_{ig_id}` | Instagram token (if separate) |
| `META_WA_TOKEN_{waba_id}` | WhatsApp Business token |

## Response Delivery

When the AI agent generates a response:

```
orchestrator → unified_message_delivery (resolves provider='meta_direct')
    |
    v
whatsapp_service /messages/relay
    |
    v
provider == 'meta_direct'?
    |
    ├── channel == 'instagram' or 'facebook':
    |   GET meta_page_token credential → decrypt
    |   POST graph.facebook.com/me/messages (page token)
    |
    └── channel == 'whatsapp':
        GET WHATSAPP_ACCESS_TOKEN credential → decrypt
        POST graph.facebook.com/{phone_id}/messages (Cloud API)
```

## Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `META_APP_ID` | meta_service | — | Facebook App ID |
| `META_APP_SECRET` | meta_service | — | Facebook App Secret (HMAC verification) |
| `META_VERIFY_TOKEN` | meta_service | `nexus_verification_token` | Webhook verification token |
| `META_GRAPH_API_VERSION` | meta_service | `v22.0` | Graph API version |
| `ORCHESTRATOR_URL` | meta_service | `http://orchestrator_service:8000` | Orchestrator internal URL |
| `INTERNAL_SECRET_KEY` | meta_service | `internal-secret` | Inter-service auth |
| `VITE_FACEBOOK_APP_ID` | frontend | — | FB SDK App ID |
| `VITE_META_CONFIG_ID` | frontend | — | Meta Business Config ID |

## Coexistence with Other Providers

Meta Direct coexists with Chatwoot and YCloud. A tenant can have all 3 active simultaneously:

| Provider | WhatsApp | Instagram | Facebook | Source |
|----------|:--------:|:---------:|:--------:|--------|
| Chatwoot | Yes | Yes | Yes | Chatwoot webhook |
| YCloud | Yes | No | No | YCloud webhook |
| Meta Direct | Yes* | Yes | Yes | Meta Graph API webhook |

*WhatsApp via Meta Direct requires WABA connected.

The Chats page shows all messages from all providers, with a **provider filter** dropdown (Meta Direct / Chatwoot / YCloud) and **channel filter** (WhatsApp / Instagram / Facebook).

Each conversation stores:
- `provider`: `'meta_direct'`, `'chatwoot'`, or `'ycloud'`
- `channel`: `'whatsapp'`, `'instagram'`, or `'facebook'`
- `platform_origin`: original platform
- `source_identifier`: asset name (e.g., page name)
