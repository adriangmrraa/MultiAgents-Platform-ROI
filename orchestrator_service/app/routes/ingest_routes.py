import os
import uuid
import json
import asyncio
import structlog
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from db import db, redis_client
from app.core.config import settings

logger = structlog.get_logger()

router = APIRouter(prefix="/ingest", tags=["ingetion"])

class SimpleEvent(BaseModel):
    provider: str # 'meta'
    platform: str # 'facebook', 'instagram', 'whatsapp'
    tenant_id: Optional[str] = None
    tenant_identifier: Optional[str] = None # Page ID / Phone ID (from meta_service)
    recipient_id: str # Page ID, IG ID, WABA Phone ID
    sender_id: str # User PSID
    event_type: str = "message"
    timestamp: Optional[int] = None
    payload: Dict[str, Any] # {text, image, mid}
    sender_name: Optional[str] = None # Optional name from profile

async def verify_internal_secret(x_internal_secret: str = Header(None)):
    """
    Validates that the request comes from a trusted microservice.
    """
    trusted_secret = settings.INTERNAL_API_TOKEN.get_secret_value()

    if x_internal_secret != trusted_secret:
         logger.warning("ingest_unauthorized", provided=x_internal_secret[:4] if x_internal_secret else "None")
         raise HTTPException(status_code=403, detail="Unauthorized Internal Access")

@router.post("/message", dependencies=[Depends(verify_internal_secret)])
async def ingest_message(event: SimpleEvent):
    """
    Ingests a normalized message event from The Meta Diplomat.
    1. Resolves Tenant.
    2. Syncs Conversation/Message to DB.
    3. Publishes to Redis for UI.
    4. Triggers AI Agent via buffer.
    """
    logger.info("ingest_received", provider=event.provider, platform=event.platform, recipient=event.recipient_id)

    # 1. Resolve Tenant
    tenant_id = None

    # Strategy A: Provided in Payload (Client resolved it)
    if event.tenant_id:
        tenant_id = int(event.tenant_id) if str(event.tenant_id).isdigit() else None

    # Strategy B: Resolve via Recipient ID (Page/Phone ID)
    if not tenant_id:
        # Let's search by Bot Phone Number first (WhatsApp)
        if event.platform == "whatsapp":
             formatted_id = event.recipient_id.replace("+", "")
             row = await db.pool.fetchrow("SELECT id FROM tenants WHERE bot_phone_number = $1", formatted_id)
             if row: tenant_id = row['id']

        # For Facebook/Instagram, look up in business_assets via content JSONB
        if not tenant_id:
             asset_row = await db.pool.fetchrow(
                 "SELECT tenant_id FROM business_assets WHERE content->>'id' = $1 LIMIT 1",
                 event.recipient_id
             )
             if asset_row:
                 t_val = asset_row['tenant_id']
                 tenant_id = int(t_val) if str(t_val).isdigit() else 1

    if not tenant_id:
        logger.warning("ingest_tenant_unresolved", recipient=event.recipient_id)
        tenant_id = 1

    # 2. Resolve Source Identifier (Asset Name from content JSONB)
    source_identifier = event.recipient_id
    asset_info = await db.pool.fetchrow(
        "SELECT content->>'name' as name FROM business_assets WHERE content->>'id' = $1 AND tenant_id = $2",
        event.recipient_id, str(tenant_id)
    )
    if asset_info and asset_info['name']:
        source_identifier = asset_info['name']

    # 3. Protocol Omega: Identity Link (Find or Create Customer)
    customer_id = None
    if event.platform == 'instagram':
        customer_id = await db.pool.fetchval("SELECT id FROM customers WHERE tenant_id = $1 AND instagram_psid = $2", tenant_id, event.sender_id)
        if not customer_id:
            customer_id = await db.pool.fetchval("INSERT INTO customers (id, tenant_id, instagram_psid, name) VALUES ($1, $2, $3, $4) RETURNING id", uuid.uuid4(), tenant_id, event.sender_id, event.sender_name)
    elif event.platform == 'facebook':
        customer_id = await db.pool.fetchval("SELECT id FROM customers WHERE tenant_id = $1 AND facebook_psid = $2", tenant_id, event.sender_id)
        if not customer_id:
            customer_id = await db.pool.fetchval("INSERT INTO customers (id, tenant_id, facebook_psid, name) VALUES ($1, $2, $3, $4) RETURNING id", uuid.uuid4(), tenant_id, event.sender_id, event.sender_name)
    else:
        # Default WhatsApp (Phone)
        customer_id = await db.pool.fetchval("SELECT id FROM customers WHERE tenant_id = $1 AND phone_number = $2", tenant_id, event.sender_id)
        if not customer_id:
            customer_id = await db.pool.fetchval("INSERT INTO customers (id, tenant_id, phone_number, name) VALUES ($1, $2, $3, $4) RETURNING id", uuid.uuid4(), tenant_id, event.sender_id, event.sender_name)

    # 4. Sync Conversation
    conv_query = """
        SELECT id, human_override_until FROM chat_conversations
        WHERE tenant_id = $1 AND (
            (channel = $2 AND external_user_id = $3) OR
            (customer_id = $4 AND customer_id IS NOT NULL)
        )
        LIMIT 1
    """
    conv_row = await db.pool.fetchrow(conv_query, tenant_id, event.platform, event.sender_id, customer_id)

    is_locked = False
    if conv_row:
        conversation_id = str(conv_row['id'])
        lockout = conv_row['human_override_until']
        if lockout:
            now = datetime.now(lockout.tzinfo) if lockout.tzinfo else datetime.now()
            if lockout > now:
                is_locked = True
        # Update metadata
        await db.pool.execute("""
            UPDATE chat_conversations
            SET platform_origin = $1, source_identifier = $2, source_entity_id = $3,
                customer_id = $4, updated_at = NOW(), last_message_at = NOW(),
                last_message_preview = $6, provider = 'meta_direct'
            WHERE id = $5
        """, event.platform, source_identifier, event.recipient_id, customer_id, conversation_id,
             (event.payload.get("text") or "[Media]")[:50])
    else:
        conversation_id = str(uuid.uuid4())
        await db.pool.execute("""
            INSERT INTO chat_conversations (
                id, tenant_id, channel, external_user_id, customer_id, status, provider,
                platform_origin, source_identifier, source_entity_id,
                display_name, last_message_at, last_message_preview,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'open', 'meta_direct', $6, $7, $8, $9, NOW(), $10, NOW(), NOW())
        """, conversation_id, tenant_id, event.platform, event.sender_id, customer_id,
             event.platform, source_identifier, event.recipient_id,
             event.sender_name or event.sender_id,
             (event.payload.get("text") or "[Media]")[:50])

    # 5. Persist Message
    msg_id = str(uuid.uuid4())
    content = event.payload.get("text") or "[Media Message]"

    media_url = event.payload.get("media_url")
    if media_url:
        content += f" {media_url}"

    await db.pool.execute("""
        INSERT INTO chat_messages (id, tenant_id, conversation_id, role, content, created_at, from_number, channel_source)
        VALUES ($1, $2, $3, 'user', $4, NOW(), $5, $6)
    """, msg_id, tenant_id, conversation_id, content, event.sender_id, event.platform)

    # 6. Update conversation last message
    await db.pool.execute("""
        UPDATE chat_conversations SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW()
        WHERE id = $2
    """, content[:50], conversation_id)

    # 7. Redis Publish (UI Realtime)
    redis_payload = {
        "event": "message",
        "data": {
            "id": msg_id,
            "conversation_id": str(conversation_id),
            "role": "user",
            "content": content,
            "from_number": event.sender_id,
            "platform": event.platform,
            "created_at": datetime.now().isoformat()
        }
    }

    redis_channel = f"events:tenant:{tenant_id}:assets"
    try:
        await redis_client.publish(redis_channel, json.dumps(redis_payload))
    except Exception as e:
        logger.error(f"Redis Publish Fail: {e}")

    # 8. Trigger AI Agent (if not locked by human override)
    if not is_locked and content and content != "[Media Message]":
        try:
            buffer_key = f"buffer:{event.sender_id}"
            await redis_client.rpush(buffer_key, content)
            await redis_client.expire(buffer_key, 60)

            pending_key = f"pending:{event.sender_id}"
            if not await redis_client.get(pending_key):
                await redis_client.setex(pending_key, 5, "active")
                # Import and trigger the buffer processor from main module
                from main import process_buffer_task
                correlation_id = str(uuid.uuid4())
                asyncio.create_task(
                    process_buffer_task(
                        event.sender_id, tenant_id, conversation_id,
                        correlation_id, event.sender_name or "User", event.platform
                    )
                )
                logger.info("agent_triggered", conversation_id=str(conversation_id), platform=event.platform)
            else:
                logger.info("agent_buffered", sender=event.sender_id)
        except Exception as e:
            logger.error("agent_trigger_failed", error=str(e))

    return {"status": "ok", "id": msg_id}
