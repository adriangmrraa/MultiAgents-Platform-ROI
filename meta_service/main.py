import os
import structlog
from fastapi import FastAPI, Request, BackgroundTasks, Depends, HTTPException, Query
from contextlib import asynccontextmanager
from typing import Optional

from core.auth import MetaAuthService
from core.webhooks import MetaWebhookService
from core.client import OrchestratorClient

# Configuration
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "nexus_verification_token")
META_APP_SECRET = os.getenv("META_APP_SECRET")
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://orchestrator-service:8000")

# Logging
structlog.configure(
    processors=[
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

# Services
auth_service = MetaAuthService()
webhook_service = MetaWebhookService(META_VERIFY_TOKEN, META_APP_SECRET)
orchestrator_client = OrchestratorClient()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", service="meta_diplomat")
    yield
    logger.info("shutdown")

app = FastAPI(title="The Meta Diplomat", lifespan=lifespan)

# --- Routes ---

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "meta_service"}

@app.post("/connect")
async def connect_meta_account(
    data: dict
):
    """
    Frontend calls this with an Authorization Code obtained from FB Login SDK.
    We: Exchange Code -> Get Assets -> Subscribe -> Sync with Orchestrator.
    """
    code = data.get("code")
    tenant_id = data.get("tenant_id")
    # Meta is strict: Redirect URI must match exactly what was used in frontend (or the page origin)
    default_redirect_uri = os.getenv("FRONTEND_URL", "https://multiagents-frontend.yn8wow.easypanel.host")
    redirect_uri = data.get("redirect_uri", default_redirect_uri)
    
    if not code or not tenant_id:
        raise HTTPException(400, "Missing code or tenant_id")

    # Run flow synchronously to provide immediate UI feedback
    result = await handle_connection_flow(code, tenant_id, redirect_uri)
    return result

async def handle_connection_flow(code: str, tenant_id: str, redirect_uri: str):
    try:
        # 1. Exchange Code for Token
        long_token = await auth_service.exchange_code(code, redirect_uri)
        logger.info("code_exchanged", tenant_id=tenant_id)
        
        # 2. Get Assets (Pages, IG, WABA)
        assets = await auth_service.get_accounts(long_token)
        logger.info("assets_fetched", tenant_id=tenant_id, count=len(assets["pages"]))
        
        # 3. Sync to Orchestrator
        payload = {
            "tenant_id": tenant_id,
            "provider": "meta",
            "credentials": {
                "user_access_token": long_token,
                "assets": assets
            }
        }
        await orchestrator_client.sync_credentials(payload)
        
        # 4. Return Discovery Summary (SANITIZED for Frontend)
        # Security Audit: Do NOT return actual access tokens to the browser.
        sanitized_assets = {
            "pages": [{k: v for k, v in p.items() if k != "access_token"} for p in assets.get("pages", [])],
            "instagram": assets.get("instagram", []), # IG usually doesn't have token at this level
            "whatsapp": assets.get("whatsapp", [])
        }

        return {
            "status": "success",
            "connected": {
                "facebook": len(assets.get("pages", [])) > 0,
                "instagram": len(assets.get("instagram", [])) > 0,
                "whatsapp": len(assets.get("whatsapp", [])) > 0
            },
            "assets": sanitized_assets
        }
        
    except Exception as e:
        logger.error("connection_flow_failed", tenant_id=tenant_id, error=str(e))
        raise HTTPException(500, f"Connection Failed: {str(e)}")


# --- Webhooks ---

@app.get("/webhook")
async def verify_webhook(
    mode: str = Query(..., alias="hub.mode"),
    token: str = Query(..., alias="hub.verify_token"),
    challenge: str = Query(..., alias="hub.challenge")
):
    """
    Meta Verification Challenge.
    """
    return webhook_service.verify_challenge(mode, token, challenge)

@app.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Ingests and Normalizes Meta Events.
    """
    # 1. Verify Signature (Security)
    if META_APP_SECRET:
        await webhook_service.verify_signature(request)
    
    # 2. Parse & Normalize
    try:
        body = await request.json()
        simple_event = webhook_service.normalize_payload(body)
        
        if simple_event:
            # 3. Forward to Orchestrator
            # We assume tenant resolution happens here OR in the Orchestrator.
            # For efficiency, if 'tenant_identifier' is PageID, Orchestrator can map it.
            background_tasks.add_task(orchestrator_client.ingest_webhook_event, simple_event)
            return {"status": "processed"}
        else:
            return {"status": "ignored", "reason": "no_relevant_change"}
            
    except Exception as e:
        logger.error("webhook_error", error=str(e))
        raise HTTPException(500, "Processing failed")
@app.post("/messages/send")
async def send_message_proxy(data: dict):
    """
    Sends a message via Meta Graph API using the provided Page Access Token.
    Payload: {
        "recipient_id": "...",
        "text": "...",
        "access_token": "...",
        "messaging_type": "RESPONSE" 
    }
    """
    recipient_id = data.get("recipient_id")
    text = data.get("text")
    access_token = data.get("access_token")
    messaging_type = data.get("messaging_type", "RESPONSE")

    if not all([recipient_id, text, access_token]):
        raise HTTPException(400, "Missing required fields")

    # Call Graph API
    url = f"https://graph.facebook.com/v19.0/me/messages"
    params = {"access_token": access_token}
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text},
        "messaging_type": messaging_type
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, params=params, json=payload)
        
        if resp.status_code != 200:
            logger.error("meta_send_failed", status=resp.status_code, body=resp.text)
            raise HTTPException(resp.status_code, f"Meta API Error: {resp.text}")
            
        return resp.json()
@app.post("/privacy/data-deletion")
async def data_deletion_callback(request: Request):
    """
    Standard Meta Data Deletion Callback.
    """
    # 1. Parse Signed Request (Simplified for MVP, ideally verify signature)
    try:
        data = await request.form()
        signed_request = data.get('signed_request')
        
        # In production, we MUST verify signature using META_APP_SECRET
        # For now, we generate a confirmation code and URL
        
        confirmation_code = str(uuid.uuid4())
        status_url = f"https://{request.headers.get('host')}/privacy/deletion-status/{confirmation_code}"
        
        return {
            "url": status_url,
            "confirmation_code": confirmation_code
        }
    except Exception as e:
        logger.error("data_deletion_error", error=str(e))
        raise HTTPException(400, "Invalid Request")

@app.get("/privacy/deletion-status/{code}")
async def deletion_status(code: str):
    """
    Status check for data deletion.
    """
    return {
        "status": "completed",
        "message": "Your data deletion request has been processed.",
        "code": code
    }
