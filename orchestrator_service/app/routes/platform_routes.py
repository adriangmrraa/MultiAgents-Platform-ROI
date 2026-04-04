"""
Platform Control Tower - Super Admin Routes
Full admin panel for managing the SaaS platform:
- Overview metrics (real revenue, costs, usage)
- Tenant management (suspend, activate, change plan, impersonate)
- Subscription management
- Usage & cost tracking
- Audit logs
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from db import get_pool_db
from app.api.deps import get_current_super_admin
from app.models.auth import User
from db import redis_client
import json
import structlog
from app.core.sanitization import sanitize_html, sanitize_sql_identifier

logger = structlog.get_logger()

router = APIRouter(
    prefix="/platform",
    tags=["Platform Control Tower"],
    dependencies=[Depends(get_current_super_admin)],
)


# ---------- Schemas ----------


class TenantActionRequest(BaseModel):
    action: str  # suspend, activate, archive
    reason: Optional[str] = None


class ChangeTenantPlanRequest(BaseModel):
    plan_name: str


class UpdatePlanRequest(BaseModel):
    display_name: Optional[str] = None
    price_usd: Optional[float] = None
    price_ars: Optional[float] = None
    price_usd_yearly: Optional[float] = None
    price_ars_yearly: Optional[float] = None
    max_agents: Optional[int] = None
    max_messages_per_month: Optional[int] = None
    max_knowledge_docs: Optional[int] = None
    max_channels: Optional[int] = None
    max_team_members: Optional[int] = None
    max_tokens_per_month: Optional[int] = None
    features: Optional[dict] = None
    is_active: Optional[bool] = None


# ---------- Overview ----------


@router.get("/overview")
async def platform_overview(
    current_user: User = Depends(get_current_super_admin), db=Depends(get_pool_db)
):
    """
    God Mode: Aggregate metrics with REAL revenue data.
    """
    # 1. Counts
    total_users = await db.fetchval("SELECT count(*) FROM users") or 0
    total_tenants = await db.fetchval("SELECT count(*) FROM tenants") or 0
    active_tenants = (
        await db.fetchval("SELECT count(*) FROM tenants WHERE is_active = true") or 0
    )

    # 2. Activity (Last 24h)
    msgs_24h = (
        await db.fetchval("""
        SELECT count(*) FROM chat_messages
        WHERE created_at > NOW() - INTERVAL '24 HOURS'
    """)
        or 0
    )

    # 3. Subscription breakdown
    sub_stats = await db.fetch("""
        SELECT p.name as plan_name, s.status, COUNT(*) as count
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        GROUP BY p.name, s.status
        ORDER BY p.name
    """)

    plan_breakdown = {}
    for row in sub_stats:
        plan = row["plan_name"]
        if plan not in plan_breakdown:
            plan_breakdown[plan] = {"total": 0, "statuses": {}}
        plan_breakdown[plan]["total"] += row["count"]
        plan_breakdown[plan]["statuses"][row["status"]] = row["count"]

    # 4. REAL Revenue (from paid invoices)
    revenue_30d = (
        await db.fetchval("""
        SELECT COALESCE(SUM(amount_usd), 0) FROM invoices
        WHERE status = 'paid' AND paid_at > NOW() - INTERVAL '30 DAYS'
    """)
        or 0
    )

    revenue_total = (
        await db.fetchval("""
        SELECT COALESCE(SUM(amount_usd), 0) FROM invoices WHERE status = 'paid'
    """)
        or 0
    )

    # 5. MRR (Monthly Recurring Revenue)
    mrr = (
        await db.fetchval("""
        SELECT COALESCE(SUM(p.price_usd), 0)
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'active'
    """)
        or 0
    )

    # 6. Costs (LLM usage this month)
    period_start = datetime.utcnow().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    total_cost = (
        await db.fetchval(
            """
        SELECT COALESCE(SUM(llm_cost_usd), 0) FROM usage_records
        WHERE period_start = $1
    """,
            period_start,
        )
        or 0
    )

    total_tokens = (
        await db.fetchval(
            """
        SELECT COALESCE(SUM(tokens_used), 0) FROM usage_records
        WHERE period_start = $1
    """,
            period_start,
        )
        or 0
    )

    # 7. Trials expiring soon
    trials_expiring = (
        await db.fetchval("""
        SELECT COUNT(*) FROM subscriptions
        WHERE status = 'trialing' AND trial_ends_at < NOW() + INTERVAL '3 DAYS'
    """)
        or 0
    )

    return {
        "total_users": total_users,
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "messages_24h": msgs_24h,
        "plan_breakdown": plan_breakdown,
        "revenue": {
            "mrr": mrr,
            "revenue_30d": revenue_30d,
            "revenue_total": revenue_total,
            "formatted_mrr": f"${mrr:,.0f}",
            "formatted_30d": f"${revenue_30d:,.0f}",
            "formatted_total": f"${revenue_total:,.0f}",
        },
        "costs": {
            "llm_cost_month": total_cost,
            "tokens_month": total_tokens,
            "formatted_cost": f"${total_cost:,.2f}",
            "margin": mrr - total_cost if mrr > 0 else 0,
        },
        "trials_expiring_soon": trials_expiring,
    }


# ---------- Infrastructure ----------


@router.get("/infrastructure")
async def platform_infrastructure(db=Depends(get_pool_db)):
    """Technical Health Check."""
    redis_info = {}
    try:
        info = await redis_client.info("memory")
        redis_info = info
    except Exception as e:
        redis_info = {"error": str(e)}

    try:
        db_size_str = await db.fetchval(
            "SELECT pg_size_pretty(pg_database_size(current_database()))"
        )
    except Exception:
        db_size_str = "Unknown"

    # Table sizes
    try:
        table_sizes = await db.fetch("""
            SELECT relname as table_name,
                   pg_size_pretty(pg_total_relation_size(relid)) as total_size,
                   n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(relid) DESC
            LIMIT 15
        """)
        tables = [dict(r) for r in table_sizes]
    except Exception:
        tables = []

    return {
        "redis_memory": redis_info.get("used_memory_human", "N/A"),
        "redis_peak": redis_info.get("used_memory_peak_human", "N/A"),
        "db_size": db_size_str,
        "tables": tables,
        "status": "Healthy",
    }


# ---------- Tenant Management ----------


@router.get("/tenants")
async def list_all_tenants(
    limit: int = 50,
    offset: int = 0,
    status_filter: str = None,
    plan_filter: str = None,
    search: str = None,
    db=Depends(get_pool_db),
):
    """Paginated list of tenants with subscription info."""
    conditions = []
    params = []
    param_idx = 1

    if status_filter:
        conditions.append(f"s.status = ${param_idx}")
        params.append(status_filter)
        param_idx += 1

    if plan_filter:
        conditions.append(f"p.name = ${param_idx}")
        params.append(plan_filter)
        param_idx += 1

    if search:
        conditions.append(
            f"(t.store_name ILIKE ${param_idx} OR u.email ILIKE ${param_idx})"
        )
        params.append(f"%{search}%")
        param_idx += 1

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    params.extend([limit, offset])

    rows = await db.fetch(
        f"""
        SELECT t.id, t.store_name, t.bot_phone_number, t.is_active,
               COALESCE(t.status, 'active') as tenant_status,
               t.created_at,
               u.email as owner_email, u.full_name as owner_name,
               u.is_verified,
               p.name as plan_name, p.display_name as plan_display_name,
               s.status as sub_status, s.trial_ends_at,
               s.payment_provider,
               COALESCE(ur.messages_sent, 0) as messages_this_month,
               COALESCE(ur.tokens_used, 0) as tokens_this_month,
               COALESCE(ur.llm_cost_usd, 0) as cost_this_month
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plans p ON p.id = s.plan_id
        LEFT JOIN usage_records ur ON ur.tenant_id = t.id
            AND ur.period_start = date_trunc('month', NOW())
        {where_clause}
        ORDER BY t.created_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """,
        *params,
    )

    total = (
        await db.fetchval(
            f"""
        SELECT COUNT(*)
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plans p ON p.id = s.plan_id
        {where_clause}
    """,
            *params[:-2],
        )
        if params[:-2]
        else await db.fetchval("SELECT COUNT(*) FROM tenants")
    )

    return {
        "tenants": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/tenants/{tenant_id}")
async def get_tenant_detail(tenant_id: int, db=Depends(get_pool_db)):
    """Get detailed info for a specific tenant."""
    tenant = await db.fetchrow(
        """
        SELECT t.*, u.email as owner_email, u.full_name as owner_name,
               u.is_verified, u.id as owner_user_id,
               p.name as plan_name, p.display_name as plan_display_name,
               s.status as sub_status, s.trial_ends_at,
               s.payment_provider, s.current_period_start, s.current_period_end
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
        LEFT JOIN subscriptions s ON s.tenant_id = t.id
        LEFT JOIN plans p ON p.id = s.plan_id
        WHERE t.id = $1
    """,
        tenant_id,
    )

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Usage history
    usage = await db.fetch(
        """
        SELECT period_start, messages_sent, messages_received, tokens_used,
               api_calls, llm_cost_usd
        FROM usage_records
        WHERE tenant_id = $1
        ORDER BY period_start DESC
        LIMIT 12
    """,
        tenant_id,
    )

    # Invoices
    invoices = await db.fetch(
        """
        SELECT id, amount_usd, amount_local, currency, status, paid_at, created_at
        FROM invoices
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 20
    """,
        tenant_id,
    )

    # Team members
    users = await db.fetch(
        """
        SELECT id, email, role, full_name, is_verified, created_at
        FROM users WHERE tenant_id = $1
    """,
        tenant_id,
    )

    # Agent count
    agent_count = (
        await db.fetchval("SELECT COUNT(*) FROM agents WHERE tenant_id = $1", tenant_id)
        or 0
    )

    return {
        "tenant": dict(tenant),
        "usage_history": [dict(r) for r in usage],
        "invoices": [dict(r) for r in invoices],
        "team_members": [dict(r) for r in users],
        "agent_count": agent_count,
    }


@router.post("/tenants/{tenant_id}/action")
async def tenant_action(
    tenant_id: int,
    req: TenantActionRequest,
    request: Request,
    current_user: User = Depends(get_current_super_admin),
    db=Depends(get_pool_db),
):
    """Suspend, activate, or archive a tenant."""
    tenant = await db.fetchrow("SELECT * FROM tenants WHERE id = $1", tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if req.action == "suspend":
        await db.execute(
            "UPDATE tenants SET is_active = false, status = 'suspended' WHERE id = $1",
            tenant_id,
        )
        await db.execute(
            "UPDATE subscriptions SET status = 'suspended' WHERE tenant_id = $1",
            tenant_id,
        )
    elif req.action == "activate":
        await db.execute(
            "UPDATE tenants SET is_active = true, status = 'active' WHERE id = $1",
            tenant_id,
        )
        # Reactivate subscription if it was suspended
        await db.execute(
            """
            UPDATE subscriptions SET status = 'active', updated_at = NOW()
            WHERE tenant_id = $1 AND status = 'suspended'
        """,
            tenant_id,
        )
    elif req.action == "archive":
        await db.execute(
            "UPDATE tenants SET is_active = false, status = 'archived' WHERE id = $1",
            tenant_id,
        )
        await db.execute(
            "UPDATE subscriptions SET status = 'canceled', canceled_at = NOW() WHERE tenant_id = $1",
            tenant_id,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

    # Audit log
    await db.execute(
        """
        INSERT INTO audit_logs (user_id, tenant_id, action, resource_type, resource_id, details, ip_address)
        VALUES ($1, $2, $3, 'tenant', $4, $5::jsonb, $6)
    """,
        current_user.id,
        tenant_id,
        f"tenant.{req.action}",
        str(tenant_id),
        json.dumps({"reason": sanitize_html(req.reason) if req.reason else "admin_action"}),
        request.client.host if request.client else None,
    )

    logger.info(
        "tenant_action", action=req.action, tenant_id=tenant_id, by=str(current_user.id)
    )

    return {"message": f"Tenant {req.action}d successfully", "tenant_id": tenant_id}


@router.post("/tenants/{tenant_id}/change-plan")
async def admin_change_plan(
    tenant_id: int,
    req: ChangeTenantPlanRequest,
    request: Request,
    current_user: User = Depends(get_current_super_admin),
    db=Depends(get_pool_db),
):
    """Admin: Force change a tenant's plan."""
    plan_name_safe = sanitize_html(req.plan_name)
    plan = await db.fetchrow("SELECT * FROM plans WHERE name = $1", plan_name_safe)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Get current plan
    current = await db.fetchrow(
        """
        SELECT p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.tenant_id = $1
    """,
        tenant_id,
    )

    await db.execute(
        """
        INSERT INTO subscriptions (tenant_id, plan_id, status, current_period_start, trial_ends_at)
        VALUES ($1, $2, 'active', NOW(), NULL)
        ON CONFLICT (tenant_id) DO UPDATE SET
            plan_id = $2, status = 'active', trial_ends_at = NULL, updated_at = NOW()
    """,
        tenant_id,
        plan["id"],
    )

    # Ensure tenant is active
    await db.execute(
        "UPDATE tenants SET is_active = true, status = 'active' WHERE id = $1",
        tenant_id,
    )

    # Audit
    await db.execute(
        """
        INSERT INTO audit_logs (user_id, tenant_id, action, resource_type, details, ip_address)
        VALUES ($1, $2, 'plan.admin_change', 'subscription', $3::jsonb, $4)
    """,
        current_user.id,
        tenant_id,
        json.dumps(
            {"from": current["name"] if current else "none", "to": plan_name_safe}
        ),
        request.client.host if request.client else None,
    )

    return {
        "message": f"Plan changed to {plan['display_name']}",
        "tenant_id": tenant_id,
    }


# ---------- Edit Tenant ----------


class EditTenantRequest(BaseModel):
    store_name: Optional[str] = None
    owner_email: Optional[str] = None
    bot_phone_number: Optional[str] = None
    store_website: Optional[str] = None
    store_description: Optional[str] = None
    is_active: Optional[bool] = None


@router.put("/tenants/{tenant_id}")
async def edit_tenant(
    tenant_id: int,
    req: EditTenantRequest,
    request: Request,
    current_user: User = Depends(get_current_super_admin),
    db=Depends(get_pool_db),
):
    """Admin: Edit tenant details."""
    tenant = await db.fetchrow("SELECT * FROM tenants WHERE id = $1", tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    ALLOWED_FIELDS = {
        "store_name",
        "owner_email",
        "bot_phone_number",
        "store_website",
        "store_description",
        "is_active",
    }
    updates = []
    params = []
    idx = 1

    STRING_FIELDS = {"store_name", "owner_email", "bot_phone_number", "store_website", "store_description"}
    for field, value in req.model_dump(exclude_none=True).items():
        if field not in ALLOWED_FIELDS:
            continue
        if isinstance(value, str) and field in STRING_FIELDS:
            value = sanitize_html(value)
        updates.append(f"{field} = ${idx}")
        params.append(value)
        idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(tenant_id)
    await db.execute(
        f"UPDATE tenants SET {', '.join(updates)}, updated_at = NOW() WHERE id = ${idx}",
        *params,
    )

    # If owner_email changed, update users table too
    if req.owner_email:
        await db.execute(
            "UPDATE users SET email = $1 WHERE tenant_id = $2 AND role = 'owner'",
            req.owner_email,
            tenant_id,
        )

    # Audit
    await db.execute(
        """
        INSERT INTO audit_logs (user_id, tenant_id, action, resource_type, details, ip_address)
        VALUES ($1, $2, 'tenant.edit', 'tenant', $3::jsonb, $4)
    """,
        current_user.id,
        tenant_id,
        json.dumps(req.model_dump(exclude_none=True)),
        request.client.host if request.client else None,
    )

    logger.info("tenant_edited", tenant_id=tenant_id, by=str(current_user.id))
    return {"message": "Tenant updated", "tenant_id": tenant_id}


# ---------- Delete Tenant ----------


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: int,
    request: Request,
    current_user: User = Depends(get_current_super_admin),
    db=Depends(get_pool_db),
):
    """Admin: Permanently delete a tenant and all associated data."""
    tenant = await db.fetchrow("SELECT * FROM tenants WHERE id = $1", tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Prevent deleting own tenant
    if current_user.tenant_id == tenant_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own tenant")

    store_name = tenant["store_name"]
    safe_store_name = sanitize_html(store_name)

    # Delete in order (respecting FK constraints)
    await db.execute("DELETE FROM audit_logs WHERE tenant_id = $1", tenant_id)
    await db.execute("DELETE FROM invoices WHERE tenant_id = $1", tenant_id)
    await db.execute("DELETE FROM usage_records WHERE tenant_id = $1", tenant_id)
    await db.execute("DELETE FROM subscriptions WHERE tenant_id = $1", tenant_id)
    await db.execute(
        "DELETE FROM business_assets WHERE tenant_id = $1::text", str(tenant_id)
    )
    await db.execute(
        "DELETE FROM chat_messages WHERE from_number IN (SELECT bot_phone_number FROM tenants WHERE id = $1)",
        tenant_id,
    )
    await db.execute("DELETE FROM agents WHERE tenant_id = $1", tenant_id)
    await db.execute("DELETE FROM credentials WHERE tenant_id = $1", tenant_id)
    await db.execute(
        "DELETE FROM tenant_human_handoff_config WHERE tenant_id = $1", tenant_id
    )
    await db.execute("DELETE FROM users WHERE tenant_id = $1", tenant_id)
    await db.execute("DELETE FROM tenants WHERE id = $1", tenant_id)

    # Audit (log with null tenant since it's deleted)
    await db.execute(
        """
        INSERT INTO audit_logs (user_id, tenant_id, action, resource_type, details, ip_address)
        VALUES ($1, NULL, 'tenant.delete', 'tenant', $2::jsonb, $3)
    """,
        current_user.id,
        json.dumps({"deleted_tenant_id": tenant_id, "store_name": safe_store_name}),
        request.client.host if request.client else None,
    )

    logger.info(
        "tenant_deleted",
        tenant_id=tenant_id,
        store_name=store_name,
        by=str(current_user.id),
    )
    return {
        "message": f"Tenant '{safe_store_name}' deleted permanently",
        "tenant_id": tenant_id,
    }


# ---------- Plans Management ----------


@router.get("/plans")
async def list_plans(db=Depends(get_pool_db)):
    """List all plans with subscriber counts."""
    rows = await db.fetch("""
        SELECT p.*,
               COUNT(s.id) FILTER (WHERE s.status IN ('active', 'trialing')) as active_subscribers,
               COUNT(s.id) as total_subscribers
        FROM plans p
        LEFT JOIN subscriptions s ON s.plan_id = p.id
        GROUP BY p.id
        ORDER BY p.sort_order
    """)
    return [dict(r) for r in rows]


@router.put("/plans/{plan_name}")
async def update_plan(
    plan_name: str,
    req: UpdatePlanRequest,
    current_user: User = Depends(get_current_super_admin),
    db=Depends(get_pool_db),
):
    """Update a plan's configuration."""
    plan = await db.fetchrow("SELECT * FROM plans WHERE name = $1", plan_name)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    updates = []
    params = []
    idx = 1

    for field, value in req.model_dump(exclude_none=True).items():
        if field == "features":
            updates.append(f"{field} = ${idx}::jsonb")
            params.append(json.dumps(value))
        else:
            updates.append(f"{field} = ${idx}")
            params.append(value)
        idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(plan_name)
    await db.execute(
        f"UPDATE plans SET {', '.join(updates)}, updated_at = NOW() WHERE name = ${idx}",
        *params,
    )

    return {"message": f"Plan {plan_name} updated"}


# ---------- Revenue & Costs ----------


@router.get("/revenue")
async def platform_revenue(days: int = 30, db=Depends(get_pool_db)):
    """Revenue analytics - daily breakdown."""
    rows = await db.fetch(
        """
        SELECT DATE(paid_at) as date,
               SUM(amount_usd) as revenue_usd,
               COUNT(*) as invoice_count,
               payment_provider
        FROM invoices
        WHERE status = 'paid' AND paid_at > NOW() - make_interval(days => $1)
        GROUP BY DATE(paid_at), payment_provider
        ORDER BY date DESC
    """,
        days,
    )

    return {"daily_revenue": [dict(r) for r in rows], "days": days}


@router.get("/costs")
async def platform_costs(months: int = 6, db=Depends(get_pool_db)):
    """Cost analytics - per tenant LLM costs."""
    rows = await db.fetch(
        """
        SELECT ur.tenant_id, t.store_name,
               ur.period_start,
               ur.tokens_used, ur.llm_cost_usd,
               ur.messages_sent, ur.api_calls
        FROM usage_records ur
        JOIN tenants t ON t.id = ur.tenant_id
        WHERE ur.period_start > NOW() - make_interval(months => $1)
        ORDER BY ur.llm_cost_usd DESC
    """,
        months,
    )

    # Summary
    total_cost = sum(r["llm_cost_usd"] or 0 for r in rows)
    total_tokens = sum(r["tokens_used"] or 0 for r in rows)

    return {
        "records": [dict(r) for r in rows],
        "summary": {
            "total_cost_usd": total_cost,
            "total_tokens": total_tokens,
            "formatted_cost": f"${total_cost:,.2f}",
        },
    }


# ---------- Audit Logs ----------


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    tenant_id: int = None,
    action: str = None,
    db=Depends(get_pool_db),
):
    """View audit logs."""
    conditions = []
    params = []
    idx = 1

    if tenant_id:
        conditions.append(f"a.tenant_id = ${idx}")
        params.append(tenant_id)
        idx += 1

    if action:
        conditions.append(f"a.action ILIKE ${idx}")
        params.append(f"%{action}%")
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    params.extend([limit, offset])

    rows = await db.fetch(
        f"""
        SELECT a.*, u.email as user_email
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        {where}
        ORDER BY a.created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """,
        *params,
    )

    return [dict(r) for r in rows]


# ---------- Trial Management ----------


@router.post("/check-trials")
async def force_check_trials(
    current_user: User = Depends(get_current_super_admin), db=Depends(get_pool_db)
):
    """Manually trigger trial expiration check."""
    from app.services.trial_manager import check_trial_expirations
    from db import db as db_pool

    result = await check_trial_expirations(db_pool.pool)
    return result


@router.post("/tenants/{tenant_id}/extend-trial")
async def extend_trial(
    tenant_id: int,
    days: int = 10,
    current_user: User = Depends(get_current_super_admin),
    db=Depends(get_pool_db),
):
    """Extend a tenant's trial period."""
    new_end = datetime.utcnow() + timedelta(days=days)
    await db.execute(
        """
        UPDATE subscriptions SET trial_ends_at = $1, status = 'trialing', updated_at = NOW()
        WHERE tenant_id = $2
    """,
        new_end,
        tenant_id,
    )

    # Reactivate tenant
    await db.execute(
        "UPDATE tenants SET is_active = true, status = 'active' WHERE id = $1",
        tenant_id,
    )

    # Audit
    await db.execute(
        """
        INSERT INTO audit_logs (user_id, tenant_id, action, details)
        VALUES ($1, $2, 'trial.extend', $3::jsonb)
    """,
        current_user.id,
        tenant_id,
        json.dumps({"days": days}),
    )

    return {"message": f"Trial extended by {days} days", "new_end": new_end.isoformat()}
