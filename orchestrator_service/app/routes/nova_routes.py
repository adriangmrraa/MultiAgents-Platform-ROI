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

    # --- Health score (quick inline) ---
    health_score = 0
    if agent: health_score += 15
    if agent and len(agent["system_prompt_template"] or "") > 1000: health_score += 10
    if has_meta or has_ycloud: health_score += 15
    if product_count > 0 or has_tn: health_score += 15
    if docs_count > 0: health_score += 10
    if conv_today > 0: health_score += 10

    # --- Build greeting ---
    greeting = _build_greeting(page, checks, conv_today, derivations_today, agent, health_score)

    return {
        "page": page,
        "checks": checks,
        "health_score": min(100, health_score),
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


def _build_greeting(page, checks, conv_today, derivations_today, agent, health_score=50):
    """Build Nova's proactive greeting — warm, actionable, not just repeating checks."""
    agent_name = None
    try:
        agent_name = agent["name"] if agent else None
    except (KeyError, TypeError):
        pass

    # Critical alerts: direct and urgent
    alerts = [c for c in checks if c["type"] == "alert"] if checks else []
    if alerts:
        return f"Ey! Algo urgente: {alerts[0]['message']}. Queres que te ayude a resolverlo?"

    # First-time / low score: introduce Nova and suggest quick wins
    if health_score < 40:
        return f"Hola! Soy Nova, tu copiloto de negocio. Tu score esta en {health_score}/100 — hay cosas rapidas que podemos mejorar juntos. Por donde arrancamos?"

    # Score-aware but page-specific (warm tone)
    if page == "dashboard":
        parts = []
        if agent_name:
            parts.append(f"Tu agente '{agent_name}' esta activo")
        if conv_today > 0:
            parts.append(f"{conv_today} conversaciones hoy")
            if derivations_today > 0:
                parts.append(f"{derivations_today} derivadas a humano")
        if parts:
            summary = ". ".join(parts) + "."
            # Add one quick suggestion if available
            suggestions = [c for c in checks if c["type"] == "suggestion"] if checks else []
            if suggestions:
                return f"{summary} Tip rapido: {suggestions[0]['message']}"
            return f"{summary} Todo marchando. En que te ayudo?"
        # No activity
        warnings = [c for c in checks if c["type"] == "warning"] if checks else []
        if warnings:
            return f"Hola! Hoy esta tranquilo. Aprovechemos para mejorar: {warnings[0]['message']}"
        return "Hola! Soy Nova, tu asistente de negocio. Puedo ayudarte con productos, agente, canales, analytics — decime que necesitas."

    if page == "products":
        return "Este es tu catalogo. Puedo ayudarte a agregar productos, actualizar stock o importar desde CSV. Que necesitas?"

    if page == "agents":
        if agent_name:
            return f"'{agent_name}' esta en linea. Puedo ajustar el prompt, agregar reglas o mejorar el diccionario. Que hacemos?"
        return "Todavia no tenes un agente. Queres que te ayude a crear uno?"

    if page == "chats":
        if conv_today > 0:
            return f"{conv_today} conversaciones hoy. Puedo buscar una especifica o mostrarte las que tuvieron problemas."
        return "Sin conversaciones hoy. Puedo ayudarte a revisar las de ayer si queres."

    if page == "analytics":
        return "Aca estan tus metricas. Puedo hacerte un resumen rapido de la semana o comparar periodos."

    if page == "knowledge":
        return "Esta es tu base de conocimiento. Puedo guiarte para subir documentos, PDFs o texto que el agente use como referencia."

    if page == "settings":
        return "Aca podes configurar canales, integraciones y conexiones. Necesitas ayuda con algo?"

    if page == "billing":
        return "Tu plan y facturacion. Puedo explicarte las diferencias entre planes si queres."

    if page == "voice-widget":
        return "El voice widget es un asistente de voz para tu tienda. Puedo ayudarte a configurarlo."

    return "Hola! Soy Nova, tu copiloto de negocio. Puedo ayudarte con productos, agente, canales, analytics y mas. Decime que necesitas."


# --- Nova Realtime Session ---

@router.post("/session")
async def create_nova_session(
    page: str = Body("dashboard", embed=True),
    tenant_id: int = Body(0, embed=True),
    context_summary: str = Body("", embed=True),
    current_user: User = Depends(get_current_user),
):
    """Create OpenAI Realtime session for Nova widget."""
    # Security: always use authenticated user's tenant_id, ignore body param
    tid = current_user.tenant_id if hasattr(current_user, 'tenant_id') else 0

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

Sos Nova, la copiloto operativa de Future Platform para e-commerce. Pagina actual: {page}.

QUIEN SOS:
El dueno de la tienda online te usa para operar TODO por voz: gestionar productos, editar el agente de ventas, ver conversaciones, analizar metricas, configurar canales, subir knowledge, y mas. Sos su mano derecha.

CONTEXTO ACTUAL:
{context_summary}

HERRAMIENTAS DISPONIBLES — USALAS SIEMPRE:

📦 PRODUCTOS (Tienda Nube o catalogo interno):
- agregar_producto: Crear producto (nombre, precio, descripcion, categoria, stock, variantes)
- editar_producto: Editar producto existente (cualquier campo)
- eliminar_producto: Eliminar producto
- listar_productos: Ver catalogo con filtros por categoria
- actualizar_stock: Actualizar stock de un producto

🤖 AGENTE DE VENTAS:
- modificar_prompt: Editar una seccion del system prompt del agente (identidad, tono, reglas, etc.)
- agregar_regla: Agregar regla de negocio al agente (ej: "no dar descuentos mayores al 15%")
- agregar_sinonimo: Agregar sinonimos al diccionario del agente (ej: "remera" = "camiseta" = "playera")
- ver_prompt_actual: Ver el prompt actual del agente con resumen por seccion
- ver_errores_agente: Ver ultimas derivaciones y errores del agente (que no supo responder)

🔍 INVESTIGACION:
- investigar_web: Scrapea una URL para extraer info del negocio (productos, precios, politicas)

🧭 NAVEGACION:
- ir_a_pagina: Navegar a products, agents, chats, analytics, knowledge, settings, billing, onboarding-wizard, voice-widget, forge

⚙️ CONFIGURACION:
- guardar_identidad: Guardar seccion de identidad del agente
- guardar_tono: Guardar seccion de tono y personalidad
- guardar_reglas: Guardar seccion de reglas de negocio
- guardar_diccionario: Guardar diccionario de sinonimos

FLUJOS CONVERSACIONALES INTELIGENTES:

=== AGREGAR PRODUCTO ===
Si el dueno dice "quiero agregar un producto":
1. Preguntar: "Decime nombre, precio y categoria"
2. agregar_producto con los datos
3. Preguntar: "Tiene variantes (talles, colores)? Cuanto stock?"
4. Si da variantes → editar_producto para agregarlas
5. Confirmar: "Producto '{nombre}' creado a ${precio}. Queres agregar otro?"

=== MEJORAR EL AGENTE ===
Si dice "el agente no responde bien sobre envios" o "quiero que el agente sepa X":
1. ver_errores_agente para ver donde falla
2. Proponer regla: "Agrego esta regla: 'Envios gratis a partir de $50.000'?"
3. Si confirma → agregar_regla
4. Si quiere mas → ver_prompt_actual para mostrar que secciones tiene

=== ACTUALIZAR STOCK ===
Si dice "actualiza el stock de X" o "se acabo X":
1. listar_productos para encontrar el producto
2. actualizar_stock con el nuevo valor
3. Confirmar: "Stock de '{nombre}' actualizado a {cantidad}."

=== INVESTIGAR COMPETENCIA / PROVEEDOR ===
Si dice "fijate en esta pagina" o da una URL:
1. investigar_web con la URL
2. Mostrar resumen de lo encontrado
3. Proponer: "Queres que agregue estos productos al catalogo?"

=== VER COMO VA EL NEGOCIO ===
Si dice "como estamos?" o "como va?":
1. El contexto ya tiene el health_score y stats
2. Responder con datos concretos: "{N} conversaciones hoy, {M} derivaciones"
3. Proponer mejora: "El agente derivo {M} veces. Queres que vea los errores?"

REGLA DE ORO: SOS PROACTIVA. Si el dueno no te da un dato, VOS lo resolves:
- Sin precio → "a que precio lo pongo?"
- Sin categoria → asumi la mas logica segun el nombre
- Sin stock → asumi stock ilimitado
- NUNCA te quedes esperando. Propone y ejecuta.

REGLAS:
- BREVE pero COMPLETA. 2-4 oraciones.
- Cada respuesta termina con accion concreta o pregunta.
- Si tenes suficiente info para ejecutar, EJECUTA sin pedir confirmacion extra.
- Despues de cada accion, ofrece la siguiente logica.
- NUNCA inventes datos de productos o ventas — siempre usa las tools.
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

    try:
        await redis_client.setex(
            f"nova_widget_session:{session_id}",
            360,
            json.dumps(session_data)
        )
    except Exception as e:
        logger.error(f"nova_session_redis_error: {e}")
        raise HTTPException(status_code=503, detail="Cache unavailable")

    return {"session_id": session_id, "page": page}


# --- Health Check (static SQL, $0) ---

@router.get("/health-check")
async def health_check(current_user: User = Depends(get_current_user)):
    """Complete business health check. All SQL — no AI tokens used."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        return {"score": 0, "checks": [], "completed": []}

    checks = []
    completed = []
    score = 0

    # 1. Agent (15 pts)
    agent = await db.pool.fetchrow(
        "SELECT id, name, LENGTH(system_prompt_template) as prompt_len FROM agents WHERE tenant_id = $1 AND is_active = true LIMIT 1", tenant_id)
    if agent:
        score += 15
        completed.append("Agente configurado")
    else:
        checks.append({"type": "warning", "icon": "bot", "message": "No tenes un agente configurado.", "action": "crear_agente", "weight": 15})

    # 2. Prompt quality (20 pts)
    if agent:
        plen = agent["prompt_len"] or 0
        prompt_text = ""
        if plen > 0:
            row = await db.pool.fetchrow("SELECT system_prompt_template FROM agents WHERE id = $1", agent["id"])
            prompt_text = row["system_prompt_template"] or "" if row else ""

        if plen > 1000:
            score += 10
            completed.append("Prompt detallado")
        elif plen > 200:
            score += 5
            checks.append({"type": "suggestion", "icon": "sparkles", "message": "Tu prompt podria ser mas detallado. Los prompts largos mejoran las respuestas.", "action": "mejorar_prompt", "weight": 5})
        else:
            checks.append({"type": "warning", "icon": "sparkles", "message": "Tu prompt es muy corto. Necesita mas reglas y contexto.", "action": "mejorar_prompt", "weight": 10})

        if "REGLA" in prompt_text.upper() or "## 8" in prompt_text:
            score += 5
            completed.append("Reglas de negocio")
        else:
            checks.append({"type": "suggestion", "icon": "shield", "message": "Tu prompt no tiene reglas de negocio definidas.", "action": "mejorar_prompt", "weight": 5})

        if "DICCIONARIO" in prompt_text.upper() or "SINONIMO" in prompt_text.upper():
            score += 5
            completed.append("Diccionario de sinonimos")
        else:
            checks.append({"type": "suggestion", "icon": "book", "message": "Falta un diccionario de sinonimos. Los clientes usan jerga que el agente no entiende.", "action": "mejorar_prompt", "weight": 5})

    # 3. Channels (15 pts)
    has_meta = await db.pool.fetchval("SELECT COUNT(*) FROM business_assets WHERE tenant_id = $1 AND is_active = true", str(tenant_id)) or 0
    has_ycloud = await db.pool.fetchval("SELECT COUNT(*) FROM credentials WHERE tenant_id = $1 AND category = 'whatsapp_cloud'", tenant_id) or 0
    if has_meta or has_ycloud:
        score += 15
        completed.append("Canales conectados")
    else:
        checks.append({"type": "warning", "icon": "link", "message": "Sin canales conectados. El agente no puede recibir mensajes.", "action": "conectar_canales", "weight": 15})

    # 4. Products (15 pts)
    try:
        internal_count = await db.pool.fetchval("SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true", tenant_id) or 0
    except Exception:
        internal_count = 0

    has_tn = await db.pool.fetchval("SELECT COUNT(*) FROM credentials WHERE tenant_id = $1 AND (name LIKE '%TIENDANUBE%' OR category = 'tiendanube')", tenant_id) or 0

    if internal_count > 0 or has_tn:
        score += 15
        completed.append(f"Productos ({internal_count} internos" + (", TN conectado" if has_tn else "") + ")")

        # Photos check (5 pts)
        if internal_count > 0:
            no_photo = await db.pool.fetchval("SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true AND (images IS NULL OR images = '[]'::jsonb)", tenant_id) or 0
            if no_photo == 0:
                score += 5
                completed.append("Productos con fotos")
            elif no_photo > 0:
                checks.append({"type": "suggestion", "icon": "image", "message": f"{no_photo} productos sin foto. Las fotos aumentan 40% las ventas.", "action": "agregar_fotos", "weight": 5})

            # Stock check
            no_stock = await db.pool.fetchval("SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true AND stock = 0", tenant_id) or 0
            if no_stock > 0:
                checks.append({"type": "alert", "icon": "alert-triangle", "message": f"{no_stock} productos sin stock.", "action": "actualizar_stock", "weight": 3})
    else:
        checks.append({"type": "warning", "icon": "package", "message": "Sin productos. Carga productos para que el agente pueda vender.", "action": "cargar_productos", "weight": 15})

    # 5. Knowledge (10 pts)
    docs_count = await db.pool.fetchval("SELECT COUNT(*) FROM rag_documents WHERE tenant_id = $1 AND status = 'active'", tenant_id) or 0
    if docs_count > 0:
        score += 10
        completed.append(f"Knowledge ({docs_count} docs)")
    else:
        checks.append({"type": "suggestion", "icon": "database", "message": "Knowledge vacio. Subi documentos para respuestas con mas contexto.", "action": "subir_docs", "weight": 10})

    # 6. Recent activity (10 pts)
    recent_conv = await db.pool.fetchval("SELECT COUNT(*) FROM chat_conversations WHERE tenant_id = $1 AND updated_at >= NOW() - INTERVAL '7 days'", tenant_id) or 0
    if recent_conv > 0:
        score += 10
        completed.append(f"Activo ({recent_conv} conversaciones esta semana)")
    else:
        checks.append({"type": "info", "icon": "message-circle", "message": "Sin conversaciones en 7 dias. Revisa tus canales.", "action": "ver_chats", "weight": 10})

    # 7. Derivations check
    derivations_today = await db.pool.fetchval("""
        SELECT COUNT(*) FROM chat_messages WHERE tenant_id = $1 AND role = 'assistant'
        AND content ILIKE '%deriv%humano%' AND created_at >= CURRENT_DATE
    """, tenant_id) or 0
    if derivations_today > 5:
        checks.append({"type": "alert", "icon": "alert-triangle", "message": f"El agente derivo {derivations_today} veces hoy. Puede faltar info en el prompt.", "action": "ver_errores", "weight": 5})

    # 8. Plan
    sub = await db.pool.fetchrow("SELECT p.name, s.current_period_end FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.tenant_id = $1 AND s.status = 'active' LIMIT 1", tenant_id)
    if sub and sub["name"] == "free" and sub["current_period_end"]:
        days_left = max(0, (sub["current_period_end"] - datetime.utcnow()).days)
        if days_left <= 3:
            checks.append({"type": "alert", "icon": "clock", "message": f"Tu prueba vence en {days_left} dias.", "action": "ver_planes", "weight": 0})

    # Sort checks by weight descending
    checks.sort(key=lambda c: c.get("weight", 0), reverse=True)
    top_priority = checks[0]["message"] if checks else None

    return {
        "score": min(100, score),
        "checks": checks,
        "completed": completed,
        "top_priority": top_priority,
        "stats": {
            "products": internal_count,
            "has_tn": bool(has_tn),
            "documents": docs_count,
            "conversations_week": recent_conv,
            "derivations_today": derivations_today,
        }
    }


# --- Daily Analysis (read from Redis) ---

@router.get("/daily-analysis")
async def get_daily_analysis(current_user: User = Depends(get_current_user)):
    """Read the daily conversation analysis from Redis cache."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        return {"available": False}

    try:
        raw = await redis_client.get(f"nova_daily:{tenant_id}")
        if raw:
            return {"available": True, "analysis": json.loads(raw)}
    except Exception:
        pass

    return {"available": False}
