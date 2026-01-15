import os
import uuid
import json
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
    # Compare with Env Var (INTERNAL_SECRET_KEY or INTERNAL_API_TOKEN)
    trusted_secret = settings.INTERNAL_API_TOKEN.get_secret_value()
    # Check alternate just in case
    # trusted_secret_alt = os.getenv("INTERNAL_SECRET_KEY")
    
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
             
        # For Facebook/Instagram, look up in business_assets
        if not tenant_id:
             asset_row = await db.pool.fetchrow("SELECT tenant_id FROM business_assets WHERE asset_id = $1 LIMIT 1", event.recipient_id)
             if asset_row: 
                 t_val = asset_row['tenant_id']
                 tenant_id = int(t_val) if str(t_val).isdigit() else 1 # Default fallback if uuid? usually int here

    if not tenant_id:
        logger.warning("ingest_tenant_unresolved", recipient=event.recipient_id)
        tenant_id = 1 

    # 2. Resolve Source Identifier (Asset Name)
    source_identifier = event.recipient_id
    asset_info = await db.pool.fetchrow("SELECT name FROM business_assets WHERE asset_id = $1 AND tenant_id = $2", event.recipient_id, str(tenant_id))
    if asset_info:
        source_identifier = asset_info['name']

    # 3. Sync Conversation
    conv_query = """
        SELECT id FROM chat_conversations 
        WHERE tenant_id = $1 AND channel = $2 AND external_user_id = $3
        LIMIT 1
    """
    conv_row = await db.pool.fetchrow(conv_query, tenant_id, event.platform, event.sender_id)
    
    if conv_row:
        conversation_id = conv_row['id']
        # Update metadata
        await db.pool.execute("""
            UPDATE chat_conversations 
            SET platform_origin = $1, source_identifier = $2, source_entity_id = $3, updated_at = NOW()
            WHERE id = $4
        """, event.platform, source_identifier, event.recipient_id, conversation_id)
    else:
        conversation_id = str(uuid.uuid4())
        await db.pool.execute("""
            INSERT INTO chat_conversations (
                id, tenant_id, channel, external_user_id, status, provider, 
                platform_origin, source_identifier, source_entity_id, 
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, 'open', 'meta_direct', $5, $6, $7, NOW(), NOW())
        """, conversation_id, tenant_id, event.platform, event.sender_id, event.platform, source_identifier, event.recipient_id)
        
    # 4. Persist Message
    msg_id = str(uuid.uuid4())
    content = event.payload.get("text") or "[Media Message]"
    
    media_url = event.payload.get("media_url")
    if media_url:
        content += f" {media_url}"
        
    await db.pool.execute("""
        INSERT INTO chat_messages (id, tenant_id, conversation_id, role, content, created_at, from_number, channel_source)
        VALUES ($1, $2, $3, 'user', $4, NOW(), $5, $6)
    """, msg_id, tenant_id, conversation_id, content, event.sender_id, event.platform)
    
    # 4. Redis Publish (UI Realtime)
    redis_payload = {
        "event": "message",
        "data": {
            "id": msg_id,
            "conversation_id": conversation_id,
            "role": "user",
            "content": content,
            "from_number": event.sender_id,
            "platform": event.platform,
            "created_at": datetime.now().isoformat()
        }
    }
    
    channel = f"events:tenant:{tenant_id}:assets"
    try:
        await redis_client.publish(channel, json.dumps(redis_payload))
    except Exception as e:
        logger.error(f"Redis Publish Fail: {e}")

    return {"status": "ok", "id": msg_id}
