import os
import uuid
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from db import db, redis_client
from app.models.auth import User
from app.api.deps import get_current_user
from utils import encrypt_password, decrypt_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/voice-widget", tags=["voice-widget"])

# --- Constants ---
VOICE_MINUTES_BY_PLAN = {
    "pro": 60,
    "enterprise": 300,
}
VOICE_ADDON_PRICE = {
    "pro": 19,
    "enterprise": 39,
}
VOICE_OVERAGE_RATE = {
    "pro": 0.35,
    "enterprise": 0.25,
}

OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
NVIDIA_VOICES = ["magpie-tts-es", "magpie-tts-en", "magpie-tts-fr"]
DEEPGRAM_VOICES = [
    "aura-asteria", "aura-luna", "aura-stella", "aura-athena",
    "aura-hera", "aura-orion", "aura-arcas", "aura-perseus",
]

# --- Pydantic Schemas (inline, consistent with project patterns) ---

class VoiceWidgetCreate(BaseModel):
    agent_id: int
    widget_name: str = "Asistente de Voz"
    brand_color: str = "#8B5CF6"
    button_size: str = "md"
    button_position: str = "bottom-right"
    button_icon: str = "phone"
    avatar_url: Optional[str] = None
    welcome_message: str = "¡Hola! Toca para hablar conmigo."
    voice_provider: str = "openai"
    voice_model: str = "alloy"
    stt_provider: str = "openai"
    stt_model: str = "whisper-1"
    language: str = "es"
    voice_pipeline: str = "realtime"
    realtime_provider: str = "openai"
    system_prompt_override: Optional[str] = None
    temperature_override: Optional[float] = None
    max_call_duration: int = 300
    api_key_mode: str = "platform"
    is_active: bool = True


class VoiceWidgetUpdate(VoiceWidgetCreate):
    pass


# --- Helpers ---

async def _get_tenant_id(current_user: User) -> int:
    """Resolve tenant_id from current user."""
    if current_user.tenant_id:
        return current_user.tenant_id
    row = await db.pool.fetchrow(
        "SELECT id FROM tenants WHERE owner_email = $1 LIMIT 1",
        current_user.email
    )
    if not row:
        raise HTTPException(status_code=404, detail="No tenant found for user")
    return row["id"]


async def _check_plan_allows_voice(tenant_id: int, current_user: User = None):
    """Voice Widget only available for Pro/Enterprise plans. Super admins bypass."""
    if current_user and current_user.role == "super_admin":
        return "enterprise"  # super_admin gets full access

    row = await db.pool.fetchrow("""
        SELECT p.name as plan_name
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC LIMIT 1
    """, tenant_id)
    if not row or row["plan_name"] not in ("pro", "enterprise"):
        raise HTTPException(
            status_code=403,
            detail="Voice Widget is available on Pro and Enterprise plans. Upgrade at /billing."
        )
    return row["plan_name"]


def _generate_widget_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex[:32]


# --- CRUD Endpoints ---

@router.get("/config", dependencies=[Depends(get_current_user)])
async def list_voice_widgets(current_user: User = Depends(get_current_user)):
    """List all voice widget configs for the current tenant."""
    tenant_id = await _get_tenant_id(current_user)
    rows = await db.pool.fetch("""
        SELECT vw.*, a.name as agent_name, a.model_version as agent_model
        FROM voice_widget_configs vw
        LEFT JOIN agents a ON a.id = vw.agent_id
        WHERE vw.tenant_id = $1
        ORDER BY vw.created_at DESC
    """, tenant_id)
    return [dict(r) for r in rows]


@router.get("/config/{config_id}", dependencies=[Depends(get_current_user)])
async def get_voice_widget(config_id: int, current_user: User = Depends(get_current_user)):
    """Get a single voice widget config."""
    tenant_id = await _get_tenant_id(current_user)
    row = await db.pool.fetchrow("""
        SELECT vw.*, a.name as agent_name, a.model_version as agent_model,
               a.system_prompt_template as agent_system_prompt,
               a.enabled_tools as agent_tools
        FROM voice_widget_configs vw
        LEFT JOIN agents a ON a.id = vw.agent_id
        WHERE vw.id = $1 AND vw.tenant_id = $2
    """, config_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Voice widget not found")
    return dict(row)


@router.post("/config", dependencies=[Depends(get_current_user)])
async def create_voice_widget(body: VoiceWidgetCreate, current_user: User = Depends(get_current_user)):
    """Create a new voice widget config."""
    tenant_id = await _get_tenant_id(current_user)
    await _check_plan_allows_voice(tenant_id, current_user)

    # Validate agent belongs to tenant
    agent = await db.pool.fetchrow(
        "SELECT id, tenant_id FROM agents WHERE id = $1",
        body.agent_id
    )
    if not agent or agent["tenant_id"] != tenant_id:
        raise HTTPException(status_code=403, detail="Agent does not belong to your tenant")

    widget_token = _generate_widget_token()

    row = await db.pool.fetchrow("""
        INSERT INTO voice_widget_configs (
            tenant_id, agent_id, widget_name, brand_color, button_size, button_position,
            button_icon, avatar_url, welcome_message,
            voice_provider, voice_model, stt_provider, stt_model, language,
            voice_pipeline, realtime_provider,
            system_prompt_override, temperature_override, max_call_duration,
            api_key_mode, widget_token, is_active
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22
        ) RETURNING *
    """,
        tenant_id, body.agent_id, body.widget_name, body.brand_color,
        body.button_size, body.button_position, body.button_icon,
        body.avatar_url, body.welcome_message,
        body.voice_provider, body.voice_model, body.stt_provider,
        body.stt_model, body.language, body.voice_pipeline,
        body.realtime_provider, body.system_prompt_override,
        body.temperature_override, body.max_call_duration,
        body.api_key_mode, widget_token, body.is_active
    )
    logger.info("voice_widget_created", tenant_id=tenant_id, widget_id=row["id"])
    return dict(row)


@router.put("/config/{config_id}", dependencies=[Depends(get_current_user)])
async def update_voice_widget(config_id: int, body: VoiceWidgetUpdate, current_user: User = Depends(get_current_user)):
    """Update a voice widget config."""
    tenant_id = await _get_tenant_id(current_user)

    existing = await db.pool.fetchrow(
        "SELECT id FROM voice_widget_configs WHERE id = $1 AND tenant_id = $2",
        config_id, tenant_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Voice widget not found")

    # Validate agent belongs to tenant
    agent = await db.pool.fetchrow(
        "SELECT id, tenant_id FROM agents WHERE id = $1",
        body.agent_id
    )
    if not agent or agent["tenant_id"] != tenant_id:
        raise HTTPException(status_code=403, detail="Agent does not belong to your tenant")

    row = await db.pool.fetchrow("""
        UPDATE voice_widget_configs SET
            agent_id = $1, widget_name = $2, brand_color = $3, button_size = $4,
            button_position = $5, button_icon = $6, avatar_url = $7,
            welcome_message = $8, voice_provider = $9, voice_model = $10,
            stt_provider = $11, stt_model = $12, language = $13,
            voice_pipeline = $14, realtime_provider = $15,
            system_prompt_override = $16, temperature_override = $17,
            max_call_duration = $18, api_key_mode = $19, is_active = $20,
            updated_at = NOW()
        WHERE id = $21 AND tenant_id = $22
        RETURNING *
    """,
        body.agent_id, body.widget_name, body.brand_color, body.button_size,
        body.button_position, body.button_icon, body.avatar_url,
        body.welcome_message, body.voice_provider, body.voice_model,
        body.stt_provider, body.stt_model, body.language,
        body.voice_pipeline, body.realtime_provider,
        body.system_prompt_override, body.temperature_override,
        body.max_call_duration, body.api_key_mode, body.is_active,
        config_id, tenant_id
    )
    logger.info("voice_widget_updated", tenant_id=tenant_id, widget_id=config_id)
    return dict(row)


@router.delete("/config/{config_id}", dependencies=[Depends(get_current_user)])
async def delete_voice_widget(config_id: int, current_user: User = Depends(get_current_user)):
    """Delete a voice widget config."""
    tenant_id = await _get_tenant_id(current_user)
    result = await db.pool.execute(
        "DELETE FROM voice_widget_configs WHERE id = $1 AND tenant_id = $2",
        config_id, tenant_id
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Voice widget not found")
    logger.info("voice_widget_deleted", tenant_id=tenant_id, widget_id=config_id)
    return {"status": "deleted"}


# --- Providers Endpoint (T5) ---

@router.get("/providers", dependencies=[Depends(get_current_user)])
async def get_available_providers(current_user: User = Depends(get_current_user)):
    """Return available voice providers based on tenant's API keys in credentials."""
    tenant_id = await _get_tenant_id(current_user)

    # Check which API keys the tenant has
    creds = await db.pool.fetch(
        "SELECT category, name FROM credentials WHERE tenant_id = $1",
        tenant_id
    )
    categories = {r["category"] for r in creds}
    cred_names = {r["name"] for r in creds}

    has_openai = "openai" in categories or "OPENAI_API_KEY" in cred_names
    has_nvidia = "nvidia" in categories or "NGC_API_KEY" in cred_names
    has_elevenlabs = "elevenlabs" in categories or "ELEVENLABS_API_KEY" in cred_names
    has_deepgram = "deepgram" in categories or "DEEPGRAM_API_KEY" in cred_names

    # Also check for platform-level OpenAI key (always available)
    platform_openai = bool(os.getenv("OPENAI_API_KEY"))

    realtime_providers = []
    tts_providers = []
    stt_providers = []
    voices: Dict[str, list] = {}

    if has_openai or platform_openai:
        realtime_providers.append("openai")
        tts_providers.append("openai")
        stt_providers.append("openai")
        voices["openai"] = OPENAI_VOICES

    if has_nvidia:
        realtime_providers.append("nvidia")
        tts_providers.append("nvidia")
        stt_providers.append("nvidia")
        voices["nvidia"] = NVIDIA_VOICES

    if has_elevenlabs:
        tts_providers.append("elevenlabs")
        voices["elevenlabs"] = []  # loaded dynamically from ElevenLabs API

    if has_deepgram:
        tts_providers.append("deepgram")
        stt_providers.append("deepgram")
        voices["deepgram"] = DEEPGRAM_VOICES

    return {
        "realtime_providers": realtime_providers,
        "tts_providers": tts_providers,
        "stt_providers": stt_providers,
        "voices": voices,
        "has_keys": {
            "openai": has_openai or platform_openai,
            "nvidia": has_nvidia,
            "elevenlabs": has_elevenlabs,
            "deepgram": has_deepgram,
        }
    }


# --- Usage Endpoint (T6) ---

@router.get("/usage", dependencies=[Depends(get_current_user)])
async def get_voice_usage(current_user: User = Depends(get_current_user)):
    """Return voice minutes consumption for current billing period."""
    tenant_id = await _get_tenant_id(current_user)

    # Get current plan
    sub = await db.pool.fetchrow("""
        SELECT p.name as plan_name, s.current_period_start, s.current_period_end
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC LIMIT 1
    """, tenant_id)

    plan_name = sub["plan_name"] if sub else "free"
    minutes_included = VOICE_MINUTES_BY_PLAN.get(plan_name, 0)

    # Calculate period bounds
    if sub and sub["current_period_start"]:
        period_start = sub["current_period_start"]
        period_end = sub["current_period_end"]
    else:
        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = (period_start + timedelta(days=32)).replace(day=1)

    # Sum usage for platform mode only
    usage_row = await db.pool.fetchrow("""
        SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds
        FROM voice_usage_records
        WHERE tenant_id = $1
          AND api_key_mode = 'platform'
          AND created_at >= $2
          AND created_at < $3
    """, tenant_id, period_start, period_end)

    total_seconds = usage_row["total_seconds"] if usage_row else 0
    minutes_used = round(total_seconds / 60.0, 1)
    minutes_remaining = max(0, minutes_included - minutes_used)
    overage_minutes = max(0, minutes_used - minutes_included)

    return {
        "plan": plan_name,
        "voice_minutes_included": minutes_included,
        "voice_minutes_used": minutes_used,
        "voice_minutes_remaining": minutes_remaining,
        "overage_minutes": round(overage_minutes, 1),
        "overage_rate": VOICE_OVERAGE_RATE.get(plan_name, 0),
        "addon_price": VOICE_ADDON_PRICE.get(plan_name, 0),
        "billing_period_end": period_end.isoformat() if period_end else None,
    }


# --- Public Endpoints (T15) ---

from fastapi import APIRouter as _AR
public_router = APIRouter(prefix="/public/voice-widget", tags=["voice-widget-public"])


@public_router.get("/{widget_token}")
async def get_public_widget_config(widget_token: str):
    """Public endpoint consumed by the embeddable SDK. Returns sanitized config."""
    row = await db.pool.fetchrow("""
        SELECT vw.widget_name, vw.brand_color, vw.button_size, vw.button_position,
               vw.button_icon, vw.avatar_url, vw.welcome_message,
               vw.voice_model, vw.language, vw.is_active,
               t.bot_phone_number as whatsapp_number
        FROM voice_widget_configs vw
        JOIN tenants t ON t.id = vw.tenant_id
        WHERE vw.widget_token = $1
    """, widget_token)

    if not row or not row["is_active"]:
        raise HTTPException(status_code=404, detail="Widget not found")

    return {
        "widget_name": row["widget_name"],
        "brand_color": row["brand_color"],
        "button_size": row["button_size"],
        "button_position": row["button_position"],
        "button_icon": row["button_icon"],
        "avatar_url": row["avatar_url"],
        "welcome_message": row["welcome_message"],
        "voice_model": row["voice_model"],
        "language": row["language"],
        "whatsapp_number": row["whatsapp_number"],
    }


@public_router.post("/{widget_token}/session")
async def create_voice_session(widget_token: str, request: Request):
    """Create an ephemeral voice session. Rate-limited by IP."""
    visitor_ip = request.client.host if request.client else "unknown"

    # Check IP not blocked for abuse
    blocked = await redis_client.get(f"voice_blocked:{widget_token}:{visitor_ip}")
    if blocked:
        raise HTTPException(
            status_code=403,
            detail="blocked_abuse"
        )

    # Rate limiting: 10 sessions/min per IP
    rate_key = f"voice_rate:{visitor_ip}"
    current = await redis_client.get(rate_key)
    if current and int(current) >= 10:
        raise HTTPException(status_code=429, detail="Too many sessions. Try again later.")
    pipe = redis_client.pipeline()
    pipe.incr(rate_key)
    pipe.expire(rate_key, 60)
    await pipe.execute()

    # Validate widget
    widget = await db.pool.fetchrow("""
        SELECT vw.*, a.system_prompt_template, a.enabled_tools, a.model_provider,
               a.model_version, a.temperature,
               t.bot_phone_number, t.store_website
        FROM voice_widget_configs vw
        JOIN agents a ON a.id = vw.agent_id
        JOIN tenants t ON t.id = vw.tenant_id
        WHERE vw.widget_token = $1 AND vw.is_active = true
    """, widget_token)

    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found or inactive")

    tenant_id = widget["tenant_id"]

    # Check minutes if platform mode
    if widget["api_key_mode"] == "platform":
        sub = await db.pool.fetchrow("""
            SELECT p.name as plan_name FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.tenant_id = $1 AND s.status = 'active'
            ORDER BY s.created_at DESC LIMIT 1
        """, tenant_id)
        plan_name = sub["plan_name"] if sub else "free"
        minutes_included = VOICE_MINUTES_BY_PLAN.get(plan_name, 0)

        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        usage = await db.pool.fetchval("""
            SELECT COALESCE(SUM(duration_seconds), 0)
            FROM voice_usage_records
            WHERE tenant_id = $1 AND api_key_mode = 'platform' AND created_at >= $2
        """, tenant_id, period_start)
        minutes_used = (usage or 0) / 60.0
        if minutes_used >= minutes_included:
            raise HTTPException(status_code=403, detail="minutes_exhausted")

    # Resolve API key
    api_key = None
    if widget["api_key_mode"] == "byok":
        provider = widget["realtime_provider"]
        if provider == "nvidia":
            key_row = await db.pool.fetchrow(
                "SELECT value FROM credentials WHERE tenant_id = $1 AND (category = 'nvidia' OR name = 'NGC_API_KEY') LIMIT 1",
                tenant_id
            )
        else:
            key_row = await db.pool.fetchrow(
                "SELECT value FROM credentials WHERE tenant_id = $1 AND (category = 'openai' OR name = 'OPENAI_API_KEY') LIMIT 1",
                tenant_id
            )
        if key_row:
            api_key = decrypt_password(key_row["value"])
    else:
        # Platform mode: use global OpenAI key
        api_key = os.getenv("OPENAI_API_KEY", "")

    # Build session data
    system_prompt = widget["system_prompt_override"] or widget["system_prompt_template"]
    # Inject abuse detection instruction
    abuse_instruction = (
        "\n\nREGLA CRÍTICA: Si el usuario habla sobre temas NO relacionados con la tienda, "
        "productos o servicios del negocio, responde EXACTAMENTE con el prefijo [ABUSE_DETECTED] "
        'seguido de: "Esta conversación no está relacionada con nuestro negocio. Voy a finalizar la llamada."'
    )
    system_prompt = system_prompt + abuse_instruction

    session_id = uuid.uuid4().hex
    tools = widget["enabled_tools"] if isinstance(widget["enabled_tools"], list) else json.loads(widget["enabled_tools"] or "[]")

    session_data = {
        "widget_id": widget["id"],
        "agent_id": widget["agent_id"],
        "tenant_id": tenant_id,
        "voice_model": widget["voice_model"],
        "voice_pipeline": widget["voice_pipeline"],
        "realtime_provider": widget["realtime_provider"],
        "system_prompt": system_prompt,
        "tools": tools,
        "api_key": api_key,
        "api_key_mode": widget["api_key_mode"],
        "max_duration": widget["max_call_duration"],
        "whatsapp_number": widget["bot_phone_number"],
        "store_url": widget["store_website"],
        "visitor_ip": visitor_ip,
        "language": widget["language"],
    }

    ttl = widget["max_call_duration"] + 60
    await redis_client.setex(
        f"voice_session:{session_id}",
        ttl,
        json.dumps(session_data)
    )

    # Build WS URL
    ws_scheme = "wss" if request.url.scheme == "https" else "ws"
    ws_url = f"{ws_scheme}://{request.url.hostname}:{request.url.port or ''}/public/voice-widget/ws/{session_id}"

    logger.info("voice_session_created", tenant_id=tenant_id, session_id=session_id)
    return {
        "session_id": session_id,
        "ws_url": ws_url,
        "max_duration": widget["max_call_duration"],
    }
