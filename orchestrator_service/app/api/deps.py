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
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY.get_secret_value(), algorithms=[security.ALGORITHM])
        user_uuid = payload.get("sub")
        if user_uuid is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except JWTError:
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
