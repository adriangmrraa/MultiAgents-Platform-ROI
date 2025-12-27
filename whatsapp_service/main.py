import os
import hmac
import hashlib
import time
import uuid
import asyncio
import redis
import httpx
import structlog
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, RetryError
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from ycloud_client import YCloudClient
from chatwoot_client import ChatwootClient

# Initialize config
load_dotenv()

# Config handling
_config_cache = {}

async def get_config(name: str, default: str = None) -> str:
    # 1. Check local cache
    if name in _config_cache:
        return _config_cache[name]
    
    # 2. Check local Environment
    val = os.getenv(name)
    if val:
        _config_cache[name] = val
        return val
        
    # 3. Query Orchestrator
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ORCHESTRATOR_URL}/admin/internal/credentials/{name}",
                headers={"X-Internal-Token": INTERNAL_SECRET_KEY or "internal-secret"},
                timeout=5.0
            )
            if resp.status_code == 200:
                val = resp.json().get("value")
                if val:
                    _config_cache[name] = val
                    return val
    except Exception as e:
        logger.warning("config_fetch_failed", name=name, error=str(e))
        
    return default

# Initialize startup values (can be overridden later)
YCLOUD_API_KEY = os.getenv("YCLOUD_API_KEY")
YCLOUD_WEBHOOK_SECRET = os.getenv("YCLOUD_WEBHOOK_SECRET")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
INTERNAL_SECRET_KEY = os.getenv("INTERNAL_SECRET_KEY") or os.getenv("INTERNAL_API_TOKEN") or "internal-secret"
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_SERVICE_URL", "http://orchestrator_service:8000")
CHATWOOT_BASE_URL = os.getenv("CHATWOOT_BASE_URL")
CHATWOOT_BOT_TOKEN = os.getenv("CHATWOOT_BOT_TOKEN")

# Initialize structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

# Initialize Redis
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# --- Models ---
class OrchestratorMessage(BaseModel):
    part: Optional[int] = None
    total: Optional[int] = None
    text: Optional[str] = None
    imageUrl: Optional[str] = None
    needs_handoff: bool = False
    handoff: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

class OrchestratorResult(BaseModel):
    status: str
    send: bool
    text: Optional[str] = None
    messages: List[OrchestratorMessage] = Field(default_factory=list)

class SendMessage(BaseModel):
    to: str
    text: str
    channel_source: str = "whatsapp"
    external_chatwoot_id: Optional[int] = None
    external_account_id: Optional[int] = None

# FastAPI App
app = FastAPI(
    title="WhatsApp Service",
    description="A service to handle WhatsApp interactions and forward them to the orchestrator.",
)

# Metrics
SERVICE_NAME = "whatsapp_service"
REQUESTS = Counter("http_requests_total", "Total Request Count", ["service", "endpoint", "method", "status"])
LATENCY = Histogram("http_request_latency_seconds", "Request Latency", ["service", "endpoint"])

# --- Middleware ---
@app.middleware("http")
async def add_metrics_and_logs(request: Request, call_next):
    start_time = time.time()
    correlation_id = request.headers.get("X-Correlation-Id") or request.headers.get("traceparent")
    response = await call_next(request)
    process_time = time.time() - start_time
    status_code = response.status_code
    REQUESTS.labels(service=SERVICE_NAME, endpoint=request.url.path, method=request.method, status=status_code).inc()
    LATENCY.labels(service=SERVICE_NAME, endpoint=request.url.path).observe(process_time)
    logger.bind(
        service=SERVICE_NAME, correlation_id=correlation_id, status_code=status_code,
        method=request.method, endpoint=request.url.path, latency_ms=round(process_time * 1000, 2)
    ).info("request_completed" if status_code < 400 else "request_failed")
    return response

# --- Helpers ---
async def verify_signature(request: Request):
    signature_header = request.headers.get("ycloud-signature")
    if not signature_header: raise HTTPException(status_code=401, detail="Missing signature header")
    try:
        parts = {k: v for k, v in [p.split("=") for p in signature_header.split(",")]}
        t, s = parts.get("t"), parts.get("s")
    except: raise HTTPException(status_code=401, detail="Invalid signature format")
    if not t or not s: raise HTTPException(status_code=401, detail="Missing timestamp or signature")
    if abs(time.time() - int(t)) > 300: raise HTTPException(status_code=401, detail="Timestamp out of tolerance")
    raw_body = await request.body()
    signed_payload = f"{t}.{raw_body.decode('utf-8')}"
    expected = hmac.new(YCLOUD_WEBHOOK_SECRET.encode("utf-8"), signed_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, s): raise HTTPException(status_code=401, detail="Invalid signature")

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10),
       retry=retry_if_exception_type(httpx.HTTPError))
async def forward_to_orchestrator(payload: dict, headers: dict):
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
        response = await client.post(f"{ORCHESTRATOR_URL}/chat", json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

async def transcribe_audio(audio_url: str, correlation_id: str) -> Optional[str]:
    """Downloads audio from YCloud and transcribes it using OpenAI Whisper."""
    if not OPENAI_API_KEY:
        logger.error("missing_openai_api_key", note="Transcription requires OpenAI API key")
        return None
    
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            # 1. Download audio
            audio_res = await client.get(audio_url)
            audio_res.raise_for_status()
            audio_data = audio_res.content
            
            # 2. Transcribe with Whisper
            files = {"file": ("audio.ogg", audio_data, "audio/ogg")}
            v_openai = await get_config("OPENAI_API_KEY", OPENAI_API_KEY)
            headers = {"Authorization": f"Bearer {v_openai}"}
            data = {"model": "whisper-1"}
            
            trans_res = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data
            )
            trans_res.raise_for_status()
            return trans_res.json().get("text")
    except Exception as e:
        logger.error("transcription_failed", error=str(e), correlation_id=correlation_id)
        return None

async def send_sequence(messages: List[OrchestratorMessage], user_number: str, business_number: str, inbound_id: str, correlation_id: str):
    v_ycloud = await get_config("YCLOUD_API_KEY", YCLOUD_API_KEY)
    client = YCloudClient(v_ycloud, business_number)
    
    try: 
        await client.mark_as_read(inbound_id, correlation_id)
        await client.typing_indicator(inbound_id, correlation_id)
    except: pass

    for msg in messages:
        try:
            # 1. Image Bubble
            if msg.imageUrl:
                try: await client.typing_indicator(inbound_id, correlation_id)
                except: pass
                await asyncio.sleep(4)
                await client.send_image(user_number, msg.imageUrl, correlation_id)
                try: await client.mark_as_read(inbound_id, correlation_id)
                except: pass

            # 2. Text Bubble(s) with Safety Splitter (Layer 2)
            if msg.text:
                # Emergency splitting if orchestrator sent a wall of text (>400 chars)
                import re
                if len(msg.text) > 400:
                    text_parts = re.split(r'(?<=[.!?]) +', msg.text)
                    refined_parts = []
                    current = ""
                    for p in text_parts:
                        if len(current) + len(p) < 400:
                            current += (" " + p if current else p)
                        else:
                            if current: refined_parts.append(current)
                            current = p
                    if current: refined_parts.append(current)
                else:
                    refined_parts = [msg.text]

                for part in refined_parts:
                    try: await client.typing_indicator(inbound_id, correlation_id)
                    except: pass
                    await asyncio.sleep(4)
                    await client.send_text(user_number, part, correlation_id)
                    try: await client.mark_as_read(inbound_id, correlation_id)
                    except: pass
                
        except Exception as e:
            logger.error("sequence_step_error", error=str(e), correlation_id=correlation_id)

# --- Background Task ---
async def process_user_buffer(from_number: str, business_number: str, customer_name: Optional[str], event_id: str, provider_message_id: str):
    buffer_key, timer_key, lock_key = f"buffer:{from_number}", f"timer:{from_number}", f"active_task:{from_number}"
    correlation_id = str(uuid.uuid4())
    log = logger.bind(correlation_id=correlation_id, from_number=from_number[-4:])
    try:
        while True:
            await asyncio.sleep(2)
            if redis_client.ttl(timer_key) <= 0: break
        
        messages = redis_client.lrange(buffer_key, 0, -1)
        if not messages: return
        joined_text = "\n".join(messages)
        
        inbound_event = {
            "provider": "ycloud", "event_id": event_id, "provider_message_id": provider_message_id,
            "from_number": from_number, "to_number": business_number, "text": joined_text, "customer_name": customer_name,
            "event_type": "whatsapp.inbound_message.received", "correlation_id": correlation_id
        }
        headers = {"X-Correlation-Id": correlation_id}
        if INTERNAL_SECRET_KEY: headers["X-Internal-Token"] = INTERNAL_SECRET_KEY
             
        log.info("forwarding_to_orchestrator", text_preview=joined_text[:50])
        raw_res = await forward_to_orchestrator(inbound_event, headers)
        log.info("orchestrator_response_received", status=raw_res.get("status"), send=raw_res.get("send"))
        
        try:
            orch_res = OrchestratorResult(**raw_res)
        except Exception as e:
            log.error("orchestrator_parse_error", error=str(e), raw=raw_res)
            return

        if orch_res.status == "duplicate":
            log.info("ignoring_duplicate_response")
            return

        if orch_res.send:
            if not YCLOUD_API_KEY:
                log.error("missing_ycloud_api_key", note="Cannot send sequence without API key")
                return
            
            msgs = orch_res.messages
            if not msgs and orch_res.text:
                msgs = [OrchestratorMessage(text=orch_res.text)]
            
            if msgs:
                img_count = len([m for m in msgs if m.imageUrl])
                log.info("starting_send_sequence", count=len(msgs), images_found=img_count)
                await send_sequence(msgs, from_number, business_number, event_id, correlation_id)
            else:
                log.warning("nothing_to_send", note="Orchestrator said send=True but messages/text are empty")

    except Exception as e:
        log.error("buffer_process_error", error=str(e))
    finally:
        for k in [buffer_key, lock_key, timer_key]:
            try:
                redis_client.delete(k)
            except:
                pass

# --- Endpoints ---
@app.get("/metrics")
def metrics(): return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/ready")
def ready():
    if not YCLOUD_WEBHOOK_SECRET: raise HTTPException(status_code=503, detail="Configuration missing")
    return {"status": "ok"}

@app.get("/health")
def health(): return {"status": "ok"}

@app.post("/webhook/ycloud")
async def ycloud_webhook(request: Request):
    logger.info("webhook_hit", headers=str(request.headers))
    await verify_signature(request)
    correlation_id = request.headers.get("traceparent") or str(uuid.uuid4())
    try: body = await request.json()
    except: raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event = body[0] if isinstance(body, list) and body else body
    event_type = event.get("type")
    
    # --- 1. Handle Inbound Messages ---
    if event_type == "whatsapp.inbound_message.received":
        msg = event.get("whatsappInboundMessage", {})
        from_n, to_n, name = msg.get("from"), msg.get("to"), msg.get("customerProfile", {}).get("name")
        msg_type = msg.get("type")
        
        # A. Text Messages -> Buffer (Debounce)
        if msg_type == "text":
            text = msg.get("text", {}).get("body")
            if text:
                buffer_key, timer_key, lock_key = f"buffer:{from_n}", f"timer:{from_n}", f"active_task:{from_n}"
                redis_client.rpush(buffer_key, text)
                redis_client.setex(timer_key, 16, "1")
                
                if not redis_client.get(lock_key):
                    redis_client.setex(lock_key, 60, "1")
                    asyncio.create_task(process_user_buffer(from_n, to_n, name, event.get("id"), msg.get("wamid") or event.get("id")))
                    return {"status": "buffering_started", "correlation_id": correlation_id}
                return {"status": "buffering_updated", "correlation_id": correlation_id}
        
        # B. Media Messages -> Immediate Forward (No Buffer)
        media_list = []
        text_content = None
        
        if msg_type == "image":
            node = msg.get("image", {})
            text_content = node.get("caption")
            media_list.append({
                "type": "image", 
                "url": node.get("link"), 
                "mime_type": node.get("mime_type"),
                "provider_id": node.get("id")
            })
            
        elif msg_type == "document":
            node = msg.get("document", {})
            text_content = node.get("caption")
            media_list.append({
                "type": "document", 
                "url": node.get("link"), 
                "mime_type": node.get("mime_type"), 
                "file_name": node.get("filename"),
                "provider_id": node.get("id")
            })
            
        elif msg_type == "audio":
            node = msg.get("audio", {})
            media_list.append({
                "type": "audio", 
                "url": node.get("link"), 
                "mime_type": node.get("mime_type"),
                "provider_id": node.get("id")
            })
            # Transcription
            if node.get("link"):
                logger.info("audio_received_starting_transcription", correlation_id=correlation_id)
                transcription = await transcribe_audio(node.get("link"), correlation_id)
                if transcription:
                     text_content = transcription
                     
        if media_list:
             # Construct payload compatible with InboundChatEvent + Media extension
             payload = {
                "provider": "ycloud", 
                "event_id": event.get("id"), 
                "provider_message_id": msg.get("wamid") or event.get("id"),
                "from_number": from_n, 
                "to_number": to_n, 
                "text": text_content, # Can be None/null
                "customer_name": name,
                "event_type": "whatsapp.inbound_message.received", 
                "correlation_id": correlation_id,
                "media": media_list
             }
             headers = {"X-Correlation-Id": correlation_id}
             if INTERNAL_SECRET_KEY: headers["X-Internal-Token"] = INTERNAL_SECRET_KEY
             
             await forward_to_orchestrator(payload, headers)
             return {"status": "media_forwarded", "count": len(media_list)}
             
        return {"status": "ignored_type_or_empty", "type": msg_type}

    # --- 2. Handle Echoes (Manual Messages) ---
    elif event_type == "whatsapp.message.echo" or event_type == "whatsapp.smb.message.echoes":
        logger.info("echo_received", correlation_id=correlation_id, event=event_type)
        msg = event.get("whatsappMessage", {}) or event.get("message", {})
        
        user_phone = msg.get("to")
        bot_phone = msg.get("from")
        
        text = None
        if msg.get("type") == "text":
            text = msg.get("text", {}).get("body")
        
        if text and user_phone:
             payload = {
                "provider": "ycloud", 
                "event_id": event.get("id"), 
                "provider_message_id": msg.get("wamid") or event.get("id"),
                "from_number": user_phone,     # Ensuring this maps to 'external_user_id' in DB
                "to_number": bot_phone,
                "text": text,
                "event_type": "whatsapp.message.echo", # Standardize for Orchestrator
                "correlation_id": correlation_id
             }
             headers = {"X-Correlation-Id": correlation_id}
             if INTERNAL_SECRET_KEY: headers["X-Internal-Token"] = INTERNAL_SECRET_KEY
             
             try:
                 await forward_to_orchestrator(payload, headers)
                 return {"status": "echo_forwarded"}
             except Exception as e:
                 logger.error("echo_forward_failed", error=str(e))
                 return {"status": "error_forwarding_echo"}
                 
    return {"status": "ignored_event_type", "type": event_type}

@app.post("/webhooks/chatwoot")
async def chatwoot_webhook(request: Request):
    """
    Universal Inbound Gateway for Chatwoot (Instagram/Facebook).
    """
    # 1. Security Check (Omega Protocol: Simple token validation via query param)
    secret = request.query_params.get("secret")
    if secret != (INTERNAL_SECRET_KEY or "internal-secret"):
         logger.warning("chatwoot_auth_failed", reason="invalid_secret_param")
         raise HTTPException(status_code=401, detail="Unauthorized")

    correlation_id = str(uuid.uuid4())
    try:
        body = await request.json()
    except Exception as e:
        logger.error("chatwoot_payload_error", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Handle both single object and list (Chatwoot standard varies)
    event = body[0] if isinstance(body, list) and body else body
    event_type = event.get("event")
    
    # We only care about message creation for now
    if event_type != "message_created":
        return {"status": "ignored_event", "type": event_type}

    message_data = event.get("conversation", {})
    sender_data = event.get("sender", {})
    content = event.get("content")
    
    # Detect Channel
    raw_channel = message_data.get("channel", "")
    channel_source = "whatsapp"
    if "Instagram" in raw_channel:
        channel_source = "instagram"
    elif "Facebook" in raw_channel:
        channel_source = "facebook"

    # Extract PSIDs and IDs
    psid = sender_data.get("source_id") # Source ID is the PSID (IG/FB specific)
    chatwoot_conversation_id = message_data.get("id")
    chatwoot_account_id = event.get("account", {}).get("id")

    # Construct Orchestrator Payload (Nexus v4.0 Standard)
    payload = {
        "provider": "chatwoot",
        "event_id": str(event.get("id") or uuid.uuid4()),
        "provider_message_id": str(event.get("id") or uuid.uuid4()),
        "from_number": psid, # Use PSID as identified in multitenant
        "to_number": "chatwoot_inbox_" + str(message_data.get("inbox_id", "0")),
        "text": content,
        "customer_name": sender_data.get("name"),
        "event_type": "chatwoot.message_created",
        "correlation_id": correlation_id,
        "channel_source": channel_source,
        "external_chatwoot_id": chatwoot_conversation_id,
        "external_account_id": chatwoot_account_id,
        "meta": {
             "chatwoot_inbox_id": message_data.get("inbox_id"),
             "channel_type": raw_channel
        }
    }

    headers = {
        "X-Correlation-Id": correlation_id,
        "X-Internal-Token": INTERNAL_SECRET_KEY or "internal-secret"
    }

    logger.info("forwarding_chatwoot_to_orchestrator", channel=channel_source, conv_id=chatwoot_conversation_id)
    
    try:
        await forward_to_orchestrator(payload, headers)
        return {"status": "forwarded", "correlation_id": correlation_id}
    except Exception as e:
        logger.error("chatwoot_forward_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to reach orchestrator")

@app.post("/messages/send")
async def send_message(message: SendMessage, request: Request):
    """Internal endpoint for sending manual messages from orchestrator."""
    token = request.headers.get("X-Internal-Token")
    if token != (INTERNAL_SECRET_KEY or "internal-secret"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
    # Retrieve config
    v_ycloud = await get_config("YCLOUD_API_KEY", YCLOUD_API_KEY)
    # We need to know which business number to use - for now assume default or pass in body if model updated
    # To keep it simple for now, we use the default env var logic inside YCloudClient via send_sequence or re-instantiate
    # Ideally SendMessage model should include 'from_number' (business number)
    
    # Since SendMessage is simple (to, text), we try to get a business number from config or context
    # But YCloudClient needs it.
    # Hack: We initialize YCloudClient with a dummy if needed, but it really needs the sender ID.
    # Let's check send_sequence usage: client = YCloudClient(v_ycloud, business_number)
    
    # IMPROVEMENT: The request should probably provide the separate business number/ID
    # For this MVP, let's assume global YCloud config unless passed
    
    try:
        # Enrutador Inteligente (Nexus v4.0)
        if message.channel_source in ["instagram", "facebook"]:
            # Route via Chatwoot
            cw_base = await get_config("CHATWOOT_BASE_URL", CHATWOOT_BASE_URL)
            cw_token = await get_config("CHATWOOT_BOT_TOKEN", CHATWOOT_BOT_TOKEN)
            
            if not cw_base or not cw_token:
                raise HTTPException(status_code=500, detail="Chatwoot configuration missing")
            
            cw_client = ChatwootClient(cw_base, cw_token)
            await cw_client.send_text_message(
                account_id=message.external_account_id,
                conversation_id=message.external_chatwoot_id,
                text=message.text
            )
            return {"status": "sent_via_chatwoot", "correlation_id": correlation_id}
            
        else:
            # Route via YCloud (WhatsApp)
            v_ycloud = await get_config("YCLOUD_API_KEY", YCLOUD_API_KEY)
            
            # Updated Logic: We will parse `from_number` from query param or header if available, or fetch from config
            business_number = request.query_params.get("from_number")
            if not business_number:
                # Fallback to env or fetch
                 business_number = await get_config("YCLOUD_Phone_Number_ID") # Placeholder
            
            if not business_number:
                 # Basic fallback
                 business_number = "default"

            # Initialize Client
            client = YCloudClient(v_ycloud, business_number)
            
            # Send
            await client.send_text(message.to, message.text, correlation_id)
            return {"status": "sent_via_ycloud", "correlation_id": correlation_id}
        
    except Exception as e:
        logger.error("manual_send_failed", error=str(e), channel=message.channel_source, correlation_id=correlation_id)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
```
