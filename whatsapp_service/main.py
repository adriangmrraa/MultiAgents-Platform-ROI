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
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    RetryError,
)
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from ycloud_client import YCloudClient
from chatwoot_client import ChatwootClient

# Initialize config
load_dotenv()

# Config handling
_config_cache = {}


async def get_config(name: str, default: str = None, tenant_id: int = None) -> str:
    # 1. Check local cache
    cache_key = f"{name}_{tenant_id}" if tenant_id else name
    if cache_key in _config_cache:
        return _config_cache[cache_key]

    # 2. Check local Environment (only if no tenant_id)
    if not tenant_id:
        val = os.getenv(name)
        if val:
            _config_cache[cache_key] = val
            return val

    # 3. Query Orchestrator
    try:
        async with httpx.AsyncClient() as client:
            params = {"tenant_id": tenant_id} if tenant_id else {}
            url = f"{ORCHESTRATOR_URL}/admin/internal/credentials/{name}"

            try:
                resp = await client.get(
                    url,
                    headers={"X-Internal-Token": INTERNAL_SECRET_KEY},
                    params=params,
                    timeout=5.0,
                )
            except Exception as e:
                # DNS Fallback (Nexus v6.2.12)
                if (
                    "Name or service not known" in str(e) or "ConnectError" in str(e)
                ) and "orchestrator_service" in url:
                    dash_url = url.replace(
                        "orchestrator_service", "orchestrator-service"
                    )
                    logger.warning(
                        f"🔁 CONFIG: Primary host failed. Attempting Dash Fallback | url={dash_url}"
                    )
                    resp = await client.get(
                        dash_url,
                        headers={"X-Internal-Token": INTERNAL_SECRET_KEY},
                        params=params,
                        timeout=5.0,
                    )
                else:
                    raise e

            if resp.status_code == 200:
                val = resp.json().get("value")
                if val:
                    _config_cache[cache_key] = val
                    return val
    except Exception as e:
        logger.warning(
            "config_fetch_failed", name=name, tenant_id=tenant_id, error=str(e)
        )

    return default


def smart_split(text: str, max_chars: int = 400) -> List[str]:
    """
    Emergency Auto-Splitter (Nexus v6.2.10).
    Splits long messages by double newlines or character limits.
    """
    if not text:
        return []
    if len(text) <= max_chars and "\n\n" not in text:
        return [text]

    # 1. Split by double newlines first (Natural breaks)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    refined_parts = []
    for p in paragraphs:
        if len(p) <= max_chars:
            refined_parts.append(p)
        else:
            # 2. Hard split by max_chars if a paragraph is still too long
            # (Keeping it simple: split by words/sentences if possible? For now, slice)
            while len(p) > max_chars:
                cut_idx = p.rfind(". ", 0, max_chars)
                if cut_idx == -1:
                    cut_idx = p.rfind(" ", 0, max_chars)
                if cut_idx == -1:
                    cut_idx = max_chars

                refined_parts.append(p[: cut_idx + 1].strip())
                p = p[cut_idx + 1 :].strip()
            if p:
                refined_parts.append(p)

    return refined_parts


# Initialize startup values (can be overridden later)
YCLOUD_API_KEY = os.getenv("YCLOUD_API_KEY")
YCLOUD_WEBHOOK_SECRET = os.getenv("YCLOUD_WEBHOOK_SECRET")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
INTERNAL_SECRET_KEY = os.getenv("INTERNAL_SECRET_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
ORCHESTRATOR_URL = os.getenv(
    "ORCHESTRATOR_SERVICE_URL", "http://orchestrator_service:8000"
)
CHATWOOT_BASE_URL = os.getenv("CHATWOOT_BASE_URL")
CHATWOOT_BOT_TOKEN = os.getenv("CHATWOOT_BOT_TOKEN")

# Initialize structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
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


class RelayMessage(BaseModel):
    to: str
    text: str
    provider: str  # ycloud, meta_direct, chatwoot
    channel_source: str  # whatsapp, instagram, facebook
    tenant_id: int
    conversation_id: str
    external_chatwoot_id: Optional[int] = None
    external_account_id: Optional[int] = None


class SendMessage(BaseModel):
    to: str
    text: Optional[str] = None
    imageUrl: Optional[str] = None
    channel_source: str = "whatsapp"
    external_chatwoot_id: Optional[int] = None
    external_account_id: Optional[int] = None


# FastAPI App
_is_debug = os.getenv("DEBUG", "").lower() in ("true", "1")
app = FastAPI(
    title="WhatsApp Service",
    description="A service to handle WhatsApp interactions and forward them to the orchestrator.",
    docs_url="/docs" if _is_debug else None,
    redoc_url="/redoc" if _is_debug else None,
    openapi_url="/openapi.json" if _is_debug else None,
)

# Metrics
SERVICE_NAME = "whatsapp_service"
REQUESTS = Counter(
    "http_requests_total",
    "Total Request Count",
    ["service", "endpoint", "method", "status"],
)
LATENCY = Histogram(
    "http_request_latency_seconds", "Request Latency", ["service", "endpoint"]
)


# --- Middleware ---
@app.middleware("http")
async def add_metrics_and_logs(request: Request, call_next):
    start_time = time.time()
    correlation_id = request.headers.get("X-Correlation-Id") or request.headers.get(
        "traceparent"
    )
    response = await call_next(request)
    process_time = time.time() - start_time
    status_code = response.status_code
    REQUESTS.labels(
        service=SERVICE_NAME,
        endpoint=request.url.path,
        method=request.method,
        status=status_code,
    ).inc()
    LATENCY.labels(service=SERVICE_NAME, endpoint=request.url.path).observe(
        process_time
    )
    logger.bind(
        service=SERVICE_NAME,
        correlation_id=correlation_id,
        status_code=status_code,
        method=request.method,
        endpoint=request.url.path,
        latency_ms=round(process_time * 1000, 2),
    ).info("request_completed" if status_code < 400 else "request_failed")
    return response


# --- Helpers ---
async def verify_signature(request: Request):
    signature_header = request.headers.get("ycloud-signature")
    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing signature header")
    try:
        parts = {k: v for k, v in [p.split("=") for p in signature_header.split(",")]}
        t, s = parts.get("t"), parts.get("s")
    except Exception as e:
        logger.warning("signature_parse_failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid signature format")
    if not t or not s:
        raise HTTPException(status_code=401, detail="Missing timestamp or signature")
    if abs(time.time() - int(t)) > 300:
        raise HTTPException(status_code=401, detail="Timestamp out of tolerance")
    raw_body = await request.body()

    # v7.0 Multi-Tenant Channel Resolution
    # Parse body to extract channel identifier
    try:
        body = json.loads(raw_body.decode("utf-8"))
        event = body[0] if isinstance(body, list) and body else body

        # Extract WABA ID from webhook (YCloud uses whatsappBusinessAccountId)
        waba_id = (
            event.get("whatsappBusinessAccountId")
            or event.get("whatsappInboundMessage", {}).get("wabaId")
            or event.get("from")  # Fallback for older webhook versions
        )

        if not waba_id:
            logger.error("webhook_missing_channel_id", event=event)
            raise HTTPException(400, detail="Cannot identify channel from webhook")
    except json.JSONDecodeError:
        raise HTTPException(400, detail="Invalid JSON in webhook body")

    # Resolve tenant from channel binding
    try:
        import httpx

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ORCHESTRATOR_URL}/internal/routing/resolve",
                params={"provider": "ycloud", "channel_id": waba_id},
                headers={"X-Internal-Token": os.getenv("INTERNAL_SECRET_KEY")},
            )
            resp.raise_for_status()
            tenant_info = resp.json()
            tenant_id = tenant_info["tenant_id"]
            logger.info("tenant_resolved", tenant_id=tenant_id, channel_id=waba_id)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.warning("channel_not_bound", channel_id=waba_id)
            raise HTTPException(404, detail="Channel not configured for any tenant")
        logger.error("tenant_resolution_error", status=e.response.status_code)
        raise HTTPException(503, detail="Failed to resolve tenant")
    except Exception as e:
        logger.error("tenant_resolution_exception", error=str(e))
        raise HTTPException(503, detail="Tenant resolution service unavailable")

    # Obtener el secreto específico del tenant (variable local, sin mutar el global)
    # Fallback al secreto de entorno si el tenant no tiene uno configurado
    tenant_webhook_secret = await get_config(
        "YCLOUD_WEBHOOK_SECRET", default=YCLOUD_WEBHOOK_SECRET, tenant_id=tenant_id
    )

    if not tenant_webhook_secret:
        logger.error("missing_tenant_webhook_secret", tenant_id=tenant_id)
        raise HTTPException(
            503, detail=f"Webhook secret not configured for tenant {tenant_id}"
        )

    signed_payload = f"{t}.{raw_body.decode('utf-8')}"
    expected = hmac.new(
        tenant_webhook_secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, s):
        raise HTTPException(status_code=401, detail="Invalid signature")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(httpx.HTTPError),
)
async def forward_to_orchestrator(payload: dict, headers: dict):
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
        response = await client.post(
            f"{ORCHESTRATOR_URL}/chat", json=payload, headers=headers
        )
        response.raise_for_status()
        return response.json()


async def transcribe_audio(audio_url: str, correlation_id: str) -> Optional[str]:
    """Downloads audio from YCloud and transcribes it using OpenAI Whisper."""
    if not OPENAI_API_KEY:
        logger.error(
            "missing_openai_api_key", note="Transcription requires OpenAI API key"
        )
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
                data=data,
            )
            trans_res.raise_for_status()
            return trans_res.json().get("text")
    except Exception as e:
        logger.error(
            "transcription_failed", error=str(e), correlation_id=correlation_id
        )
        return None


async def send_sequence(
    messages: List[OrchestratorMessage],
    user_number: str,
    business_number: str,
    inbound_id: str,
    correlation_id: str,
):
    v_ycloud = await get_config("YCLOUD_API_KEY", YCLOUD_API_KEY)
    client = YCloudClient(v_ycloud, business_number)

    try:
        await client.mark_as_read(inbound_id, correlation_id)
        await client.typing_indicator(inbound_id, correlation_id)
    except Exception as e:
        logger.warning("ycloud_read_indicator_failed", error=str(e))

    for msg in messages:
        try:
            # 1. Image Bubble
            if msg.imageUrl:
                try:
                    await client.typing_indicator(inbound_id, correlation_id)
                except Exception as e:
                    logger.warning("typing_indicator_failed", error=str(e))
                await asyncio.sleep(4)
                await client.send_image(user_number, msg.imageUrl, correlation_id)
                try:
                    await client.mark_as_read(inbound_id, correlation_id)
                except Exception as e:
                    logger.warning("mark_as_read_failed", error=str(e))

            # 2. Text Bubble(s) with Safety Splitter (Layer 2)
            if msg.text:
                # Emergency splitting if orchestrator sent a wall of text (>400 chars)
                import re

                if len(msg.text) > 400:
                    text_parts = re.split(r"(?<=[.!?]) +", msg.text)
                    refined_parts = []
                    current = ""
                    for p in text_parts:
                        if len(current) + len(p) < 400:
                            current += " " + p if current else p
                        else:
                            if current:
                                refined_parts.append(current)
                            current = p
                    if current:
                        refined_parts.append(current)
                else:
                    refined_parts = [msg.text]

                for part in refined_parts:
                    try:
                        await client.typing_indicator(inbound_id, correlation_id)
                    except Exception as e:
                        logger.warning("typing_indicator_failed", error=str(e))
                    await asyncio.sleep(4)
                    await client.send_text(user_number, part, correlation_id)
                    try:
                        await client.mark_as_read(inbound_id, correlation_id)
                    except Exception as e:
                        logger.warning("mark_as_read_failed", error=str(e))

        except Exception as e:
            logger.error(
                "sequence_step_error", error=str(e), correlation_id=correlation_id
            )


# --- Background Task ---
async def process_user_buffer(
    from_number: str,
    business_number: str,
    customer_name: Optional[str],
    event_id: str,
    provider_message_id: str,
):
    buffer_key, timer_key, lock_key = (
        f"buffer:{from_number}",
        f"timer:{from_number}",
        f"active_task:{from_number}",
    )
    correlation_id = str(uuid.uuid4())
    log = logger.bind(correlation_id=correlation_id, from_number=from_number[-4:])
    try:
        while True:
            await asyncio.sleep(2)
            if redis_client.ttl(timer_key) <= 0:
                break

        messages = redis_client.lrange(buffer_key, 0, -1)
        if not messages:
            return
        joined_text = "\n".join(messages)

        inbound_event = {
            "provider": "ycloud",
            "event_id": event_id,
            "provider_message_id": provider_message_id,
            "from_number": from_number,
            "to_number": business_number,
            "text": joined_text,
            "customer_name": customer_name,
            "event_type": "whatsapp.inbound_message.received",
            "correlation_id": correlation_id,
        }
        headers = {"X-Correlation-Id": correlation_id}
        if INTERNAL_SECRET_KEY:
            headers["X-Internal-Token"] = INTERNAL_SECRET_KEY

        log.info("forwarding_to_orchestrator", text_preview=joined_text[:50])
        raw_res = await forward_to_orchestrator(inbound_event, headers)
        log.info(
            "orchestrator_response_received",
            status=raw_res.get("status"),
            send=raw_res.get("send"),
        )

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
                log.error(
                    "missing_ycloud_api_key",
                    note="Cannot send sequence without API key",
                )
                return

            msgs = orch_res.messages
            if not msgs and orch_res.text:
                msgs = [OrchestratorMessage(text=orch_res.text)]

            if msgs:
                img_count = len([m for m in msgs if m.imageUrl])
                log.info(
                    "starting_send_sequence", count=len(msgs), images_found=img_count
                )
                await send_sequence(
                    msgs, from_number, business_number, event_id, correlation_id
                )
            else:
                log.warning(
                    "nothing_to_send",
                    note="Orchestrator said send=True but messages/text are empty",
                )

    except Exception as e:
        log.error("buffer_process_error", error=str(e))
    finally:
        for k in [buffer_key, lock_key, timer_key]:
            try:
                redis_client.delete(k)
            except Exception as e:
                logger.warning("redis_key_cleanup_failed", key=k, error=str(e))


# --- Endpoints ---
@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/ready")
def ready():
    if not YCLOUD_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Configuration missing")
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/webhooks/ycloud")
async def ycloud_webhook(request: Request):
    logger.info("webhook_hit", headers=str(request.headers))
    await verify_signature(request)
    correlation_id = request.headers.get("traceparent") or str(uuid.uuid4())
    try:
        body = await request.json()
    except Exception as e:
        logger.warning("webhook_json_parse_failed", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = body[0] if isinstance(body, list) and body else body
    event_type = event.get("type")

    # --- 1. Handle Inbound Messages ---
    if event_type == "whatsapp.inbound_message.received":
        msg = event.get("whatsappInboundMessage", {})
        from_n, to_n, name = (
            msg.get("from"),
            msg.get("to"),
            msg.get("customerProfile", {}).get("name"),
        )
        msg_type = msg.get("type")

        # A. Text Messages -> Buffer (Debounce)
        if msg_type == "text":
            text = msg.get("text", {}).get("body")
            if text:
                buffer_key, timer_key, lock_key = (
                    f"buffer:{from_n}",
                    f"timer:{from_n}",
                    f"active_task:{from_n}",
                )
                redis_client.rpush(buffer_key, text)
                redis_client.setex(timer_key, 16, "1")

                if not redis_client.get(lock_key):
                    redis_client.setex(lock_key, 60, "1")
                    asyncio.create_task(
                        process_user_buffer(
                            from_n,
                            to_n,
                            name,
                            event.get("id"),
                            msg.get("wamid") or event.get("id"),
                        )
                    )
                    return {
                        "status": "buffering_started",
                        "correlation_id": correlation_id,
                    }
                return {"status": "buffering_updated", "correlation_id": correlation_id}

        # B. Media Messages -> Immediate Forward (No Buffer)
        media_list = []
        text_content = None

        if msg_type == "image":
            node = msg.get("image", {})
            text_content = node.get("caption")
            media_list.append(
                {
                    "type": "image",
                    "url": node.get("link"),
                    "mime_type": node.get("mime_type"),
                    "provider_id": node.get("id"),
                }
            )

        elif msg_type == "document":
            node = msg.get("document", {})
            text_content = node.get("caption")
            media_list.append(
                {
                    "type": "document",
                    "url": node.get("link"),
                    "mime_type": node.get("mime_type"),
                    "file_name": node.get("filename"),
                    "provider_id": node.get("id"),
                }
            )

        elif msg_type == "audio":
            node = msg.get("audio", {})
            media_list.append(
                {
                    "type": "audio",
                    "url": node.get("link"),
                    "mime_type": node.get("mime_type"),
                    "provider_id": node.get("id"),
                }
            )
            # Transcription (Nexus v6.2.20)
            if node.get("link"):
                logger.info(
                    "audio_received_starting_transcription",
                    correlation_id=correlation_id,
                )
                v_openai = await get_config("OPENAI_API_KEY", OPENAI_API_KEY)
                # Ensure we have the key before attempting transcription
                if v_openai:
                    transcription = await transcribe_audio(
                        node.get("link"), correlation_id
                    )
                    if transcription:
                        text_content = transcription
                        logger.info(
                            "audio_transcribed_success", text=transcription[:50]
                        )
                else:
                    logger.warning("transcription_skipped_missing_key")

        if media_list:
            # Construct payload compatible with InboundChatEvent + Media extension
            payload = {
                "provider": "ycloud",
                "event_id": event.get("id"),
                "provider_message_id": msg.get("wamid") or event.get("id"),
                "from_number": from_n,
                "to_number": to_n,
                "text": text_content,  # Transcribed text or caption
                "customer_name": name,
                "event_type": "whatsapp.inbound_message.received",
                "correlation_id": correlation_id,
                "media": media_list,
            }
            headers = {"X-Correlation-Id": correlation_id}
            if INTERNAL_SECRET_KEY:
                headers["X-Internal-Token"] = INTERNAL_SECRET_KEY

            await forward_to_orchestrator(payload, headers)
            return {"status": "media_forwarded", "count": len(media_list)}

        return {"status": "ignored_type_or_empty", "type": msg_type}

    # --- 2. Handle Echoes (Manual Messages) ---
    elif (
        event_type == "whatsapp.message.echo"
        or event_type == "whatsapp.smb.message.echoes"
    ):
        logger.info("echo_received", correlation_id=correlation_id, event=event_type)
        msg = event.get("whatsappMessage", {}) or event.get("message", {})

        user_phone = msg.get("to")
        bot_phone = msg.get("from")

        text = None
        if msg.get("type") == "text":
            text = msg.get("text", {}).get("body")
        elif msg.get("type") == "audio":
            # Echo of an audio message from the HUMAN side
            text = "[Audio Manual]"

        if (text or msg.get("type") == "audio") and user_phone:
            payload = {
                "provider": "ycloud",
                "event_id": event.get("id"),
                "provider_message_id": msg.get("wamid") or event.get("id"),
                "from_number": user_phone,  # Map to the customer
                "to_number": bot_phone,
                "text": text or "[Media Manual]",
                "event_type": "whatsapp.message.echo",  # Critical for 24h Lock
                "correlation_id": correlation_id,
            }
            headers = {"X-Correlation-Id": correlation_id}
            if INTERNAL_SECRET_KEY:
                headers["X-Internal-Token"] = INTERNAL_SECRET_KEY

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
    secret = request.query_params.get("secret")
    tenant_id = request.query_params.get("tenant_id")

    if secret != INTERNAL_SECRET_KEY:
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

    is_private = event.get("private", False)
    message_type = event.get("message_type")  # incoming/outgoing
    sender_type = sender_data.get("type")  # contact/user/bot

    is_echo = False
    if message_type == "outgoing":
        is_echo = True
        # AI/Bot messages should be ignored to avoid loops
        if sender_type == "bot":
            return {"status": "ignored_bot_echo", "reason": "ai_message_ignore"}

    if is_private:
        return {"status": "ignored_private", "reason": "private_note"}

    # Protocol Omega: Human Echo detection
    # If it's outgoing and from a human agent, it's an echo.
    # We forward it to Orchestrator to trigger AI pause/handoff sync.

    # Detect Channel
    raw_channel = message_data.get("channel", "")
    channel_source = "whatsapp"
    if "Instagram" in raw_channel:
        channel_source = "instagram"
    elif "Facebook" in raw_channel:
        channel_source = "facebook"

    # Extract PSIDs and IDs
    # Protocol Omega: psid (source_id) is mandatory for social channels. If missing, fallback to sender id.
    psid = str(sender_data.get("source_id") or sender_data.get("id"))
    if not psid or psid == "None":
        # Last resort: use a stable identifier if possible, or fail gracefully
        psid = f"cw_contact_{sender_data.get('id') or 'unknown'}"

    chatwoot_conversation_id = message_data.get("id")
    chatwoot_account_id = event.get("account", {}).get("id")

    # Construct Orchestrator Payload (Nexus v4.0 Standard)
    payload = {
        "provider": "chatwoot",
        "event_id": str(event.get("id") or uuid.uuid4()),
        "provider_message_id": str(event.get("id") or uuid.uuid4()),
        "from_number": psid,  # Use PSID as identified in multitenant
        "to_number": "chatwoot_inbox_" + str(message_data.get("inbox_id", "0")),
        "text": content,
        "customer_name": sender_data.get("name"),
        "event_type": "chatwoot.message_created",
        "correlation_id": correlation_id,
        "channel_source": channel_source,
        "external_chatwoot_id": chatwoot_conversation_id,
        "external_account_id": chatwoot_account_id,
        "tenant_id": tenant_id,
        "message_type": message_type,  # Forwarding original type for echo detection
        "meta": {
            "chatwoot_inbox_id": message_data.get("inbox_id"),
            "channel_type": raw_channel,
        },
    }

    headers = {
        "X-Correlation-Id": correlation_id,
        "X-Internal-Token": INTERNAL_SECRET_KEY,
    }

    logger.info(
        "forwarding_chatwoot_to_orchestrator",
        channel=channel_source,
        conv_id=chatwoot_conversation_id,
    )

    try:
        await forward_to_orchestrator(payload, headers)
        return {"status": "forwarded", "correlation_id": correlation_id}
    except Exception as e:
        logger.error("chatwoot_forward_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to reach orchestrator")


@app.post("/messages/relay")
async def relay_message(msg: RelayMessage, request: Request):
    """
    Universal Relay Endpoint (Nexus v6.2.9).
    Centralizes all outbound communication for multi-channel stability.
    """
    token = request.headers.get("X-Internal-Token")
    if token != INTERNAL_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
    logger.info(
        "📡 RELAY: Received message",
        provider=msg.provider,
        channel=msg.channel_source,
        to=msg.to,
    )

    # Emergency Auto-Splitter (v6.2.10)
    # If the message is a wall of text, fragment it.
    parts = smart_split(msg.text)
    logger.info(
        "📦 RELAY: Message analyzed", bubbles=len(parts), original_length=len(msg.text)
    )

    try:
        for idx, text_part in enumerate(parts):
            # Spacing between auto-bubbles (Standard 4s)
            if idx > 0:
                logger.info(
                    "⏳ SPACING: Multi-bubble delay | bubbles_sent={}/{}".format(
                        idx, len(parts)
                    )
                )
                await asyncio.sleep(4)

            if msg.provider == "meta_direct":
                # 1. Fetch Credentials Directly
                # Consolidated Logic (Nexus v6.2.15): Relay talks directly to Meta Graph API
                # Eliminates 'meta_service' dependency for improved reliability.

                async with httpx.AsyncClient() as client:
                    if msg.channel_source == "whatsapp":
                        # Should usually go via YCloud, but if 'meta_direct' works for WA Cloud API:
                        phone_id = await get_config(
                            "WHATSAPP_PHONE_NUMBER_ID", tenant_id=msg.tenant_id
                        )
                        token_wa = await get_config(
                            "WHATSAPP_ACCESS_TOKEN", tenant_id=msg.tenant_id
                        )

                        if not phone_id or not token_wa:
                            logger.error(
                                "❌ RELAY: Missing Meta WA Credentials",
                                tenant_id=msg.tenant_id,
                            )
                            # Fallback to YCloud if credentials miss
                            raise Exception("Meta WhatsApp Credentials Missing")

                        url = f"https://graph.facebook.com/v22.0/{phone_id}/messages"
                        headers = {
                            "Authorization": f"Bearer {token_wa}",
                            "Content-Type": "application/json",
                        }
                        payload = {
                            "messaging_product": "whatsapp",
                            "recipient_type": "individual",
                            "to": msg.to,
                            "type": "text",
                            "text": {"body": text_part},
                        }

                        logger.info("📡 RELAY: Sending to WA Cloud API", url=url)
                        res = await client.post(
                            url, headers=headers, json=payload, timeout=10.0
                        )

                    else:
                        # Instagram / Facebook Page
                        page_token = await get_config(
                            "meta_page_token", tenant_id=msg.tenant_id
                        )
                        if not page_token:
                            # Try global fallback
                            page_token = await get_config("META_PAGE_TOKEN")

                        if not page_token:
                            logger.error(
                                "❌ RELAY: Missing Meta Page Token",
                                tenant_id=msg.tenant_id,
                            )
                            raise Exception("Meta Page Token Missing")

                        # Graph API URL for Page/IG Messages
                        url = "https://graph.facebook.com/v22.0/me/messages"
                        params = {"access_token": page_token}
                        # IG/FB Recipient is PSID
                        payload = {
                            "recipient": {"id": msg.to},
                            "message": {"text": text_part},
                            "messaging_type": "RESPONSE",
                        }

                        logger.info(
                            f"📡 RELAY: Sending to Meta Graph API ({msg.channel_source})",
                            url=url,
                            recipient=msg.to,
                        )
                        res = await client.post(
                            url, params=params, json=payload, timeout=10.0
                        )

                    if res.status_code not in [200, 201]:
                        logger.error(
                            "❌ RELAY: Meta Graph API Error",
                            status=res.status_code,
                            body=res.text,
                        )
                        raise Exception(f"Meta Platform Error: {res.text}")

            elif msg.provider == "chatwoot":
                cw_url = await get_config(
                    "CHATWOOT_BASE_URL",
                    "https://app.chatwoot.com",
                    tenant_id=msg.tenant_id,
                )
                if cw_url.endswith("/"):
                    cw_url = cw_url[:-1]

                cw_token = await get_config(
                    "CHATWOOT_API_TOKEN", tenant_id=msg.tenant_id
                )
                if not cw_token:
                    # Alias fallback (Nexus v6.2.17)
                    cw_token = await get_config(
                        "CHATWOOT_BOT_TOKEN", tenant_id=msg.tenant_id
                    )
                if not cw_token:
                    cw_token = await get_config(
                        "CHATWOOT_ACCESS_TOKEN", tenant_id=msg.tenant_id
                    )

                cw_account_id = msg.external_account_id or await get_config(
                    "CHATWOOT_ACCOUNT_ID", "1", tenant_id=msg.tenant_id
                )
                cw_conversation_id = msg.external_chatwoot_id

                if not cw_conversation_id or not cw_token:
                    # Enhanced Logging for v6.2.17
                    logger.error(
                        "❌ RELAY: Missing Chatwoot Context",
                        conv_id=cw_conversation_id,
                        has_token=bool(cw_token),
                        tenant=msg.tenant_id,
                    )
                    raise Exception("Missing Chatwoot Context (Conv/Token)")

                async with httpx.AsyncClient() as client:
                    cw_msg_url = f"{cw_url}/api/v1/accounts/{cw_account_id}/conversations/{cw_conversation_id}/messages"
                    logger.info("📡 RELAY: Sending to Chatwoot", url=cw_msg_url)
                    res = await client.post(
                        cw_msg_url,
                        json={"content": text_part, "message_type": "outgoing"},
                        headers={"api_access_token": cw_token},
                        timeout=10.0,
                    )
                    if res.status_code not in [200, 201]:
                        logger.error(
                            "❌ RELAY: Chatwoot Error",
                            status=res.status_code,
                            body=res.text,
                        )
                        raise Exception(f"Chatwoot Error: {res.text}")

            else:
                # Default: YCloud (WhatsApp Business API)
                v_ycloud = await get_config("YCLOUD_API_KEY", YCLOUD_API_KEY)
                # business_number = await get_config(f"WHATSAPP_PHONE_NUMBER_ID_{msg.tenant_id}") or "default"
                # Fix: Use tenant aware config
                phone_id_yc = (
                    await get_config(
                        "WHATSAPP_PHONE_NUMBER_ID", tenant_id=msg.tenant_id
                    )
                    or "default"
                )

                client_yc = YCloudClient(v_ycloud, phone_id_yc)
                await client_yc.send_text(msg.to, text_part, correlation_id)

        return {
            "status": "sent",
            "correlation_id": correlation_id,
            "bubbles_sent": len(parts),
        }

    except Exception as e:
        logger.error("relay_failed", error=str(e), correlation_id=correlation_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/messages/send")
async def send_message(message: SendMessage, request: Request):
    """
    Internal endpoint for sending manual messages from orchestrator.
    Left for legacy compatibility during migration.
    """
    token = request.headers.get("X-Internal-Token")
    if token != INTERNAL_SECRET_KEY:
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
        # WhatsApp Service is now a PURE YCloud Gateway (Nexus v6.0)
        # FB/IG routing is handled by the Orchestrator via Meta Service.

        v_ycloud = await get_config("YCLOUD_API_KEY", YCLOUD_API_KEY)

        # Meta-information for routing
        business_number = request.query_params.get("from_number")
        if not business_number:
            business_number = await get_config("YCLOUD_Phone_Number_ID")

        if not business_number:
            business_number = "default"

        # Initialize Client
        client = YCloudClient(v_ycloud, business_number)

        # Logic for media vs text
        if message.imageUrl:
            await client.send_image(message.to, message.imageUrl, correlation_id)

        if message.text:
            await client.send_text(message.to, message.text, correlation_id)

        return {"status": "sent_via_ycloud", "correlation_id": correlation_id}

    except Exception as e:
        logger.error(
            "manual_send_failed",
            error=str(e),
            channel=message.channel_source,
            correlation_id=correlation_id,
        )
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
