from fastapi import Request, HTTPException, Depends, Header, Cookie
from sqlalchemy import select
from structlog import get_logger
from jose import jwt, JWTError

from app.core import security
from app.core.config import settings
from app.core.database import get_db, AsyncSession
from app.models.tenant import Tenant
from app.models.auth import User
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

    # 2. Strategy: Extract Tenant Identity
    # Check Query Params first (e.g. ?tenant_id=12) -> Common for Chatwoot Webhooks
    target_tenant_id = request.query_params.get("tenant_id") or body.get("tenant_id")
    if target_tenant_id:
        try:
            result = await db.execute(select(Tenant).where(Tenant.id == int(target_tenant_id)))
            tenant_orm = result.scalar_one_or_none()
            if tenant_orm:
                if not tenant_orm.is_active:
                    raise HTTPException(status_code=403, detail="Tenant is inactive")
                tenant_data = TenantInternal.model_validate(tenant_orm)
                tenant_context.set(tenant_data)
                return tenant_data
        except ValueError:
            pass

    # 3. Strategy: Universal Channel Resolver (Nexus v7.5)
    raw_channel_id = None
    external_account_id = body.get("external_account_id")
    
    # Extraction Logic
    if body.get("provider") == "chatwoot":
        raw_channel_id = str(body.get("meta", {}).get("chatwoot_inbox_id") or body.get("inbox_id") or "")
    
    if not raw_channel_id:
        try:
            entry = body.get("entry", [])
            if entry:
                changes = entry[0].get("changes", [])
                if changes:
                    metadata = changes[0].get("value", {}).get("metadata", {})
                    raw_channel_id = metadata.get("display_phone_number")
        except: pass

    if not raw_channel_id:
        raw_channel_id = body.get("to") or body.get("recipient_id")

    # Step A: Check Channel Bindings (ID-Centric)
    if raw_channel_id:
        from sqlalchemy import text
        # If it's a Chatwoot message, try to match account_id if we have it
        if external_account_id:
            query = text("SELECT tenant_id FROM channel_bindings WHERE channel_id = :cid AND (external_account_id = :aid OR external_account_id IS NULL) LIMIT 1")
            res = await db.execute(query, {"cid": str(raw_channel_id), "aid": str(external_account_id)})
        else:
            query = text("SELECT tenant_id FROM channel_bindings WHERE channel_id = :cid LIMIT 1")
            res = await db.execute(query, {"cid": str(raw_channel_id)})
            
        tid = res.scalar()
        if tid:
            result = await db.execute(select(Tenant).where(Tenant.id == tid))
            tenant_orm = result.scalar_one_or_none()
            if tenant_orm and tenant_orm.is_active:
                tenant_data = TenantInternal.model_validate(tenant_orm)
                tenant_context.set(tenant_data)
                logger.info("tenant_resolved_via_binding", tenant_id=tid, channel_id=raw_channel_id)
                return tenant_data

    # Step B: Fallback Legacy Phone Lookup
    if not raw_channel_id:
        logger.error("tenant_resolution_failed", reason="no_identifier_in_payload")
        raise HTTPException(status_code=400, detail="Could not identify target channel")

    tenant_orm = None
    clean_phone = "".join(filter(str.isdigit, str(raw_channel_id)))
    if clean_phone:
        result = await db.execute(select(Tenant).where(Tenant.bot_phone_number == clean_phone))
        tenant_orm = result.scalar_one_or_none()

    if not tenant_orm:
        logger.error("tenant_resolution_failed", reason="tenant_not_found", identifier=raw_channel_id)
        raise HTTPException(status_code=404, detail=f"Tenant not found for identifier {raw_channel_id}")

    if not tenant_orm.is_active:
        logger.warning("tenant_resolution_failed", reason="tenant_inactive", identifier=raw_channel_id)
        raise HTTPException(status_code=403, detail="Tenant is inactive")

    # 5. Set Context
    tenant_data = TenantInternal.model_validate(tenant_orm)
    tenant_context.set(tenant_data)
    
    logger.info("tenant_resolved", tenant_id=tenant_data.id, store=tenant_data.store_name)
    return tenant_data

async def get_current_user(
    token: str | None = Cookie(default=None, alias="access_token"),
    auth_header: str | None = Header(default=None, alias="Authorization"),
    db: AsyncSession = Depends(get_db)
) -> User:
    # Support both Cookie (Priority) and Bearer Header
    if not token and auth_header:
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        logger.warning("auth_failed_no_token", cookie_present=bool(token), auth_header_present=bool(auth_header))
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY.get_secret_value(), algorithms=[security.ALGORITHM])
        user_uuid = payload.get("sub")
        if user_uuid is None:
            logger.error("auth_failed_invalid_payload", sub=bool(user_uuid))
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except JWTError as e:
        logger.error("auth_failed_jwt_error", error=str(e))
        raise HTTPException(status_code=401, detail="Could not validate credentials")
        
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    return user

async def get_current_super_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Elevated Privilege Validator (God Mode).
    """
    if current_user.role != "super_admin":
        logger.warning("unauthorized_super_admin_attempt", user_id=current_user.id)
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return current_user

# Alias for backward compatibility / cleaner imports
get_current_tenant = get_current_tenant_header
