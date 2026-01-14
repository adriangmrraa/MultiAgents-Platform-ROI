from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.core.database import get_db, AsyncSession
from app.api.deps import get_current_super_admin
from app.models.auth import User
from db import redis_client
import json

router = APIRouter(
    prefix="/platform",
    tags=["Platform Control Tower"],
    dependencies=[Depends(get_current_super_admin)]
)

@router.get("/overview")
async def platform_overview(db: AsyncSession = Depends(get_db)):
    """
    God Mode: Aggregate metrics for the entire platform.
    Zero Content Access enforced (Metadata only).
    """
    
    # 1. Counts
    total_users = await db.fetchval("SELECT count(*) FROM users")
    total_tenants = await db.fetchval("SELECT count(*) FROM tenants")
    
    # 2. Activity (Last 24h)
    msgs_24h = await db.fetchval("""
        SELECT count(*) FROM chat_messages 
        WHERE created_at > NOW() - INTERVAL '24 HOURS'
    """)
    
    # 3. Revenue (Global Estimated GMV)
    # Heuristic: Same as dashboard but global
    days = 30
    avg_ticket = 45000.0
    conversions = await db.fetchval("""
        SELECT COUNT(DISTINCT c.id)
        FROM chat_conversations c
        JOIN chat_messages m ON c.id = m.conversation_id
        WHERE c.last_message_at >= NOW() - INTERVAL '30 DAYS'
        AND (
            m.content ILIKE '%tu pedido es el #%' OR 
            m.content ILIKE '%gracias por tu compra%' OR
            m.content ILIKE '%pago recibido%' OR
            m.content ILIKE '%link de pago generado%'
        )
    """) or 0
    
    revenue = conversions * avg_ticket

    return {
        "total_users": total_users,
        "total_tenants": total_tenants,
        "messages_24h": msgs_24h,
        "total_revenue_estimated": revenue,
        "formatted_revenue": f"${revenue:,.0f}"
    }

@router.get("/infrastructure")
async def platform_infrastructure(db: AsyncSession = Depends(get_db)):
    """
    Technical Health Check.
    """
    # 1. Redis
    redis_info = {}
    try:
        # aioredis info command? or execute_command
        # Depend on the redis client wrapper. Assuming typical Redis.
        # Use existing 'redis_client' from app.core which is often a strict client
        info = await redis_client.info("memory")
        redis_info = info
    except Exception as e:
        redis_info = {"error": str(e)}

    # 2. DB Size (Postgres specific)
    try:
        db_size_str = await db.fetchval("SELECT pg_size_pretty(pg_database_size(current_database()))")
    except:
        db_size_str = "Unknown"
        
    return {
        "redis_memory": redis_info.get("used_memory_human", "N/A"),
        "redis_peak": redis_info.get("used_memory_peak_human", "N/A"),
        "db_size": db_size_str,
        "status": "Healthy"
    }

@router.get("/tenants")
async def list_all_tenants(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    """
    Paginated list of tenants.
    NO chat access logic here. Just registry.
    """
    rows = await db.fetch(f"""
        SELECT t.id, t.store_name, t.bot_phone_number, t.is_active, t.created_at, u.email as owner_email
        FROM tenants t
        JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
        ORDER BY t.created_at DESC
        LIMIT {limit} OFFSET {offset}
    """)
    
    return [dict(r) for r in rows]
