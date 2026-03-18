# Future Platform — Troubleshooting

## Meta Webhooks

### Webhook verification fails
- Verify the URL is correct: `https://<meta-service-host>/webhook`
- Check `META_VERIFY_TOKEN` env var matches what you entered in Meta Dashboard
- Test: `curl "https://<host>/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123"`

### Messages not arriving
- Check Meta Dashboard → each product (Messenger, Instagram, WhatsApp) has webhooks configured
- Verify `messages` field is subscribed
- Check meta_service logs for `POST /webhook` entries
- If 403 on `/ingest/message`: `INTERNAL_SECRET_KEY` in meta_service must match `INTERNAL_API_TOKEN` or `INTERNAL_SECRET_KEY` in orchestrator

### Sender name shows as PSID number
- Facebook: requires conversations endpoint (v13+ restriction). Check logs for `meta_profile_raw_response`
- Instagram: `GET /{sender_id}?fields=name,username,profile_pic` — needs valid page token
- Ensure `meta_page_token` credential exists in DB

### WhatsApp not detected during connection
- Your Meta account needs a WABA (WhatsApp Business Account) linked
- The `whatsapp_business_management` permission must be granted in the popup

## Agent Not Responding

### Buffer dedup guard blocks processing
- Log: `BUFFER: Duplicate detected (Loop Guard)`
- The guard now checks if an assistant reply exists. If the agent already replied, it's expected behavior
- If it shouldn't skip: verify `reply_count` in the dedup query

### `name 'timezone' is not defined`
- Missing import: `from datetime import datetime, timedelta, timezone`

### Agent triggered but no response
- Check `execute_agent_v3_logic` logs
- Verify tenant has a valid `OPENAI_API_KEY` credential
- Check agent is configured and enabled for the channel

## Database

### Column does not exist
- The orchestrator runs idempotent migrations on startup
- If a column is missing, restart the orchestrator service
- All migrations use `ADD COLUMN IF NOT EXISTS`

### `business_assets.asset_id` not found
- This column doesn't exist. Use `content->>'id'` to query by external Meta ID
- Example: `SELECT tenant_id FROM business_assets WHERE content->>'id' = $1`

## Service Connectivity

### DNS resolution failures between services
- EasyPanel uses dash hostnames (`orchestrator-service`) not underscores
- Services have automatic fallback: try underscore first, then dash
- Set `ORCHESTRATOR_URL`, `WHATSAPP_SERVICE_URL` explicitly if needed

### 404 on /ingest/message
- The ingest router must be mounted: `app.include_router(ingest_router)` in orchestrator main.py

### 403 on inter-service calls
- Verify `INTERNAL_SECRET_KEY` and `INTERNAL_API_TOKEN` match across services
- The ingest route accepts both for compatibility

## Frontend

### Chats page empty
- Check browser console for API errors
- Verify the user's tenant has conversations in DB
- Try the "Refresh" button or change the channel/provider filter

### Meta popup doesn't open
- Check `VITE_FACEBOOK_APP_ID` and `VITE_META_CONFIG_ID` are set
- Facebook SDK requires HTTPS in production
- Check browser console for FB SDK errors
