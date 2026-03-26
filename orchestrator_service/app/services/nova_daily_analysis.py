"""Nova Daily Analysis — Cron job that analyzes conversations per tenant.

Runs every 12 hours. Uses GPT-4o-mini to extract insights from recent conversations.
Cost: ~$0.003 per tenant per run.
Results cached in Redis with 48h TTL.
"""

import os
import json
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def nova_daily_analysis_loop(pool, redis):
    """Background loop that runs analysis every 12 hours."""
    logger.info("nova_daily_analysis_loop_started")

    while True:
        try:
            await _run_analysis(pool, redis)
        except Exception as e:
            logger.error(f"nova_daily_analysis_error: {e}")

        # Sleep 12 hours
        await asyncio.sleep(12 * 60 * 60)


async def _run_analysis(pool, redis):
    """Analyze conversations from the last 24h for each active tenant."""
    tenants = await pool.fetch("""
        SELECT DISTINCT tenant_id FROM chat_conversations
        WHERE updated_at >= NOW() - INTERVAL '24 hours'
        AND tenant_id IS NOT NULL
    """)

    if not tenants:
        logger.info("nova_daily_analysis: no active tenants in last 24h")
        return

    logger.info(f"nova_daily_analysis: processing {len(tenants)} tenants")

    for tenant in tenants:
        tid = tenant["tenant_id"]
        try:
            await _analyze_tenant(pool, redis, tid)
        except Exception as e:
            logger.error(f"nova_daily_analysis_tenant_error: tenant={tid} error={e}")


async def _analyze_tenant(pool, redis, tenant_id: int):
    """Analyze a single tenant's conversations."""
    # Fetch last 24h messages (limit 100 for token efficiency)
    messages = await pool.fetch("""
        SELECT cm.content, cm.role, cc.channel
        FROM chat_messages cm
        JOIN chat_conversations cc ON cc.id = cm.conversation_id
        WHERE cm.tenant_id = $1
        AND cm.created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY cm.created_at DESC
        LIMIT 100
    """, tenant_id)

    if not messages or len(messages) < 4:
        # Not enough data to analyze
        return

    # Build compact summary (truncate messages to save tokens)
    lines = []
    for m in messages[:50]:
        role = "USER" if m["role"] == "user" else "AGENT"
        content = (m["content"] or "")[:80]
        lines.append(f"{role}: {content}")

    summary_input = "\n".join(lines)

    # Count stats
    total_convs = await pool.fetchval("""
        SELECT COUNT(DISTINCT conversation_id) FROM chat_messages
        WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
    """, tenant_id) or 0

    derivations = await pool.fetchval("""
        SELECT COUNT(*) FROM chat_messages
        WHERE tenant_id = $1 AND role = 'assistant'
        AND content ILIKE '%deriv%humano%'
        AND created_at >= NOW() - INTERVAL '24 hours'
    """, tenant_id) or 0

    # Analyze with GPT-4o-mini
    analysis = await _analyze_with_gpt(summary_input)

    if analysis:
        analysis["conversations_count"] = total_convs
        analysis["derivations_count"] = derivations
        analysis["analyzed_at"] = datetime.utcnow().isoformat()

        # Cache in Redis — 48h TTL
        await redis.setex(
            f"nova_daily:{tenant_id}",
            172800,  # 48 hours
            json.dumps(analysis, ensure_ascii=False)
        )
        logger.info(f"nova_daily_analysis_complete: tenant={tenant_id} score={analysis.get('satisfaccion_estimada', '?')}")


async def _analyze_with_gpt(conversation_summary: str) -> dict | None:
    """Analyze conversations using GPT-4o-mini. Returns structured insights."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        try:
            from app.core.config import settings
            api_key = settings.OPENAI_API_KEY
        except Exception:
            pass

    if not api_key:
        logger.warning("nova_daily_analysis: no OPENAI_API_KEY configured")
        return None

    try:
        import httpx

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {
                            "role": "system",
                            "content": """Analiza estas conversaciones de un agente de ventas por WhatsApp/Instagram.
Retorna un JSON con:
- temas_frecuentes: [lista de 3-5 temas mas consultados, cada uno con "tema" y "cantidad_aprox"]
- problemas: [lista de situaciones donde el agente respondio mal o derivo innecesariamente]
- temas_sin_cobertura: [temas que los clientes preguntaron y el agente no supo responder]
- sugerencias: [lista de 2-3 mejoras concretas para el prompt del agente, cada una con "titulo" y "detalle"]
- satisfaccion_estimada: numero 1-10
- resumen: string de 2-3 oraciones resumen del dia
Solo JSON valido, sin explicaciones ni markdown."""
                        },
                        {"role": "user", "content": conversation_summary}
                    ],
                    "temperature": 0,
                    "max_tokens": 600,
                    "response_format": {"type": "json_object"}
                }
            )

        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
        else:
            logger.error(f"nova_daily_gpt_error: status={response.status_code}")
            return None

    except Exception as e:
        logger.error(f"nova_daily_gpt_exception: {e}")
        return {"resumen": "No se pudo analizar", "sugerencias": []}
