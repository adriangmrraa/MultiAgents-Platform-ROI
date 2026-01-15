import os
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from app.models.tenant import Tenant, TenantHumanHandoffConfig
from app.core.config import settings

logger = get_logger()

async def init_db(session: AsyncSession) -> None:
    """
    Hydrate database from Environment Variables if empty.
    Zero-config startup for the first tenant.
    """
    logger.info("db_hydration_check_start")
    
    # Check if tenants exist
    result = await session.execute(select(func.count()).select_from(Tenant))
    count = result.scalar()
    
    if count > 0:
        logger.info("db_hydration_skip", reason="tenants_exist", count=count)
        return

    logger.info("db_hydration_start", reason="db_empty")
    
    # 1. Read Env Vars
    store_name = os.getenv("STORE_NAME", settings.PROJECT_NAME)
    # Flexible Phone Number Detection
    phone = os.getenv("BOT_PHONE_NUMBER") or os.getenv("YCLOUD_Phone_Number_ID") or os.getenv("WHATSAPP_PHONE_NUMBER")
    
    tn_id = os.getenv("TIENDANUBE_STORE_ID")
    tn_token = os.getenv("TIENDANUBE_ACCESS_TOKEN") or os.getenv("TIENDANUBE_API_KEY")
    
    sys_prompt = os.getenv("SYSTEM_PROMPT") or os.getenv("GLOBAL_SYSTEM_PROMPT")
    knowledge = os.getenv("STORE_CATALOG_KNOWLEDGE") or os.getenv("GLOBAL_CATALOG_KNOWLEDGE")
    desc = os.getenv("STORE_DESCRIPTION") or os.getenv("GLOBAL_STORE_DESCRIPTION")

    # Validate Critical Vars
    if not phone:
        logger.warning("db_hydration_incomplete", reason="missing_bot_phone_number_env", note="Using placeholder 0000000000 to allow startup")
        phone = "0000000000"

    # 2. Normalize Phone (Remove +, spaces)
    clean_phone = "".join(filter(str.isdigit, phone))
    
    # 3. Create Tenant
    tenant = Tenant(
        store_name=store_name,
        bot_phone_number=clean_phone,
        tiendanube_store_id=tn_id,
        tiendanube_access_token=tn_token,
        system_prompt_template=sys_prompt,
        store_catalog_knowledge=knowledge,
        store_description=desc,
        is_active=True
    )
    
    session.add(tenant)
    await session.flush() # flush to get tenant.id
    
    # --- Protocol Omega: Sovereign Credentials Seeding ---
    # Automatically migrate ENV vars to the Sovereign system for the first tenant
    from sqlalchemy import text # Use text for direct execution if needed or raw SQL
    
    initial_creds = []
    
    # OpenAI
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        initial_creds.append({
            "name": "OpenAI Primary Key",
            "value": openai_key,
            "category": "openai",
            "scope": "tenant",
            "tenant_id": tenant.id,
            "description": "Auto-seeded from environment variables"
        })
        
    # Google (Gemini)
    google_key = os.getenv("GOOGLE_API_KEY")
    if google_key:
        initial_creds.append({
            "name": "Google AI Primary Key",
            "value": google_key,
            "category": "google",
            "scope": "tenant",
            "tenant_id": tenant.id,
            "description": "Auto-seeded from environment variables"
        })
        
    # TiendaNube
    if tn_token:
        initial_creds.append({
            "name": f"TiendaNube - {store_name}",
            "value": tn_token,
            "category": "tiendanube",
            "scope": "tenant",
            "tenant_id": tenant.id,
            "description": f"Access token for store ID {tn_id}"
        })

    # Execute seeding
    for c in initial_creds:
        await session.execute(text("""
            INSERT INTO credentials (id_uuid, name, value, category, scope, tenant_id, description)
            VALUES (gen_random_uuid(), :name, :value, :category, :scope, :tenant_id, :description)
        """), c)

    # 4. Create Handoff Config (Default Disabled)
    handoff = TenantHumanHandoffConfig(
        tenant_id=tenant.id,
        enabled=False,
        triggers={"rule_generic": True}, # Default trigger
        destination_email=os.getenv("DEFAULT_HANDOFF_EMAIL", "admin@example.com"), # Fallback for NotNullViolation
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="user",
        smtp_password_encrypted="encrypted_placeholder"
    )
    session.add(handoff)
    
    await session.commit()
    logger.info("db_hydration_success", tenant_id=tenant.id, store=store_name)
