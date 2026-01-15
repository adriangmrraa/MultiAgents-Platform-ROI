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
    data: dict, 
    background_tasks: BackgroundTasks
):
    """
    Frontend calls this with a Short-Lived User Token obtained from FB Login SDK.
    We: Exchange it -> Get Assets -> Subscribe -> Sync with Orchestrator.
    """
    short_token = data.get("short_lived_token")
    tenant_id = data.get("tenant_id")
    
    if not short_token or not tenant_id:
        raise HTTPException(400, "Missing token or tenant_id")

    # Run complex flow in background to respond fast
    background_tasks.add_task(handle_connection_flow, short_token, tenant_id)
    
    return {"status": "processing", "message": "Connection flow started"}

async def handle_connection_flow(short_token: str, tenant_id: str):
    try:
        # 1. Exchange Token
        long_token = await auth_service.exchange_token(short_token)
        logger.info("token_exchanged", tenant_id=tenant_id)
        
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
        
    except Exception as e:
        logger.error("connection_flow_failed", tenant_id=tenant_id, error=str(e))


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
