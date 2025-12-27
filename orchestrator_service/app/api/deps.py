from fastapi import Request, HTTPException, Depends, Header
from sqlalchemy import select
from structlog import get_logger

from app.core.database import get_db, AsyncSession
from app.models.tenant import Tenant
from app.schemas.tenant import TenantInternal
from app.middleware.tenant_context import tenant_context

logger = get_logger()

async def get_current_tenant_header(
    x_tenant_id: str = Header(...), 
    db: AsyncSession = Depends(get_db)
) -> TenantInternal:
    """
    Resolves the tenant based on the X-Tenant-ID header.
    Fail-Fast for missing or invalid tenants.
    """
    if not x_tenant_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid X-Tenant-ID header")

    result = await db.execute(select(Tenant).where(Tenant.id == int(x_tenant_id)))
    tenant_orm = result.scalar_one_or_none()

    if not tenant_orm:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant_orm.is_active:
        raise HTTPException(status_code=403, detail="Tenant is inactive")

    tenant_data = TenantInternal.model_validate(tenant_orm)
    tenant_context.set(tenant_data)
    return tenant_data

async def get_current_tenant_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> TenantInternal:
    """
    Resolves the tenant based on the incoming Webhook Payload (WhatsApp/YCloud).
    Implements Fail-Fast security.
    """
    try:
        # 1. Parse Payload (Idempotent read, since Starlette caches body())
        body = await request.json()
    except Exception:
        # Malformed JSON
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    logger.info("webhook_received", body_keys=list(body.keys()), tenant_id_in_payload=body.get("tenant_id"))

    # 2. Strategy: Extract Tenant Identity
    target_tenant_id = body.get("tenant_id")
    if target_tenant_id:
        try:
            tid = int(target_tenant_id)
            logger.info("attempting_tenant_id_resolution", tenant_id=tid)
            result = await db.execute(select(Tenant).where(Tenant.id == tid))
            tenant_orm = result.scalar_one_or_none()
            if tenant_orm:
                if not tenant_orm.is_active:
                    raise HTTPException(status_code=403, detail="Tenant is inactive")
                tenant_data = TenantInternal.model_validate(tenant_orm)
                tenant_context.set(tenant_data)
                logger.info("tenant_resolved_via_id", tenant_id=tid)
                return tenant_data
            else:
                logger.warning("tenant_id_not_found_in_db", tenant_id=tid)
        except ValueError:
            logger.warning("invalid_tenant_id_format", tenant_id=target_tenant_id)

    target_phone = None
    
    # 3. Strategy: Extract Bot Phone Number (Fallback)
    # Note: Structure depends on YCloud/Meta. We look for commonly used fields.
    try:
        # Meta Standard
        entry = body.get("entry", [])
        if entry:
            changes = entry[0].get("changes", [])
            if changes:
                value = changes[0].get("value", {})
                metadata = value.get("metadata", {})
                target_phone = metadata.get("display_phone_number")
                
                # Fallback: YCloud specific 'to' field? 
                # If usage is 'messages', 'to' might be the user, 'from' the bot?
                # No, in inbound message: 'from' is user, 'metadata.display_phone_number' is bot.
                # However, some wrappers use headers or root level fields.
                # We adhere to the user requirement: "verificar coincidencia con el campo to"
                
    except Exception as e:
        logger.warning("webhook_payload_parsing_error", error=str(e))

    # Fallback/Direct
    if not target_phone:
        # Maybe it's a flat structure?
        target_phone = body.get("to") or body.get("recipient_id")

    if not target_phone:
        logger.error("tenant_resolution_failed", reason="no_phone_in_payload")
        raise HTTPException(status_code=400, detail="Could not identify target bot phone number")

    # 3. Normalize
    clean_phone = "".join(filter(str.isdigit, str(target_phone)))

    # 4. DB Lookup
    result = await db.execute(select(Tenant).where(Tenant.bot_phone_number == clean_phone))
    tenant_orm = result.scalar_one_or_none()

    if not tenant_orm:
        logger.error("tenant_resolution_failed", reason="tenant_not_found_for_phone", phone=clean_phone)
        # Fail-Fast
        raise HTTPException(status_code=404, detail=f"Tenant not found for phone {clean_phone}")

    if not tenant_orm.is_active:
        logger.warning("tenant_resolution_failed", reason="tenant_inactive", phone=clean_phone)
        raise HTTPException(status_code=403, detail="Tenant is inactive")

    # 5. Set Context
    tenant_data = TenantInternal.model_validate(tenant_orm)
    tenant_context.set(tenant_data)
    
    logger.info("tenant_resolved", tenant_id=tenant_data.id, store=tenant_data.store_name)
    return tenant_data
