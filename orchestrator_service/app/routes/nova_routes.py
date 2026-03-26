import os
import json
import logging
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Body, HTTPException
from db import db, redis_client
from app.models.auth import User
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/nova", tags=["nova"])


# --- Context Endpoint (static checks, $0 cost) ---

@router.get("/context")
async def get_nova_context(page: str = "dashboard", current_user: User = Depends(get_current_user)):
    """Returns Nova's context for the current page. Static SQL checks only — no AI tokens used."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        return {"page": page, "checks": [], "stats": {}, "greeting": "Hola! En que te puedo ayudar?"}

    checks = []

    # --- Products checks ---
    try:
        product_count = await db.pool.fetchval(
            "SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true", tenant_id) or 0
    except Exception:
        product_count = 0

    # Also check TN products via agents config
    has_tn = await db.pool.fetchval(
        "SELECT COUNT(*) FROM credentials WHERE tenant_id = $1 AND (name LIKE '%TIENDANUBE%' OR category = 'tiendanube')", tenant_id) or 0

    if product_count == 0 and not has_tn:
        checks.append({"type": "warning", "icon": "package", "message": "No tenes productos cargados. Puedo ayudarte a cargar los primeros ahora mismo.", "action": "cargar_productos"})

    if product_count > 0:
        try:
            no_photo = await db.pool.fetchval(
                "SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true AND (images IS NULL OR images = '[]'::jsonb)", tenant_id) or 0
            no_stock = await db.pool.fetchval(
                "SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true AND stock = 0", tenant_id) or 0
            if no_photo > 0:
                checks.append({"type": "suggestion", "icon": "image", "message": f"Tenes {no_photo} productos sin foto. Las fotos aumentan 40% las ventas.", "action": "agregar_fotos"})
            if no_stock > 0:
                checks.append({"type": "alert", "icon": "alert-triangle", "message": f"Tenes {no_stock} productos sin stock.", "action": "actualizar_stock"})
        except Exception:
            no_photo = 0
            no_stock = 0
    else:
        no_photo = 0
        no_stock = 0

    # --- Agent checks ---
    agent = await db.pool.fetchrow(
        "SELECT id, name, system_prompt_template FROM agents WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1", tenant_id)

    if not agent:
        checks.append({"type": "warning", "icon": "bot", "message": "No tenes un agente configurado. Queres crear uno?", "action": "crear_agente"})
    elif agent and len(agent["system_prompt_template"] or "") < 200:
        checks.append({"type": "suggestion", "icon": "sparkles", "message": "Tu system prompt es muy corto. Un prompt mas detallado mejora las respuestas.", "action": "mejorar_prompt"})

    # --- Channels checks ---
    has_meta = await db.pool.fetchval(
        "SELECT COUNT(*) FROM business_assets WHERE tenant_id = $1 AND is_active = true", str(tenant_id)) or 0
    has_ycloud = await db.pool.fetchval(
        "SELECT COUNT(*) FROM credentials WHERE tenant_id = $1 AND category = 'whatsapp_cloud'", tenant_id) or 0

    if not has_meta and not has_ycloud:
        checks.append({"type": "warning", "icon": "link", "message": "No tenes canales conectados. Sin WhatsApp o Instagram, el agente no puede responder.", "action": "conectar_canales"})

    # --- Knowledge checks ---
    docs_count = await db.pool.fetchval(
        "SELECT COUNT(*) FROM rag_documents WHERE tenant_id = $1 AND status = 'active'", tenant_id) or 0

    if docs_count == 0:
        checks.append({"type": "suggestion", "icon": "database", "message": "Tu base de conocimiento esta vacia. Subi documentos para que el agente responda con mas contexto.", "action": "subir_docs"})

    # --- Plan checks ---
    sub = await db.pool.fetchrow("""
        SELECT p.name as plan_name, s.current_period_end
        FROM subscriptions s JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = $1 AND s.status = 'active'
        ORDER BY s.created_at DESC LIMIT 1
    """, tenant_id)

    plan_name = sub["plan_name"] if sub else "free"
    days_left = None
    if sub and sub["current_period_end"]:
        days_left = max(0, (sub["current_period_end"] - datetime.utcnow()).days)
        if days_left <= 3 and plan_name == "free":
            checks.append({"type": "alert", "icon": "clock", "message": f"Tu prueba gratis vence en {days_left} dias. Suscribite para no perder acceso.", "action": "ver_planes"})

    # --- Conversations stats (quick) ---
    conv_today = await db.pool.fetchval("""
        SELECT COUNT(*) FROM chat_conversations
        WHERE tenant_id = $1 AND updated_at >= CURRENT_DATE
    """, tenant_id) or 0

    derivations_today = await db.pool.fetchval("""
        SELECT COUNT(*) FROM chat_messages
        WHERE tenant_id = $1 AND role = 'assistant'
        AND content ILIKE '%deriv%humano%'
        AND created_at >= CURRENT_DATE
    """, tenant_id) or 0

    # --- Daily summary from Redis ---
    daily_summary = None
    try:
        raw = await redis_client.get(f"nova_daily:{tenant_id}")
        if raw:
            daily_summary = json.loads(raw)
    except Exception:
        pass

    # --- Build greeting ---
    greeting = _build_greeting(page, checks, conv_today, derivations_today, agent)

    return {
        "page": page,
        "checks": checks,
        "stats": {
            "products": product_count,
            "products_no_photo": no_photo,
            "products_no_stock": no_stock,
            "documents": docs_count,
            "has_channels": bool(has_meta or has_ycloud),
            "has_tn": bool(has_tn),
            "has_agent": bool(agent),
            "agent_name": agent["name"] if agent else None,
            "plan": plan_name,
            "days_left": days_left,
            "conversations_today": conv_today,
            "derivations_today": derivations_today,
        },
        "daily_summary": daily_summary,
        "greeting": greeting,
    }


def _build_greeting(page, checks, conv_today, derivations_today, agent):
    """Build Nova's proactive first message."""
    # Priority: checks first
    if checks:
        top = checks[0]
        return top["message"]

    # Page-specific greetings with real data
    if page == "dashboard":
        if conv_today > 0:
            msg = f"Hoy tuviste {conv_today} conversaciones."
            if derivations_today > 0:
                msg += f" {derivations_today} se derivaron a humano."
            return msg
        return "Todo tranquilo por aca. En que te puedo ayudar?"

    if page == "products":
        return "Aca tenes tu catalogo. Queres agregar o editar algo?"

    if page == "agents":
        if agent:
            return f"Tu agente '{agent['name']}' esta activo. Queres ajustar algo del prompt?"
        return "Vamos a configurar tu agente. Arrancamos?"

    if page == "chats":
        if conv_today > 0:
            return f"{conv_today} conversaciones hoy. Alguna que quieras revisar?"
        return "No hubo conversaciones hoy. Todo bien por aca."

    if page == "analytics":
        return "Aca tenes tus metricas. Queres que te haga un resumen?"

    if page == "knowledge":
        return "Esta es tu base de conocimiento. Queres subir algo?"

    if page == "settings":
        return "Aca podes configurar tus conexiones. Necesitas ayuda?"

    if page == "billing":
        return "Aca podes ver tu plan y facturacion."

    return "Hola! Soy Nova, tu asistente. En que te puedo ayudar?"


# --- Nova Realtime Session ---

@router.post("/session")
async def create_nova_session(
    page: str = Body("dashboard", embed=True),
    tenant_id: int = Body(0, embed=True),
    context_summary: str = Body("", embed=True),
    current_user: User = Depends(get_current_user),
):
    """Create OpenAI Realtime session for Nova widget."""
    tid = tenant_id or (current_user.tenant_id if hasattr(current_user, 'tenant_id') else 0)

    # Resolve API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        try:
            from app.core.config import settings
            api_key = settings.OPENAI_API_KEY
        except Exception:
            pass
    if not api_key:
        raise HTTPException(status_code=500, detail="Platform API key not configured")

    # Build Nova's system prompt for the widget
    system_prompt = f"""IDIOMA OBLIGATORIO: Espanol argentino. Voseo (vos, sos, tenes). NUNCA cambies de idioma.

Sos Nova, la asistente inteligente de Future Platform. Estas en la pagina: {page}.

PERSONALIDAD: Sos proactiva, directa y util. No esperes que te pregunten — DECI que hacer. Sos una co-piloto de negocio.

CONTEXTO ACTUAL DEL USUARIO:
{context_summary}

TOOLS DISPONIBLES — USALAS:
- ir_a_pagina: Navegar a otra pagina (products, agents, chats, analytics, knowledge, settings, billing, onboarding-wizard)
- ver_productos: Ver resumen del catalogo
- ver_errores_agente: Ver ultimas derivaciones y errores
- ver_conexiones: Estado de canales conectados
- ver_plan: Plan actual y dias restantes
- modificar_prompt: Agregar o editar una seccion del system prompt del agente
- agregar_regla: Agregar regla de negocio al agente

REGLAS:
- Se BREVE. Maximo 3 oraciones por respuesta.
- Cada respuesta termina con una sugerencia o accion concreta.
- Si el usuario pide algo que requiere una tool, USALA.
- Si no sabes algo, deci "dejame verificar" y usa la tool correspondiente.
"""

    session_id = uuid.uuid4().hex
    session_data = {
        "type": "nova_widget",
        "page": page,
        "tenant_id": tid,
        "api_key": api_key,
        "system_prompt": system_prompt,
        "voice": "coral",
        "max_duration": 300,  # 5 min per widget session
    }

    await redis_client.setex(
        f"nova_widget_session:{session_id}",
        360,
        json.dumps(session_data)
    )

    return {"session_id": session_id, "page": page}
