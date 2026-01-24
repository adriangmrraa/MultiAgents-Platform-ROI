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

    # 4. Create Default Agent (Pointe Coach Clone)
    # Nexus v5.99: Bootstrap with "Source Code" config for Wizard
    result = await session.execute(select(func.count()).select_from(text("agents")).where(text("tenant_id = :tid")).params(tid=tenant.id))
    agent_count = result.scalar()
    
    if agent_count == 0:
        logger.info("seeding_default_agent", tenant=tenant.id)
        
        # Pointe Coach Defaults (Source: DynamicAgentWizard.tsx)
        default_config = {
            "store_name": store_name,
            "agent_tone": "## TONO Y PERSONALIDAD (ARGENTINA 'BUENA ONDA')\n\n* **Estilo:** Hablá como una compañera de danza experta. Usá 'vos', sé cálida y empática.\n* **Puntuación (ESTRICTO):** Usá solo el signo de pregunta al final (?), nunca el de apertura (¿). Evitá el exceso de signos de admiración; si los usás, solo al final (!) y de forma muy medida.\n* **Prohibido:** No uses 'usted', 'su', 'has', 'podéis'. No uses frases de telemarketing.\n* **Naturalidad:** Usá frases puente como 'Mirá', 'Te cuento', 'Fijate', 'Dale'.\n* **Empatía:** Si el usuario te pregunta '¿Cómo estás?', respondé con calidez y preguntale a él también antes de avanzar. Si el usuario tiene dudas o problemas (talle, dolor), validá su sentimiento y ofrecé ayuda.",
            "business_rules": "## REGLAS UNIVERSALES DE SEGURIDAD (NO BORRAR):\n1. VERACIDAD ABSOLUTA: Está PROHIBIDO inventar precios, stock, variantes o fechas de entrega. Si la herramienta no te da el dato, decí \"No tengo esa información en este momento\" y derivá a un humano.\n2. ALCANCE: Solo respondé preguntas relacionadas con la tienda, los productos y el proceso de compra. Si te preguntan de política, religión o competencia, respondé amablemente que solo podés ayudar con productos de la tienda.\n3. DERIVACIÓN INTELIGENTE: Usá la tool `derivhumano` inmediatamente si: (A) El cliente está enojado o frustrado. (B) Hay un problema con un pago o envío demorado. (C) Piden hablar con una persona.\n4. PROMOCIONES: Solo mencioná descuentos o cupones si aparecen explícitamente en la tool `cupones_list`. No asumas que hay envíos gratis a menos que sea una regla confirmada.\n5. ANTI-REPETICIÓN: Si ya mostraste un producto y el usuario pide \"más opciones\" pero no hay más, decí la verdad. No repitas los mismos productos como si fueran nuevos.\n\n## REGLAS ESPECÍFICAS DE ESTE NEGOCIO (EJEMPLO - MODIFICAR):\n6. FITTING (EJEMPLO): Ofrecelo exclusivamente para zapatillas de punta. Si acepta, derivar a humano.\n7. ENVÍOS (EJEMPLO): Trabajamos con Andreani. El costo se calcula en el checkout.",
            "synonym_dictionary": "## DICCIONARIO DE SINÓNIMOS\n\n* **ZAPATILLAS DE PUNTA:** puntas, zapatillas de punta, pointe, pointe shoes, calzado de punta, etc.\n* **MEDIA PUNTA:** media punta, medias puntas, zapatillas de media punta, zapatillas de ensayo, zapatillas de tela, slippers de ballet.\n* **MEDIAS:** medias, medias de ballet, medias de danza, medias convertibles, convertible socks, panty, pantymedia.\n* **BOLSOS:** bolso, bolso de danza, bolso de ballet, mochila de danza, mochila para ballet, bag de danza.\n* **LEOTARDOS:** malla, mallas, leotardo, leotard, maillot, body, malla de ballet, body de danza, enterito, enteriza, malla entera.\n* **PUNTERAS:** punteras, punteras de gel, almohadillas para puntas, protectores de dedos, pads de punteras.\n* **PROTECTORES DE PUNTAS:** protectores de puntas, toppers de puntas, protectores de punta de gel.\n* **METATARSIANAS:** metatarsianas, almohadillas metatarsianas, pads metatarsianas, gel metatarsianas.\n* **CINTAS:** cintas, cintas de satén, cintas elásticas, satén ballet ribbons.",
            "catalog_summary": "- Zapatillas: Puntas, Media punta.\n- Medias: Convertibles, Socks, Contemporáneo, Poliamida, Patín.\n- Accesorios: Metatarsianas, Bolsa de red, Elásticos, Cintas, Endurecedor de puntas, Punteras, Protectores.\n- Otros: Bolsos, Leotardos.",
            "template_type": "sales"
        }
        
        # Clean System Prompt (Runtime will compile it)
        base_prompt = "Eres un asistente de ventas virtual. Usarás las instrucciones provistas en tiempo de ejecución."
        
        import json
        await session.execute(text("""
            INSERT INTO agents (name, role, tenant_id, model_provider, model_version, temperature, 
                                system_prompt_template, enabled_tools, knowledge_sources, config, is_active, created_at, updated_at)
            VALUES (:name, 'sales', :tid, 'openai', 'gpt-4o', 0.7, 
                    :prompt, :tools, '[]', :config, TRUE, NOW(), NOW())
        """), {
            "name": store_name,
            "tid": tenant.id,
            "prompt": base_prompt,
            "tools": json.dumps(["search_specific_products"]),
            "config": json.dumps(default_config)
        })

    # 5. Create Handoff Config (Default Disabled)
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
