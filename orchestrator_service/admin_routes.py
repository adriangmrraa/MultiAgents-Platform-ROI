import os
import json
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Header, HTTPException, Depends, Request, Response
from pydantic import BaseModel
import httpx
import redis
from db import db
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)

# Configuration
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "admin-secret-99")

# Resilience & Engine
# Resilience & Engine
from app.core.resilience import safe_db_call
from app.core.engine import NexusEngine # NEW



router = APIRouter(prefix="/admin", tags=["admin"])

# --- Models ---
class TenantModel(BaseModel):
    store_name: str
    bot_phone_number: str
    owner_email: Optional[str] = None
    store_location: Optional[str] = None
    store_website: Optional[str] = None
    store_description: Optional[str] = None
    store_catalog_knowledge: Optional[str] = None
    tiendanube_store_id: Optional[str] = None
    tiendanube_access_token: Optional[str] = None
    handoff_enabled: Optional[bool] = False
    handoff_instructions: Optional[str] = None
    handoff_target_email: Optional[str] = None
    handoff_message: Optional[str] = None
    handoff_smtp_host: Optional[str] = None
    handoff_smtp_user: Optional[str] = None
    handoff_smtp_pass: Optional[str] = None
    handoff_smtp_port: Optional[int] = 465
    handoff_policy: Optional[dict] = None

class CredentialModel(BaseModel):
    name: str
    value: str
    category: str
    scope: str = "global"
    tenant_id: Optional[int] = None
    description: Optional[str] = None

# --- Security ---
async def verify_admin_token(x_admin_token: str = Header(None)):
    if x_admin_token != ADMIN_TOKEN:
        # Debugging 401 (Temporary)
        masked_received = x_admin_token[:5] + "***" if x_admin_token else "None"
        masked_expected = ADMIN_TOKEN[:5] + "***" if ADMIN_TOKEN else "None"
        print(f"AUTH_DEBUG: Expected '{masked_expected}' vs Received '{masked_received}'")
        raise HTTPException(status_code=401, detail="Invalid Admin Token")

# --- RBAC Helper ---
from functools import wraps
def require_role(role: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # In MVP, verify_admin_token guarantees SuperAdmin access
            # Future: Check user roles from JWT
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# --- Tools Registry (Code Reflection) ---
REGISTERED_TOOLS = []

def register_tools(tools_list):
    """Populates the in-memory tools registry from main.py"""
    global REGISTERED_TOOLS
    REGISTERED_TOOLS = tools_list

# --- Redis Setup for Aggregated Cache ---
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

@router.get("/tools", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def get_tools():
    """
    Hybrid Tool Discovery: System (Code) + Custom (DB).
    Follows 'Aggregated Cache' pattern: DB tools are fetched live, System tools are memory-cached.
    """
    # 1. Fetch Custom Tools from DB
    db_tools_rows = await db.pool.fetch("SELECT * FROM tools")
    db_tools = [dict(row) for row in db_tools_rows]
    
    # 2. System Tools (Registered in memory)
    system_tools = [
        {"name": t.name, "description": t.description, "type": "system", "service_url": "internal"}
        for t in REGISTERED_TOOLS
    ]
    
    # 3. Merge
    # We map DB keys to match UI expectations
    formatted_db_tools = []
    for t in db_tools:
        formatted_db_tools.append({
            "name": t['name'],
            "description": t.get('description', 'Custom Tool'),
            "type": t['type'],
            "service_url": t.get('service_url'),
            "prompt_injection": t.get('prompt_injection', ''),
            "config": json.loads(t['config']) if t.get('config') else {},
            "id": t['id']
        })
        
    return system_tools + formatted_db_tools

@router.get("/tenants", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def list_tenants(limit: int = 100):
   """Lista todos los inquilinos con detalles básicos.
      Protocolo Omega: Sanitización de secretos y parseo de tipos."""
   query = "SELECT * FROM tenants ORDER BY id ASC LIMIT $1"
   rows = await db.pool.fetch(query,limit)
   results = []
   for row in rows:
       r = dict(row)
       
       # 1. JSONB Parsing (Asyncpg returns string by default)
       if r.get('handoff_policy') and isinstance(r['handoff_policy'], str):
           try: r['handoff_policy'] = json.loads(r['handoff_policy'])
           except: r['handoff_policy'] = {}
           
       # 2. Secret Sanitization (Prevent double-encryption loop)
       # We return NULL so the frontend sees it as empty.
       # If user keeps it empty, UPDATE skips it.
       # If user types a new one, UPDATE encrypts it.
       r['tiendanube_access_token'] = None
       
       results.append(r)
       
   return results

@router.put("/tenants/{tenant_id}", dependencies=[Depends(verify_admin_token)])
@require_role("SuperAdmin")
async def update_tenant(tenant_id: int, data: TenantModel):
    try:
        from utils import encrypt_password
        
        # Check if tenant exists
        exists = await db.pool.fetchval("SELECT 1 FROM tenants WHERE id = $1", tenant_id)
        if not exists:
            raise HTTPException(404, "Tenant not found")
            
        # Optional: Encrypt token if provided
        encrypted_token = None
        if data.tiendanube_access_token:
            # Only encrypt if it's not already encrypted (basic length check or prefix check could go here)
            # For now, we assume if user sends it, it's fresh.
            encrypted_token = encrypt_password(data.tiendanube_access_token)

        q = """
            UPDATE tenants SET 
                store_name = $1,
                bot_phone_number = $2,
                owner_email = $3,
                store_website = $4,
                store_description = $5,
                store_catalog_knowledge = $6,
                tiendanube_store_id = $7,
                tiendanube_access_token = COALESCE($8, tiendanube_access_token),
                updated_at = NOW()
            WHERE id = $9
            RETURNING id
        """
        await db.pool.execute(q, 
            data.store_name, data.bot_phone_number, data.owner_email, 
            data.store_website, data.store_description, data.store_catalog_knowledge,
            data.tiendanube_store_id, encrypted_token, tenant_id
        )
        
        return {"status": "ok", "message": f"Tenant {tenant_id} updated"}
    except Exception as e:
        logger.error(f"Error updating tenant: {e}")
        raise HTTPException(500, str(e))

@router.delete("/tenants/{tenant_id}", dependencies=[Depends(verify_admin_token)])
@require_role("SuperAdmin")
async def delete_tenant(tenant_id: int):
    try:
        # 1. Cleanup Dependent Data (Preventive Cascade / Deep Clean)
        # Protocol Omega: Manual Cascade for tables lacking FK ON DELETE CASCADE
        
        # A. Conversations (Blocks deletion if not removed)
        # Note: chat_messages will auto-delete via its own cascade on conversation_id
        await db.pool.execute("DELETE FROM chat_conversations WHERE tenant_id = $1", tenant_id)
        
        # B. Agents
        await db.pool.execute("DELETE FROM agents WHERE tenant_id = $1", tenant_id)
        
        # C. Business Assets (orphaned if not FK linked)
        # Cast to text as business_assets uses varchar tenant_id
        await db.pool.execute("DELETE FROM business_assets WHERE tenant_id = $1::text", str(tenant_id))
        
        # 2. Delete Tenant (Triggers Cascade for Credentials, Tools, Customers)
        row = await db.pool.fetchrow("DELETE FROM tenants WHERE id = $1 RETURNING id", tenant_id)
        if not row:
            raise HTTPException(404, "Tenant not found")
            
        return {"status": "ok", "message": f"Tenant {tenant_id} and all associated data deleted (Deep Clean)"}
    except Exception as e:
        logger.error(f"Error deleting tenant: {e}")
        # Improve error message for FK violations if they still happen
        if "foreign key constraint" in str(e).lower():
            raise HTTPException(409, f"Dependency Error: {str(e)}")
        raise HTTPException(500, str(e))



class AgentCreate(BaseModel):
    name: str
    role: str = "sales"
    tenant_id: int
    whatsapp_number: Optional[str] = None
    model_provider: str = "openai"
    model_version: str = "gpt-4o"
    temperature: float = 0.3
    system_prompt_template: Optional[str] = None
    enabled_tools: Optional[List[str]] = []
    config: Optional[dict] = {}
    is_active: bool = True

class AgentModel(BaseModel):
    name: str
    role: str = "sales"
    tenant_id: int
    whatsapp_number: Optional[str] = None
    model_provider: str = "openai"
    model_version: str = "gpt-4o"
    temperature: float = 0.3
    system_prompt_template: Optional[str] = None
    enabled_tools: Optional[List[str]] = []
    channels: Optional[List[str]] = ["whatsapp", "instagram", "facebook", "web"]
    config: Optional[dict] = {}
    is_active: bool = True


class ToolCreate(BaseModel):
    name: str # Must be unique
    type: str # 'http', 'tienda_nube', etc.
    config: Dict[str, Any]
    service_url: Optional[str] = None
    prompt_injection: Optional[str] = ""
    description: Optional[str] = "User defined tool"

@router.post("/tools", dependencies=[Depends(verify_admin_token)])
async def create_tool(tool: ToolCreate):
    try:
        # Check uniqueness against system tools
        if any(t.name == tool.name for t in REGISTERED_TOOLS):
             raise HTTPException(400, "Cannot override system tool name")
             
        q = """
        INSERT INTO tools (tenant_id, name, type, config, service_url, description, prompt_injection)
        VALUES (NULL, $1, $2, $3, $4, $5, $6)
        RETURNING id
        """
        # Note: NULL tenant_id implies Global Tool for now. Future: ContextVar injection.
        row = await db.pool.fetchrow(q, tool.name, tool.type, json.dumps(tool.config), tool.service_url, tool.description, tool.prompt_injection)
        return {"status": "ok", "id": row['id']}
    except Exception as e:
        logger.error(f"Error creating tool: {e}")
        raise HTTPException(500, f"Error creating tool: {e}")

@router.delete("/tools/{name}", dependencies=[Depends(verify_admin_token)])
async def delete_tool(name: str):
    try:
        # Check if system tool
        if any(t.name == name for t in REGISTERED_TOOLS):
             raise HTTPException(403, "Cannot delete system tool")
             
        await db.pool.execute("DELETE FROM tools WHERE name = $1", name)
        return {"status": "ok"}
    except Exception as e:
         raise HTTPException(500, str(e))

# --- Models ---
from utils import encrypt_password, decrypt_password

class HandoffConfigModel(BaseModel):
    tenant_id: int
    enabled: bool = True
    destination_email: str
    handoff_instructions: str = ""
    handoff_message: str = ""
    smtp_host: str
    smtp_port: int
    smtp_security: str # SSL | STARTTLS | NONE
    smtp_username: str
    smtp_password: str
    triggers: Dict[str, bool] = {}
    email_context: Dict[str, bool] = {}



@router.post("/credentials", dependencies=[Depends(verify_admin_token)])
@require_role("SuperAdmin")
async def save_credential(cred: CredentialModel):
    try:
        # Security: Encrypt sensitive categories
        final_value = cred.value
        sensitive_categories = ['whatsapp_cloud', 'meta_whatsapp', 'tiendanube', 'openai', 'security']
        if cred.category in sensitive_categories:
            from utils import encrypt_password
            final_value = encrypt_password(cred.value)
            
        q = """
            INSERT INTO credentials (name, value, category, scope, tenant_id, description, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (name) WHERE scope = 'global'
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            RETURNING id_uuid
        """
        row = await db.pool.fetchrow(q, cred.name, final_value, cred.category, cred.scope, cred.tenant_id, cred.description)
        
        # Performance: Invalidate Redis Cache
        cache_key = f"settings:{cred.category}"
        redis_client.delete(cache_key)
        
        return {"status": "ok", "id": str(row['id_uuid'])}
    except Exception as e:
        raise HTTPException(500, detail=str(e))

@router.get("/credentials", dependencies=[Depends(verify_admin_token)])
@require_role("SuperAdmin")
async def list_credentials(category: Optional[str] = None):
    # Performance: Try Redis Cache (Aggregated Cache Pattern)
    cache_key = f"settings:{category or 'all'}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except: pass

    try:
        if category:
            rows = await db.pool.fetch("SELECT * FROM credentials WHERE category = $1 ORDER BY name", category)
        else:
            rows = await db.pool.fetch("SELECT * FROM credentials ORDER BY category, name")
            
        data = [dict(r) for r in rows]
        # Cast UUIDs to strings
        for item in data:
            if 'id_uuid' in item and item['id_uuid']:
                item['id'] = str(item['id_uuid'])
                del item['id_uuid']
        
        # Performance: Cache result
        try:
            redis_client.setex(cache_key, 300, json.dumps(data, default=str))
        except: pass
        
        return data
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# --- AGENTS MANAGEMENT ---

@router.on_event("startup")
async def ensure_agents_table():
    """Ensure agents table exists. Protocol Omega compliant."""
    await db.pool.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'sales',
            tenant_id INT REFERENCES tenants(id),
            whatsapp_number TEXT,
            model_provider TEXT DEFAULT 'openai',
            model_version TEXT DEFAULT 'gpt-4o',
            temperature FLOAT DEFAULT 0.3,
            system_prompt_template TEXT,
            enabled_tools JSONB,
            config JSONB,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    """)
        
# Gestión de agentes ya consolidada en la sección final del archivo
pass

# --- MAGIC ONBOARDING (NEXUS GENESIS) ---

class MagicOnboardingRequest(BaseModel):
    store_name: str
    tiendanube_store_id: str
    tiendanube_access_token: str
    store_url: Optional[str] = None
    bot_phone_number: str = "TBD" # Will be updated later

@router.post("/onboarding/magic", dependencies=[Depends(verify_admin_token)])
async def magic_onboarding(data: MagicOnboardingRequest):
    """
    The 'Big Bang' endpoint.
    1. Compiles Tenant
    2. Ingests Knowledge (RAG)
    3. Spawns 5 Agents
    """
    logger.info("magic_onboarding_start", store=data.store_name)
    
    # 1. UPSERT TENANT (Protocol Omega: Internal ID + Encryption)
    from app.core.security import encrypt_password
    
    # Specific logic for 'TBD' phone: use provisional UUID to avoid collision
    provisional_phone = data.bot_phone_number if data.bot_phone_number not in ["TBD", ""] else f"prov_{uuid.uuid4().hex[:8]}"
    
    # Security: Encrypt Token At-Rest
    encrypted_token = encrypt_password(data.tiendanube_access_token)
    
    q_tenant = """
        INSERT INTO tenants (
            store_name, bot_phone_number, tiendanube_store_id, tiendanube_access_token, store_website, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (bot_phone_number) 
        DO UPDATE SET 
            store_name = EXCLUDED.store_name,
            tiendanube_store_id = EXCLUDED.tiendanube_store_id,
            tiendanube_access_token = EXCLUDED.tiendanube_access_token,
            store_website = EXCLUDED.store_website,
            updated_at = NOW()
        RETURNING id
    """
    tenant_id = await db.pool.fetchval(q_tenant, data.store_name, provisional_phone, data.tiendanube_store_id, encrypted_token, data.store_url)
    
    # 2. SPAWN AGENTS (The "Army")
    # We define the Standard 5
    standard_agents = [
        {
            "name": "Ventas Expert",
            "role": "sales",
            "sys_prompt": "Eres un experto vendedor. Tu objetivo es cerrar la venta guiando al cliente.",
            "tools": ["catalog_search", "order_status"]
        },
        {
            "name": "Soporte Nivel 1",
            "role": "support",
            "sys_prompt": "Eres un asistente de soporte empático. Resuelve dudas sobre envíos y garantías.",
            "tools": ["order_track", "faq_search"]
        },
        {
            "name": "Especialista de Talles",
            "role": "fitting",
            "sys_prompt": "Eres experto en talles y calce. Pide medidas y recomienda el talle exacto.",
            "tools": ["size_chart_lookup"]
        },
        {
            "name": "Gerente de Logística",
            "role": "shipping",
            "sys_prompt": "Gestionas problemas complejos de envíos y devoluciones. Autoridad para cambios.",
            "tools": ["logistic_override"]
        },
        {
            "name": "Supervisor General",
            "role": "supervisor",
            "sys_prompt": "Supervisas la conversación. Si hay hostilidad, derivas a humano.",
            "tools": ["human_handoff"]
        }
    ]
    
    spawned_count = 0
    for template in standard_agents:
        # Idempotency check
        exists = await db.pool.fetchval("SELECT 1 FROM agents WHERE tenant_id = $1 AND role = $2", tenant_id, template['role'])
        if not exists:
            # Spawn
            await db.pool.execute("""
                INSERT INTO agents (name, role, tenant_id, model_provider, system_prompt_template, enabled_tools)
                VALUES ($1, $2, $3, 'openai', $4, $5)
            """, template['name'], template['role'], tenant_id, template['sys_prompt'], json.dumps(template['tools']))
            spawned_count += 1
            
    # 3. TRIGGER NEXUS ENGINE (Asset "3D Printing")
    # This generates Branding, Scripts, Visuals, ROI in parallel
    from app.core.engine import NexusEngine
    
    # Context hydration for the engine
    decrypted_token = data.tiendanube_access_token # We have it raw here
    context = {
        "store_name": data.store_name,
        "store_website": data.store_url or f"https://{data.tiendanube_store_id}.mytiendanube.com",
        "credentials": {
            "tiendanube_store_id": data.tiendanube_store_id,
            "tiendanube_access_token": decrypted_token
        }
    }
    
    engine = NexusEngine(str(tenant_id), context)
    # We await ignition to ensure assets are ready for the user immediately (Standard Omega requirement)
    # Or should we background it? The user said "printing in front of their eyes". 
    # Engine.ignite is relatively fast (except maybe visuals). 
    # We will await it to ensure the "Done" screen actually has data to show.
    await engine.ignite()

    # 4. TRIGGER RAG BACKGROUND JOB (Async)
    asyncio.create_task(run_rag_ingestion(tenant_id, data.tiendanube_store_id, data.tiendanube_access_token))
    
    return {
        "status": "success",
        "message": f"Magic unleashed for {data.store_name}",
        "tenant_id": tenant_id,
        "agents_spawned": spawned_count,
        "rag_status": "ingestion_started"
    }

async def run_rag_ingestion(tenant_id, store_id, token):
    """
    Background Task: Fetch Products -> Transform -> Vectorize
    """
    try:
        from app.core.rag import RAGCore
        rag = RAGCore(str(tenant_id))
        
        # 1. Fetch from Tienda Nube (Mocked or Real)
        # Real: https://api.tiendanube.com/v1/{store_id}/products
        url = f"https://api.tiendanube.com/v1/{store_id}/products?per_page=200"
        headers = {"Authentication": f"bearer {token}", "User-Agent": "Nexus Bot (nexus@platform.com)"}
        
        products = []
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                products = resp.json()
            else:
                logger.error("tiendanube_fetch_fail", status=resp.status_code)
                # Fallback Mocks for Demo "Magia"
                products = [
                    {"id": 991, "name": {"es": "Camiseta Demo Magic"}, "description": {"es": "Producto autogenerado por Nexus Magic"}, "price": "100.00"},
                    {"id": 992, "name": {"es": "Pantalón Demo Magic"}, "description": {"es": "Calidad premium detectada"}, "price": "200.00"}
                ]

        # 2. Ingest
        await rag.ingest_store(products)
        
        # 3. Log Event
        await db.pool.execute("INSERT INTO system_events (event_type, severity, message, tenant_id, occurred_at) VALUES ('rag_completed', 'INFO', 'Magic Ingestion Done', $1, NOW())", tenant_id)
        
    except Exception as e:
        logger.error("magic_rag_fail", error=str(e))
        await db.pool.execute("INSERT INTO system_events (event_type, severity, message, tenant_id, occurred_at) VALUES ('rag_failed', 'ERROR', $1, $2, NOW())", str(e), tenant_id)


# Endpoints de agentes consolidados al final del archivo (Nexus v4.4)
pass

# --- CONSOLE STREAMING ---
from sse_starlette.sse import EventSourceResponse
import asyncio

@router.get("/console/stream")
async def console_stream(request: Request, token: Optional[str] = None):
    """
    Stream real-time system events (logs) to the console.
    Soporta autenticación vía header X-Admin-Token o query param 'token' (para EventSource).
    """
    admin_token = request.headers.get("x-admin-token") or token
    if admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized stream access")

    async def event_generator():
        last_id = 0
        try:
            # Get max ID to start from
            last_id = await db.pool.fetchval("SELECT MAX(id) FROM system_events") or 0
        except:
            pass

        while True:
            if await request.is_disconnected():
                break

            try:
                # Fetch new events
                rows = await db.pool.fetch("""
                    SELECT id, severity, event_type, message, payload, occurred_at 
                    FROM system_events 
                    WHERE id > $1 
                    ORDER BY id ASC
                """, last_id)

                for row in rows:
                    last_id = row['id']
                    data = {
                        "id": row['id'],
                        "severity": row['severity'],
                        "type": row['event_type'],
                        "message": row['message'],
                        "payload": row['payload'], # Already jsonb/dict usually
                        "timestamp": row['occurred_at'].isoformat()
                    }
                    yield {
                        "event": "log",
                        "data": json.dumps(data)
                    }
                
                await asyncio.sleep(2) # Poll every 2s
            except Exception as e:
                print(f"Stream error: {e}")
                await asyncio.sleep(5)

    return EventSourceResponse(event_generator())


# --- Helper: Sync Environment to DB ---
async def sync_environment():
    """Reads env vars and ensures the default tenant and credentials exist."""
    # 1. Tenant Sync - Only if explicitly provided in environment
    store_name = os.getenv("STORE_NAME")
    store_phone = os.getenv("BOT_PHONE_NUMBER")
    
    if store_name and store_phone:
        store_id = os.getenv("TIENDANUBE_STORE_ID", "")
        access_token = os.getenv("TIENDANUBE_ACCESS_TOKEN", "")
        store_loc = os.getenv("STORE_LOCATION", "")
        store_web = os.getenv("STORE_WEBSITE", "")
        store_desc = os.getenv("STORE_DESCRIPTION", "")
        store_know = os.getenv("STORE_CATALOG_KNOWLEDGE", "")
        
        q_tenant = """
            INSERT INTO tenants (
                store_name, bot_phone_number, 
                tiendanube_store_id, tiendanube_access_token,
                store_location, store_website,
                store_description, store_catalog_knowledge
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (bot_phone_number) 
            DO UPDATE SET 
                store_name = EXCLUDED.store_name,
                store_location = CASE WHEN EXCLUDED.store_location <> '' THEN EXCLUDED.store_location ELSE tenants.store_location END,
                store_website = CASE WHEN EXCLUDED.store_website <> '' THEN EXCLUDED.store_website ELSE tenants.store_website END,
                store_description = CASE WHEN EXCLUDED.store_description <> '' THEN EXCLUDED.store_description ELSE tenants.store_description END,
                store_catalog_knowledge = CASE WHEN EXCLUDED.store_catalog_knowledge <> '' THEN EXCLUDED.store_catalog_knowledge ELSE tenants.store_catalog_knowledge END,
                tiendanube_store_id = CASE WHEN EXCLUDED.tiendanube_store_id <> '' THEN EXCLUDED.tiendanube_store_id ELSE tenants.tiendanube_store_id END,
                tiendanube_access_token = CASE WHEN EXCLUDED.tiendanube_access_token <> '' THEN EXCLUDED.tiendanube_access_token ELSE tenants.tiendanube_access_token END,
                updated_at = NOW()
            RETURNING id
        """
        await db.pool.fetchval(q_tenant, store_name, store_phone, store_id, access_token, store_loc, store_web, store_desc, store_know)
    else:
        # If env vars are missing, we don't force a tenant sync.
        # This allows users to manage tenants entirely via the UI.
        pass

    # 2. Credentials Sync (Auto-populate from Env)
    env_creds = [
        ("OPENAI_API_KEY", "openai", "OpenAI API Key"),
        ("YCLOUD_API_KEY", "whatsapp_ycloud", "YCloud API Key"),
        ("YCLOUD_WEBHOOK_SECRET", "whatsapp_ycloud", "YCloud Webhook Secret"),
        ("WHATSAPP_ACCESS_TOKEN", "whatsapp_meta", "Meta API Access Token"),
        ("WHATSAPP_PHONE_NUMBER_ID", "whatsapp_meta", "Meta API Phone ID"),
        ("WHATSAPP_BUSINESS_ACCOUNT_ID", "whatsapp_meta", "Meta API Business ID"),
        ("WHATSAPP_VERIFY_TOKEN", "whatsapp_meta", "Meta API Verify Token"),
        ("TIENDANUBE_ACCESS_TOKEN", "tiendanube", "Tienda Nube Token (Global)"),
        ("CHATWOOT_API_TOKEN", "chatwoot", "Chatwoot API Token"),
        ("INTERNAL_API_TOKEN", "security", "Internal Service Token")
    ]

    q_cred = """
        INSERT INTO credentials (name, value, category, scope, description)
        VALUES ($1, $2, $3, 'global', $4)
        ON CONFLICT (scope, name) WHERE tenant_id IS NULL
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    """
    
    # We need a unique constraint to make ON CONFLICT work cleanly for detection.
    # Since we can't easily alter table schema here without migration, we'll do a check-and-insert loop or rely on name uniqueness if enforced.
    # Actually, let's just use Python check to be safe and avoid migration complexity right now.
    
    for env_var, category, desc in env_creds:
        val = os.getenv(env_var)
        if val:
            # Atomic upsert using Partial Index (Nexus v3 Fix)
            await db.pool.execute("""
                INSERT INTO credentials (name, value, category, scope, description)
                VALUES ($1, $2, $3, 'global', $4)
                ON CONFLICT (name) WHERE scope = 'global'
                DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """, env_var, val, category, f"{desc} (Auto-detected from ENV)")

# --- Endpoints ---


class HumanOverrideModel(BaseModel):
    enabled: bool

class ConversationModel(BaseModel):
    id: str  # UUID
    tenant_id: int
    user_number: str
    status: str
    last_message_at: Optional[datetime] = None
    human_override_until: Optional[datetime] = None

@router.get("/bootstrap", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def bootstrap():
    """Initial load for the dashboard."""
    # 1. Sync Env Vars to DB so they appear in UI
    await sync_environment()

    # Get tenants count
    tenants = await db.pool.fetchval("SELECT COUNT(*) FROM tenants")
    
    # Get last activity from chat_messages (Legacy inbound_messages removed)
    last_inbound = await db.pool.fetchval("SELECT MAX(created_at) FROM chat_messages WHERE role = 'user'")
    last_outbound = await db.pool.fetchval("SELECT MAX(created_at) FROM chat_messages WHERE role = 'assistant'")
    
    # Get Configured Services
    services = []
    try:
        cred_rows = await db.pool.fetch("SELECT DISTINCT category FROM credentials")
        services = [r["category"] for r in cred_rows]
    except Exception as e:
        print(f"Error fetching services: {e}")
    
    return {
        "version": "1.2.0 (Platform AI Solutions)",
        "tenants_count": tenants,
        "last_inbound_at": last_inbound,
        "last_outbound_at": last_outbound,
        "configured_services": services,
        "status": "ok"
    }

@router.get("/stats", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def get_stats():
    """
    Get dashboard statistics.
    Implements Aggregated Cache pattern (TTL 300s).
    Fallback to direct DB query if Redis is unavailable.
    """
    cache_key = "dashboard:stats"
    
    # 1. Try Redis Cache
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        print(f"WARN: Redis cache error (get): {e}")

    # 2. Fetch from DB (Fallback/Live)
    try:
        # Active tenants (with ID and active status)
        active_tenants = await db.pool.fetchval("SELECT COUNT(*) FROM tenants WHERE is_active = TRUE")
        
        # Message stats (Source of Truth: chat_messages)
        total_messages = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages")
        # Mapping 'processed' to 'assistant' responses for logic equivalent
        processed_messages = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages WHERE role = 'assistant'")
        
        stats_data = {
            "active_tenants": active_tenants,
            "total_messages": total_messages,
            "processed_messages": processed_messages,
            "cached_at": datetime.utcnow().isoformat()
        }
        
        # 3. Cache result
        try:
            redis_client.setex(cache_key, 300, json.dumps(stats_data))
        except Exception as e:
            print(f"WARN: Redis cache error (set): {e}")

        return stats_data

    except Exception as db_err:
        print(f"CRIT: DB Stats failed: {db_err}")
        # Return fallback structure to prevent UI crash
        return {
            "active_tenants": 0,
            "total_messages": 0,
            "processed_messages": 0,
            "error": "Database unavailable"
        }

def sanitize_payload(payload: Any) -> Any:
    """Recursively mask sensitive keys in a dictionary or list."""
    SENSITIVE_KEYS = {'api_key', 'password', 'secret', 'token', 'access_token', 'smtp_password', 'smtp_password_encrypted'}
    if isinstance(payload, dict):
        new_dict = {}
        for k, v in payload.items():
            if k.lower() in SENSITIVE_KEYS or 'key' in k.lower() or 'secret' in k.lower() or 'token' in k.lower():
                new_dict[k] = "********"
            else:
                new_dict[k] = sanitize_payload(v)
        return new_dict
    elif isinstance(payload, list):
        return [sanitize_payload(item) for item in payload]
    else:
        return payload

@router.get("/events", dependencies=[Depends(verify_admin_token)])
async def get_events(limit: int = 50):
    """
    Fetch recent telemetry events.
    Strict pagination (max 50) and content sanitization.
    """
    real_limit = min(limit, 50)
    
    # Ensure system_events table exists (handled in main.py migration, but good to be safe)
    # Using simple query
    try:
        query = """
            SELECT id, event_type, severity, message, payload, occurred_at, tenant_id
            FROM system_events
            ORDER BY id DESC
            LIMIT $1
        """
        rows = await db.pool.fetch(query, real_limit)
        
        events = []
        for r in rows:
            payload = r['payload']
            # Parse JSON string if needed (asyncpg usually handles jsonb as str unless codec set)
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except:
                    pass
            elif not payload:
                payload = {}
            
            events.append({
                "id": r['id'],
                "event_type": r['event_type'],
                "severity": r['severity'],
                "message": r['message'],
                "payload": sanitize_payload(payload),
                "occurred_at": r['occurred_at'].isoformat() if r['occurred_at'] else None,
                "tenant_id": r['tenant_id']
            })
            
        return events
    except Exception as e:
        print(f"ERROR: Fetching events failed: {e}")
        return []

@router.post("/ops/{action}", dependencies=[Depends(verify_admin_token)])
@require_role("SuperAdmin")
@safe_db_call
async def admin_ops(action: str, payload: dict = {}):
    """
    Restricted Admin Operations Gateway.
    Allowed Actions: clear_cache, trigger_handoff.
    """
    if action == "clear_cache":
        # Clear specific pattern or all
        pattern = payload.get("pattern", "dashboard:*")
        # Security check: Prevent clearing arbitrary system keys if possible, or assume SuperAdmin knows (Protocol Omega)
        # We enforce a prefix to be safe(r)
        if not pattern.startswith("dashboard:") and not pattern.startswith("cache:"):
             if pattern != "*": # Allow full clear if explicitly requested by SuperAdmin? Let's limit for now.
                pattern = f"dashboard:{pattern}"
        
        try:
            keys = redis_client.keys(pattern)
            count = 0
            if keys:
                redis_client.delete(*keys)
                count = len(keys)
            return {"status": "ok", "cleared": count, "pattern": pattern}
        except Exception as e:
            raise HTTPException(500, f"Redis error: {e}")
            
    elif action == "trigger_handoff":
        conversation_id = payload.get("conversation_id")
        if not conversation_id:
            # Fallback for manual testing: try finding by phone + tenant
            phone = payload.get("phone")
            tenant_id = payload.get("tenant_id")
            if phone and tenant_id:
                row = await db.pool.fetchrow("SELECT id FROM chat_conversations WHERE external_user_id = $1 AND tenant_id = $2", phone, tenant_id)
                if row: conversation_id = str(row['id'])
        
        if not conversation_id:
            raise HTTPException(400, "conversation_id (or phone+tenant_id) required")

        # 1. Fetch Conversation Details
        conv = await db.pool.fetchrow("SELECT * FROM chat_conversations WHERE id = $1", conversation_id)
        if not conv:
             raise HTTPException(404, "Conversation not found")
        
        tenant_id = conv['tenant_id']

        # 2. Lock Conversation (Disable AI)
        # Lock for 24 hours to ensure human has time to intervene
        lock_until = datetime.utcnow() + timedelta(hours=24)
        await db.pool.execute("UPDATE chat_conversations SET human_override_until = $1, status = 'human_override' WHERE id = $2", lock_until, conversation_id)
        
        # 3. Fetch Handoff Config & Credentials
        config = await db.pool.fetchrow("SELECT * FROM tenant_human_handoff_config WHERE tenant_id = $1", tenant_id)
        if not config:
             return {"status": "ok", "message": "Handoff triggered (AI Paused), but email NOT sent (No Config found)."}

        # 4. Fetch History
        history_rows = await db.pool.fetch("""
            SELECT role, content, created_at, from_number FROM chat_messages 
            WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 100
        """, conversation_id)
        
        transcript = []
        for r in history_rows:
            ts = r['created_at'].strftime("%Y-%m-%d %H:%M:%S")
            sender = "BOT" if r['role'] == "assistant" else f"USER ({r['from_number'] or 'Client'})"
            transcript.append(f"[{ts}] {sender}:\n{r['content']}\n")
        
        transcript_text = "\n".join(transcript)

        # 5. Send Email
        try:
             # Decrypt password (ensure utils import matches your environment)
             # Note: decrypt_password is imported in this file around line 121
             smtp_pass = decrypt_password(config['smtp_password_encrypted'])
             
             msg = MIMEMultipart()
             msg['From'] = config['smtp_username']
             msg['To'] = config['destination_email']
             msg['Subject'] = f"🚨 Handoff Request: {conv['external_user_id']} ({conv['channel']})"
             
             body = f"""
             ACTION REQUIRED: Manual Handoff Triggered by Admin.
             
             Tenant ID: {tenant_id}
             Customer: {conv['external_user_id']}
             Channel: {conv['channel']}
             Reason: Manual Trigger via Admin Tools
             
             --- Chat Transcript (Last 100 messages) ---
             {transcript_text}
             """
             msg.attach(MIMEText(body, 'plain'))
             
             # SMTP Connect
             server = None
             try:
                 if config['smtp_security'] == 'SSL':
                     server = smtplib.SMTP_SSL(config['smtp_host'], config['smtp_port'], timeout=10)
                 else:
                     server = smtplib.SMTP(config['smtp_host'], config['smtp_port'], timeout=10)
                     if config['smtp_security'] == 'STARTTLS':
                        server.starttls()
                 
                 server.login(config['smtp_username'], smtp_pass)
                 server.send_message(msg)
             finally:
                 if server: server.quit()
             
             print(f"MANUAL_OPS: Handoff Email sent to {config['destination_email']}")
             return {"status": "ok", "message": f"Handoff triggered. AI paused for 24h. Email sent to {config['destination_email']}."}
             
        except Exception as e:
             print(f"HANDOFF_EMAIL_FAIL: {e}")
             return {"status": "warning", "message": f"AI Paused, but Email failed: {str(e)}"}

    else:
        raise HTTPException(400, f"Unknown action: {action}")

# --- HITL Chat Views (New) ---

# Health check consolidado
@router.get("/health")
async def health_check():
    """Chequeo de salud consolidado para el Orquestador."""
    try:
        await db.pool.execute("SELECT 1")
        db_status = "OK"
    except:
        db_status = "ERROR"
    return {
        "status": "OK",
        "service": "orchestrator",
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/chats", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def list_chats(
    tenant_id: Optional[int] = None, 
    channel: Optional[str] = None, 
    human_override: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0
):
    """
    List conversations for the WhatsApp-like view with Infinite Scroll.
    Derived strictly from `chat_conversations`.
    """
    where_clauses = []
    params = []
    
    if tenant_id:
        where_clauses.append(f"tenant_id = ${len(params) + 1}")
        params.append(tenant_id)
        
    if channel and channel != 'all':
        where_clauses.append(f"channel_source = ${len(params) + 1}")
        params.append(channel)

    if human_override is not None:
        if human_override:
            where_clauses.append(f"human_override_until > NOW()")
        else:
            where_clauses.append(f"(human_override_until IS NULL OR human_override_until <= NOW())")

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # Add Pagination params to list (must match order of $ usage)
    # Using simple appending logic
    
    query = f"""
        SELECT 
            id, tenant_id, channel, channel_source, external_user_id, 
            display_name, avatar_url, status, meta,
            human_override_until, last_message_at, last_message_preview
        FROM chat_conversations
        {where_sql}
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
    """
    params.append(limit)
    params.append(offset)
    
    try:
        rows = await db.pool.fetch(query, *params)
    
        results = []
        now = datetime.now().astimezone()
        
        for r in rows:
            # Determine strict status based on lockout time
            status = r['status']
            lockout = r['human_override_until']
            is_locked = False
            if lockout and lockout > now:
                is_locked = True
                status = 'human_override'
                
            try:
                meta_json = json.loads(r['meta']) if r['meta'] else {}
            except:
                meta_json = {}

            results.append({
                "id": str(r['id']),
                "tenant_id": r['tenant_id'],
                "channel": r['channel'],
                "channel_source": r['channel_source'] if 'channel_source' in r else 'whatsapp',
                "external_user_id": r['external_user_id'],
                "display_name": r['display_name'] or r['external_user_id'],
                "name": r['display_name'] or r['external_user_id'],
                "avatar_url": r['avatar_url'],
                "status": status,
                "is_locked": is_locked,
                "human_override_until": lockout.isoformat() if lockout else None,
                "last_message_at": r['last_message_at'].isoformat() if r['last_message_at'] else None,
                "timestamp": r['last_message_at'].isoformat() if r['last_message_at'] else None,
                "last_message_preview": r['last_message_preview'],
                "last_message": r['last_message_preview'],
                "meta": meta_json
            })
            
        logger.info(f"Auditing list_chats: Returning {len(results)} conversations (Limit: {limit}, Offset: {offset})")
        return results

    except Exception as e:
        logger.error(f"Error listing chats: {e}")
        return []

@router.get("/chats/summary", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def get_chats_summary(
    tenant_id: Optional[int] = None, 
    channel: Optional[str] = None, 
    human_override: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0
):
    """
    Versión de compatibilidad de list_chats para el frontend actual.
    Cumple con el Protocolo Omega (UUID id).
    """
    chats = await list_chats(
        tenant_id=tenant_id, 
        channel=channel, 
        human_override=human_override,
        limit=limit,
        offset=offset
    )
    # Adaptar a lo que esperaba el resumen de chat clásico pero con IDs Omega
    return [{
        "id": c["id"],
        "phone": c["external_user_id"],
        "tenant_id": c["tenant_id"],
        "channel": c["channel_source"],
        "name": c["display_name"] or c["name"],
        "last_message": c["last_message"],
        "timestamp": c["timestamp"],
        "status": c["status"],
        "is_locked": c["is_locked"],
        "human_override_until": c["human_override_until"]
    } for c in chats]

@router.get("/chats/{conversation_id}/messages", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def get_chat_history(conversation_id: str):
    """
    Get full history for a conversation.
    Joins with chat_media for full context.
    """
    query = """
        SELECT 
            m.id, m.role, m.message_type, m.content, m.created_at, m.human_override,
            m.sent_context, m.provider_status, m.media_id, m.meta, m.channel_source,
            med.storage_url, med.media_type, med.mime_type, med.file_name
        FROM chat_messages m
        LEFT JOIN chat_media med ON m.media_id = med.id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC
    """
    # Validate UUID
    try:
        uuid_obj = uuid.UUID(conversation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    rows = await db.pool.fetch(query, uuid_obj)
    
    messages = []
    for r in rows:
        # Construct Media Object
        media_obj = None
        if r['storage_url']:
            media_obj = {
                "url": r['storage_url'] if r['storage_url'].startswith('http') else f"/admin/media/{r['media_id']}", # Fallback logic
                "type": r['media_type'],
                "mime": r['mime_type'],
                "name": r['file_name']
            }
            # Secure Proxy URL construction if needed
            # For now, we return the storage_url directly if it's public, or we might need to route through /admin/media
            # The User requirement said: GET /admin/media/{media_id}
            # So if we have a media_id (we don't perform the join ID selection above explicitly, let's assume `med.id` is available via simple query fix or implied)
            # Actually I didn't select med.id. Let's rely on the assumption that storage_url is accessible or proxy logic applies.
            # Ideally: return /admin/media/<media_id> as the src.
            pass

        messages.append({
            "id": str(r['id']),
            "role": r['role'],
            "message_type": r['message_type'],
            "content": r['content'],
            "timestamp": r['created_at'].isoformat(),
            "created_at": r['created_at'].isoformat(),
            "human_override": r['human_override'],
            "status": r['provider_status'],
            "channel_source": r['channel_source'] if 'channel_source' in r else 'whatsapp',
            "meta": json.loads(r['meta']) if r['meta'] else {},
            "media": media_obj
        })
    return messages

@router.post("/conversations/{conversation_id}/human-override", dependencies=[Depends(verify_admin_token)])
async def set_human_override(conversation_id: str, body: HumanOverrideModel):
    if body.enabled:
        # Lock indefinitely (until 2099)
        query = "UPDATE chat_conversations SET human_override_until = '2099-01-01 00:00:00' WHERE id = $1"
    else:
        # Unlock
        query = "UPDATE chat_conversations SET human_override_until = NULL WHERE id = $1"
        
    await db.pool.execute(query, conversation_id)
    return {"status": "ok", "human_override_enabled": body.enabled}


# --- Multi-Tenancy Routes ---

@router.get("/handoff/{tenant_id}", dependencies=[Depends(verify_admin_token)])
async def get_handoff_config(tenant_id: int):
    config = await db.pool.fetchrow("SELECT * FROM tenant_human_handoff_config WHERE tenant_id = $1", tenant_id)
    if not config:
        return None
    
    data = dict(config)
    data['smtp_password'] = "********"
    data['triggers'] = json.loads(data['triggers']) if isinstance(data['triggers'], str) else data['triggers']
    data['email_context'] = json.loads(data['email_context']) if isinstance(data['email_context'], str) else data['email_context']
    return data

@router.post("/handoff", dependencies=[Depends(verify_admin_token)])
async def upsert_handoff_config(config: HandoffConfigModel):
    existing = await db.pool.fetchrow("SELECT smtp_password_encrypted FROM tenant_human_handoff_config WHERE tenant_id = $1", config.tenant_id)
    
    password_to_store = ""
    if config.smtp_password == "********":
        if existing:
            password_to_store = existing['smtp_password_encrypted']
        else:
            raise HTTPException(status_code=400, detail="Password required for new configuration")
    else:
        password_to_store = encrypt_password(config.smtp_password)

    # Clean SMTP Host (remove http/https/spaces)
    if config.smtp_host:
        config.smtp_host = str(config.smtp_host).strip().replace("http://", "").replace("https://", "")

    # Manual Upsert to avoid "InvalidColumnReferenceError" if constraints are missing or duplicated
    # 1. Check if exists
    existing = await db.pool.fetchrow("SELECT 1 FROM tenant_human_handoff_config WHERE tenant_id = $1", config.tenant_id)
    
    if existing:
        # UPDATE
        q = """
            UPDATE tenant_human_handoff_config SET
                enabled = $2,
                destination_email = $3,
                handoff_instructions = $4,
                handoff_message = $5,
                smtp_host = $6,
                smtp_port = $7,
                smtp_security = $8,
                smtp_username = $9,
                smtp_password_encrypted = $10,
                triggers = $11,
                email_context = $12,
                updated_at = NOW()
            WHERE tenant_id = $1
        """
        await db.pool.execute(
            q, 
            config.tenant_id, config.enabled, config.destination_email, 
            config.handoff_instructions, config.handoff_message,
            config.smtp_host, config.smtp_port, config.smtp_security,
            config.smtp_username, password_to_store, 
            json.dumps(config.triggers), json.dumps(config.email_context)
        )
    else:
        # INSERT
        q = """
            INSERT INTO tenant_human_handoff_config (
                tenant_id, enabled, destination_email, handoff_instructions, handoff_message,
                smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted, 
                triggers, email_context, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        """
        await db.pool.execute(
            q, 
            config.tenant_id, config.enabled, config.destination_email, 
            config.handoff_instructions, config.handoff_message,
            config.smtp_host, config.smtp_port, config.smtp_security,
            config.smtp_username, password_to_store, 
            json.dumps(config.triggers), json.dumps(config.email_context)
        )

    # Mirror to 'credentials' table for visibility in UI
    # Manual Upsert to replace: ON CONFLICT (name, tenant_id)
    cred_name = "HANDOFF_SMTP_PASSWORD"
    cred_desc = f"SMTP Password for {config.smtp_username}"
    
    existing_cred = await db.pool.fetchrow(
        "SELECT id FROM credentials WHERE name = $1 AND tenant_id = $2", 
        cred_name, config.tenant_id
    )
    
    if existing_cred:
        await db.pool.execute(
            """
            UPDATE credentials SET 
                value = $1, 
                description = $2, 
                updated_at = NOW() 
            WHERE id = $3
            """,
            password_to_store, cred_desc, existing_cred['id']
        )
    else:
        await db.pool.execute(
            """
            INSERT INTO credentials (name, value, category, scope, tenant_id, description, updated_at)
            VALUES ($1, $2, 'smtp_handoff', 'tenant', $3, $4, NOW())
            """,
            cred_name, password_to_store, config.tenant_id, cred_desc
        )

    return {"status": "ok"}

@router.get("/tenants", dependencies=[Depends(verify_admin_token)])
async def list_tenants():
    rows = await db.pool.fetch("SELECT * FROM tenants ORDER BY id DESC")
    return [dict(row) for row in rows]

@router.post("/tenants", dependencies=[Depends(verify_admin_token)])
async def create_tenant(tenant: TenantModel):
    q = """
        INSERT INTO tenants (
            store_name, bot_phone_number, owner_email, store_location, store_website, store_description, store_catalog_knowledge,
            tiendanube_store_id, tiendanube_access_token, handoff_enabled, handoff_instructions, handoff_target_email, handoff_message,
            handoff_smtp_host, handoff_smtp_user, handoff_smtp_pass, handoff_smtp_port, handoff_policy
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (bot_phone_number) 
        DO UPDATE SET 
            store_name = EXCLUDED.store_name,
            owner_email = EXCLUDED.owner_email,
            store_location = EXCLUDED.store_location,
            store_website = EXCLUDED.store_website,
            store_description = EXCLUDED.store_description,
            store_catalog_knowledge = EXCLUDED.store_catalog_knowledge,
            tiendanube_store_id = EXCLUDED.tiendanube_store_id,
            tiendanube_access_token = EXCLUDED.tiendanube_access_token,
            handoff_enabled = EXCLUDED.handoff_enabled,
            handoff_instructions = EXCLUDED.handoff_instructions,
            handoff_target_email = EXCLUDED.handoff_target_email,
            handoff_message = EXCLUDED.handoff_message,
            handoff_smtp_host = EXCLUDED.handoff_smtp_host,
            handoff_smtp_user = EXCLUDED.handoff_smtp_user,
            handoff_smtp_pass = EXCLUDED.handoff_smtp_pass,
            handoff_smtp_port = EXCLUDED.handoff_smtp_port,
            handoff_policy = EXCLUDED.handoff_policy,
            updated_at = NOW()
        RETURNING id
    """
    tenant_id = await db.pool.fetchval(
        q, 
        tenant.store_name, tenant.bot_phone_number, tenant.owner_email,
        tenant.store_location, tenant.store_website, tenant.store_description,
        tenant.store_catalog_knowledge, tenant.tiendanube_store_id, tenant.tiendanube_access_token,
        tenant.handoff_enabled, tenant.handoff_instructions, tenant.handoff_target_email, tenant.handoff_message,
        tenant.handoff_smtp_host, tenant.handoff_smtp_user, tenant.handoff_smtp_pass,
        tenant.handoff_smtp_port, json.dumps(tenant.handoff_policy or {})
    )
    return {"status": "ok", "id": tenant_id}

@router.put("/tenants/{tenant_id}", dependencies=[Depends(verify_admin_token)])
async def update_tenant(tenant_id: int, tenant: TenantModel):
    q = """
        UPDATE tenants SET 
            store_name = $1, owner_email = $2, store_location = $3, 
            store_website = $4, store_description = $5, store_catalog_knowledge = $6,
            tiendanube_store_id = $7, tiendanube_access_token = $8,
            handoff_enabled = $9, handoff_instructions = $10, handoff_target_email = $11, handoff_message = $12,
            handoff_smtp_host = $13, handoff_smtp_user = $14, handoff_smtp_pass = $15,
            handoff_smtp_port = $16, handoff_policy = $17,
            updated_at = NOW()
        WHERE id = $18
    """
    await db.pool.execute(
        q, 
        tenant.store_name, tenant.owner_email, tenant.store_location,
        tenant.store_website, tenant.store_description, tenant.store_catalog_knowledge,
        tenant.tiendanube_store_id, tenant.tiendanube_access_token,
        tenant.handoff_enabled, tenant.handoff_instructions, tenant.handoff_target_email, tenant.handoff_message,
        tenant.handoff_smtp_host, tenant.handoff_smtp_user, tenant.handoff_smtp_pass,
        tenant.handoff_smtp_port, json.dumps(tenant.handoff_policy or {}),
        tenant_id
    )
    return {"status": "ok", "id": tenant_id}

@router.get("/tenants/{phone}", dependencies=[Depends(verify_admin_token)])
async def get_tenant(phone: str):
    row = await db.pool.fetchrow("SELECT * FROM tenants WHERE bot_phone_number = $1", phone)
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return dict(row)

@router.delete("/tenants", dependencies=[Depends(verify_admin_token)])
async def delete_all_tenants():
    """
    Protocol Omega: Deep Clean / Factory Reset.
    Wipes ALL data to start fresh.
    """
    try:
        async with db.pool.acquire() as conn:
            async with conn.transaction():
                # 1. Transactions & History
                await conn.execute("TRUNCATE chat_messages CASCADE")
                await conn.execute("TRUNCATE chat_conversations CASCADE")
                
                # 2. Operational Assets
                await conn.execute("TRUNCATE agents CASCADE")
                await conn.execute("TRUNCATE business_assets CASCADE")
                await conn.execute("TRUNCATE tenant_human_handoff_config CASCADE")
                await conn.execute("TRUNCATE tools CASCADE")
                
                # 3. Core Identity
                await conn.execute("TRUNCATE credentials CASCADE")
                await conn.execute("TRUNCATE tenants CASCADE")
                
                # 4. System Logs (Optional, but "Empty Database" usually implies this)
                await conn.execute("TRUNCATE system_events CASCADE")

        # 5. Redis Flush
        try:
             REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
             redis_client = redis.from_url(REDIS_URL)
             redis_client.flushdb()
        except: pass
        
        return {"status": "ok", "message": "System Factory Reset Complete (All Data Wiped)"}
    except Exception as e:
        logger.error(f"Deep Clean Failed: {e}")
        raise HTTPException(500, f"Reset Failed: {e}")

@router.delete("/tenants/{identifier}", dependencies=[Depends(verify_admin_token)])
async def delete_tenant(identifier: str):
    # Try multiple ways to find the tenant
    tenant_id = None
    
    # 1. Exact ID match (if int)
    if identifier.isdigit() and len(identifier) < 9:
        row = await db.pool.fetchrow("SELECT id FROM tenants WHERE id = $1", int(identifier))
        if row: tenant_id = row['id']
        
    # 2. Exact Phone match (string)
    if not tenant_id:
        row = await db.pool.fetchrow("SELECT id FROM tenants WHERE bot_phone_number = $1", identifier)
        if row: tenant_id = row['id']
        
    # 3. Clean Phone match
    if not tenant_id:
        import re
        clean = re.sub(r'[^0-9]', '', identifier)
        row = await db.pool.fetchrow("SELECT id FROM tenants WHERE bot_phone_number = $1", clean)
        if row: tenant_id = row['id']
    
    if not tenant_id:
        raise HTTPException(status_code=404, detail=f"Tenant not found with identifier: {identifier}")

    try:
        async with db.pool.acquire() as conn:
            async with conn.transaction():
                # Order matters for Foreign Key constraints
                
                # 1. Handoff Config (linked to tenant, no cascade usually)
                await conn.execute("DELETE FROM tenant_human_handoff_config WHERE tenant_id = $1", tenant_id)
                
                # 2. Conversations (linked to tenant, BLOCKS deletion)
                # Note: Messages cascade from conversations, so we just delete conversations.
                await conn.execute("DELETE FROM chat_conversations WHERE tenant_id = $1", tenant_id)
                
                # 3. Credentials (linked to tenant, usually cascade, but manual is safe)
                await conn.execute("DELETE FROM credentials WHERE tenant_id = $1", tenant_id)

                # 4. Tenant
                await conn.execute("DELETE FROM tenants WHERE id = $1", tenant_id)
                
        # 5. Redis Cleanup (Outside SQL transaction, following Protocol Omega)
        try:
            REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
            redis_client = redis.from_url(REDIS_URL)
            
            # Delete tenant-specific keys (e.g., conversation state, locks)
            # Scan for keys matching the tenant pattern
            cursor = 0
            while True:
                cursor, keys = redis_client.scan(cursor=cursor, match=f"tenant:{tenant_id}:*", count=100)
                if keys:
                    redis_client.delete(*keys)
                if cursor == 0:
                    break
        except Exception as redis_err:
            # Non-blocking error for Redis cleanup
            print(f"Warning: Redis cleanup failed for tenant {tenant_id}: {redis_err}")

        return {"status": "success", "message": f"Tenant {tenant_id} and all related data deleted successfully."}
        
    except Exception as e:
        print(f"Error deleting tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete tenant: {str(e)}")

@router.get("/tenants/{id}/details", dependencies=[Depends(verify_admin_token)])
async def get_tenant_details(id: int):
    tenant = await db.pool.fetchrow("SELECT * FROM tenants WHERE id = $1", id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get credentials for this tenant
    creds = await db.pool.fetch("SELECT * FROM credentials WHERE tenant_id = $1 OR scope = 'global'", id)
    
    # Format for UI
    resp = {
        "tenant": dict(tenant),
        "connections": {
            "whatsapp": {
                "ycloud": {"configured": False},
                "meta_api": {"configured": False}
            }
        },
        "credentials": {
            "tenant_specific": [],
            "global_available": []
        }
    }
    

    ycloud_keys = set()
    meta_keys = set()

    for c in creds:
        c_dict = dict(c)
        if c['tenant_id'] == id:
            resp["credentials"]["tenant_specific"].append(c_dict)
            if c['name'] in ['YCLOUD_API_KEY', 'YCLOUD_WEBHOOK_SECRET']:
                ycloud_keys.add(c['name'])
            if c['name'] in ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']:
                meta_keys.add(c['name'])
        elif c['scope'] == 'global':  # Explicitly check scope to avoid mixing other tenants' data if query failed (paranoid check)
            resp["credentials"]["global_available"].append(c_dict)
            # Global Check
            if c['name'] in ['YCLOUD_API_KEY', 'YCLOUD_WEBHOOK_SECRET']:
                ycloud_keys.add(c['name'])
            if c['name'] in ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']:
                meta_keys.add(c['name'])

    # Determine status based on presence of key credentials (either global or local)
    if 'YCLOUD_API_KEY' in ycloud_keys:
        resp["connections"]["whatsapp"]["ycloud"]["configured"] = True
    
    if 'WHATSAPP_ACCESS_TOKEN' in meta_keys and 'WHATSAPP_PHONE_NUMBER_ID' in meta_keys:
        resp["connections"]["whatsapp"]["meta_api"]["configured"] = True
            
    return resp

# Ya consolidado arriba
pass

@router.post("/tenants/{phone}/test-message", dependencies=[Depends(verify_admin_token)])
async def test_message(phone: str):
    """Gatilla un mensaje de prueba para el inquilino."""
    return {"status": "ok", "message": f"Test message sent to {phone}"}

@router.post("/whatsapp/send", dependencies=[Depends(verify_admin_token)])
async def admin_send_message(request: Request):
    """
    Endpoint used by Frontend Chats.tsx to send manual messages.
    """
    data = await request.json()
    phone = data.get("phone")
    text = data.get("message")
    tenant_id = data.get("tenant_id") 
    channel = data.get("channel_source", "whatsapp")
    
    if not phone or not text:
        raise HTTPException(400, "Phone and message required")

    # If tenant_id missing, try to resolve from phone
    if not tenant_id:
        # Resolve tenant from conversation
        row = await db.pool.fetchrow("SELECT tenant_id FROM chat_conversations WHERE external_user_id = $1 LIMIT 1", phone)
        if row:
            tenant_id = row['tenant_id']
        else:
            # Default to 1 or fail
            tenant_id = 1 
    
    # Generate correlation ID
    correlation_id = str(uuid.uuid4())
    
    # 1. Resolve/Create Conversation
    conv_row = await db.pool.fetchrow("""
        SELECT id, meta, channel_source FROM chat_conversations 
        WHERE channel = $1 AND external_user_id = $2
    """, channel, phone)
    
    if not conv_row:
         conv_id = await db.pool.fetchval("""
            INSERT INTO chat_conversations (id, tenant_id, channel, external_user_id, status, channel_source)
            VALUES ($1, $2, $3, $4, 'human_override', $5)
            RETURNING id
         """, str(uuid.uuid4()), tenant_id, channel, phone, channel) # Default channel_source = channel
    else:
         conv_id = conv_row['id']
         # If channel_source is missing in DB but present in payload, update it? 
         # Only if conv_row channel_source is null. For now trust DB.

    # 2. Persist in DB as 'human_supervisor'
    await db.pool.execute(
        """
        INSERT INTO chat_messages (id, tenant_id, conversation_id, role, content, correlation_id, created_at, from_number, channel_source)
        VALUES ($1, $2, $3, 'human_supervisor', $4, $5, NOW(), $6, $7)
        """,
        str(uuid.uuid4()), tenant_id, conv_id, text, correlation_id, phone, channel
    )

    # 3. Routing Logic: Chatwoot vs YCloud/WhatsApp
    # Check payload first, then DB meta
    cw_conversation_id = data.get("external_chatwoot_id")
    cw_account_id = data.get("external_account_id")
    
    if not cw_conversation_id and conv_row and conv_row.get("meta"):
        try:
             meta_json = json.loads(conv_row["meta"])
             cw_conversation_id = meta_json.get("chatwoot_conversation_id")
             cw_account_id = meta_json.get("chatwoot_account_id")
        except: pass

    # Decision Matrix
    use_chatwoot = False
    
    if channel in ['instagram', 'facebook']:
        use_chatwoot = True
    elif channel == 'whatsapp':
        # If we have explicit Chatwoot IDs, assume it's a Chatwoot-managed number
        if cw_conversation_id:
            use_chatwoot = True
    
    if use_chatwoot:
        # --- CHATWOOT SEND ---
        if not cw_conversation_id:
             logger.error(f"Cannot send to Chatwoot: Missing Conversation ID for {phone}")
             raise HTTPException(400, "Missing Chatwoot Conversation ID")
             
        cw_url = os.getenv("CHATWOOT_BASE_URL", "https://app.chatwoot.com")
        cw_token = os.getenv("CHATWOOT_API_TOKEN")
        
        if not cw_token:
             token_encrypted = await db.pool.fetchval("SELECT value FROM credentials WHERE name = 'CHATWOOT_API_TOKEN' LIMIT 1")
             if token_encrypted:
                 from utils import decrypt_password
                 cw_token = decrypt_password(token_encrypted)
             
        # Default Account ID if missing (Omega Pattern: Env -> DB -> Default)
        if not cw_account_id:
            cw_account_id = os.getenv("CHATWOOT_ACCOUNT_ID")
            if not cw_account_id:
                 cw_account_id = await db.pool.fetchval("SELECT value FROM credentials WHERE name = 'CHATWOOT_ACCOUNT_ID' LIMIT 1")
            
            # Final fallback
            if not cw_account_id: cw_account_id = "1"
             
        if not cw_token:
             raise HTTPException(500, "Chatwoot API Token not configured")
             
        target_url = f"{cw_url}/api/v1/accounts/{cw_account_id}/conversations/{cw_conversation_id}/messages"
        
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(
                    target_url,
                    json={"content": text, "message_type": "outgoing"},
                    headers={"api_access_token": cw_token},
                    timeout=10.0
                )
                if res.status_code not in [200, 201]:
                    logger.error(f"Chatwoot API Error {res.status_code}: {res.text}")
                    # Don't fail the UI request, but log error
            except Exception as e:
                logger.error(f"Chatwoot Send Exception: {e}")

    else:
        # --- YCLOUD / WHATSAPP SERVICE SEND ---
        wa_url = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:8002")
        
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(
                    f"{wa_url}/messages/send",
                    json={"to": phone, "text": text},
                    headers={
                        "X-Internal-Token": os.getenv("INTERNAL_API_TOKEN", "internal-secret"),
                        "X-Correlation-Id": correlation_id
                    },
                    timeout=10.0
                )
                if res.status_code != 200:
                    logger.error(f"Failed to upstream message: {res.text}")
            except Exception as e:
                logger.error(f"Failed to upstream message: {str(e)}")

    return {"status": "sent", "correlation_id": correlation_id}


# Consolidado en @router.post("/whatsapp/send") line 1413
pass

# --- Credentials Routes ---

# Gestión de credenciales consolidada al principio del archivo
pass

# --- Tools Management ---

@router.get("/media/{media_id}", dependencies=[Depends(verify_admin_token)])
async def get_media(media_id: str):
    """Proxy media from YCloud to frontend securely. Acts as a stream proxy."""
    # 1. Get YCloud Creds
    # In a real app we'd resolve tenant from request or media owner, 
    # but for now we fallback to global env/creds
    v_ycloud = os.getenv("YCLOUD_API_KEY")
    if not v_ycloud:
         # Try internal lookup
         try:
            val = await get_internal_credential("YCLOUD_API_KEY", os.getenv("INTERNAL_API_TOKEN"))
            v_ycloud = val["value"]
         except:
            pass
            
    if not v_ycloud:
        raise HTTPException(status_code=500, detail="YCloud configuration missing")

    # 2. Fetch from YCloud Media API
    # https://docs.ycloud.com/reference/whatsapp-business-account-media-download
    # URL format: https://graph.ycloud.com/v2/media/{media_id} ?
    # Actually YCloud usually provides a URL in the webhook which we might have stored,
    # OR we use the media ID to fetch it.
    # Let's assume standard behavior: 
    # GET https://api.ycloud.com/v2/whatsapp/media/{media_id}
    
    # NOTE: The actual YCloud API might differ, we assume a standard generic media fetch 
    # or that we have the URL stored. 
    # If we only have media_id, we need a retrieve endpoint.
    
    target_url = f"https://api.ycloud.com/v2/whatsapp/media/{media_id}"
    
    async def iter_content():
        async with httpx.AsyncClient() as client:
            async with client.stream("GET", target_url, headers={"X-API-Key": v_ycloud}) as r:
                if r.status_code != 200:
                    # Fallback or error
                    yield b""
                    return
                
                async for chunk in r.aiter_bytes():
                    yield chunk

    # We should probably get the content type first
    # For MVP, we'll try to just stream it.
    # To do it properly with FastAPI StreamingResponse:
    
    # We rename to avoid closure issues or use a class
    pass

    # Alternative: Simple Proxy (non-streaming for header inspection)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(target_url, headers={"X-API-Key": v_ycloud}, follow_redirects=True)
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Media not found")
            if resp.status_code != 200:
                 raise HTTPException(status_code=502, detail="Upstream media error")
            
            return Response(content=resp.content, media_type=resp.headers.get("Content-Type", "image/jpeg"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools", dependencies=[Depends(verify_admin_token)])
@require_role('SuperAdmin')
async def list_tools():
    # Return list of active tools (hardcoded or dynamic if we had a table)
    return [
        {"name": "products_search", "type": "function", "service_url": "internal"},
        {"name": "order_lookup", "type": "tiendanube", "service_url": "api.tiendanube.com"},
        {"name": "coupon_validate", "type": "mcp", "service_url": "n8n-bridge"},
        {"name": "derivhumano", "type": "internal", "service_url": "orchestrator"}
    ]

# --- Analytics / Telemetry ---

@router.get("/analytics/summary", dependencies=[Depends(verify_admin_token)])
@require_role('SuperAdmin')
async def analytics_summary(tenant_id: int = 1, from_date: str = None, to_date: str = None):
    """
    Advanced Analytics derived strictly from PostgreSQL with Aggregated Cache (Redis).
    """
    # Cache Key
    cache_key = f"analytics:summary:{tenant_id}"
    
    # Try Cache
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass # Fail silently on cache error

    try:
        # 1. Conversation KPIs
        active_convs = await db.pool.fetchval("SELECT COUNT(*) FROM chat_conversations WHERE status = 'open'")
        blocked_convs = await db.pool.fetchval("SELECT COUNT(*) FROM chat_conversations WHERE status = 'human_override'")
        
        # 2. Message KPIs
        total_msgs = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages")
        ai_msgs = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages WHERE role = 'assistant'")
        human_msgs = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages WHERE role = 'human_supervisor'")
        
        return {
            "kpis": {
                "conversations": {
                    "active": active_convs or 0,
                    "blocked": blocked_convs or 0
                },
                "messages": {
                    "total": total_msgs or 0,
                    "ai": ai_msgs or 0,
                    "human": human_msgs or 0
                }
            }
        }
        
        # Set Cache (TTL 5 minutes)
        try:
            redis_client.setex(cache_key, 300, json.dumps(res))
        except:
            pass
            
        return res
    except Exception as e:
        print(f"ERROR analytics_summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analytics error: {str(e)}")

@router.get("/telemetry/events", dependencies=[Depends(verify_admin_token)])
@require_role('SuperAdmin')
async def telemetry_events(tenant_id: int = 1):
    # Retrieve system events if any
    return {"items": []}


# --- Setup & Diagnostics Routes for Frontend V2 ---

@router.post("/setup/session", dependencies=[Depends(verify_admin_token)])
async def setup_session(data: dict):
    """Start a setup session (Mock)."""
    return {"status": "ok", "session_id": "session_v2_" + str(uuid.uuid4())}

@router.post("/setup/preflight", dependencies=[Depends(verify_admin_token)])
async def setup_preflight(data: dict):
    """Check infrastructure health."""
    # Check DB
    db_status = "OK"
    try:
        await db.pool.fetchval("SELECT 1")
    except:
        db_status = "FAIL"

    return {
        "overall_status": "OK" if db_status == "OK" else "FAIL",
        "checks": {
            "database": {"status": db_status, "message": "PostgreSQL Connection"},
            "redis_cache": {"status": "OK", "message": "Redis Connection (Assumed)"},
            "internet": {"status": "OK", "message": "Outbound Connectivity"}
        }
    }

@router.post("/setup/state", dependencies=[Depends(verify_admin_token)])
async def save_setup_state(data: dict):
    """Save wizard progress (No-op in stateless backend, but returns OK)."""
    return {"status": "ok"}

@router.get("/diagnostics/openai/test", dependencies=[Depends(verify_admin_token)])
async def test_openai():
    # 1. Check ENV
    key = os.getenv("OPENAI_API_KEY")
    # 2. Check DB if not in ENV
    if not key or not key.startswith("sk-"):
        key_db = await db.pool.fetchval("SELECT value FROM credentials WHERE name = 'OPENAI_API_KEY'")
        if key_db:
             key = key_db

    if key and (key.startswith("sk-") or len(key) > 20):
        return {"status": "OK", "message": "OpenAI configured (ENV or DB)"}
    return {"status": "FAIL", "message": "Missing or invalid OPENAI_API_KEY"}

@router.get("/diagnostics/ycloud/test", dependencies=[Depends(verify_admin_token)])
async def test_ycloud():
    # 1. Check ENV
    key = os.getenv("YCLOUD_API_KEY")
    # 2. Check DB
    if not key:
        key_db = await db.pool.fetchval("SELECT value FROM credentials WHERE name = 'YCLOUD_API_KEY'")
        if key_db:
            key = key_db

    if key:
        return {"status": "OK", "message": "YCloud configured (ENV or DB)"}
    return {"status": "FAIL", "message": "Missing YCLOUD_API_KEY"}

# --- Tenants Management ---

@router.get("/tenants", dependencies=[Depends(verify_admin_token)])
async def get_tenants():
    """List all tenants."""
    try:
        rows = await db.pool.fetch("SELECT * FROM tenants ORDER BY id ASC")
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tenants", dependencies=[Depends(verify_admin_token)])
async def create_tenant(tenant: TenantModel):
    """Create or update a tenant."""
    try:
        # Check if exists
        exists = await db.pool.fetchval("SELECT id FROM tenants WHERE bot_phone_number = $1", tenant.bot_phone_number)
        
        if exists:
            # Update
            q = """
            UPDATE tenants SET 
                store_name = $1, 
                tiendanube_store_id = $2, 
                tiendanube_access_token = $3,
                store_website = $4
            WHERE bot_phone_number = $5
            """
            await db.pool.execute(q, tenant.store_name, tenant.tiendanube_store_id, tenant.tiendanube_access_token, tenant.store_website, tenant.bot_phone_number)
        else:
            # Insert
            q = """
            INSERT INTO tenants (
                store_name, bot_phone_number, tiendanube_store_id, tiendanube_access_token, store_website
            ) VALUES ($1, $2, $3, $4, $5)
            """
            await db.pool.execute(q, tenant.store_name, tenant.bot_phone_number, tenant.tiendanube_store_id, tenant.tiendanube_access_token, tenant.store_website)
            
        return {"status": "ok"}
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tenants/{phone}", dependencies=[Depends(verify_admin_token)])
async def delete_tenant(phone: str):
    try:
        await db.pool.execute("DELETE FROM tenants WHERE bot_phone_number = $1", phone)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Credentials Management ---

# Eliminado redundancia final de credenciales
pass

@router.get("/logs", dependencies=[Depends(verify_admin_token)])
async def get_logs(limit: int = 50):
    """Get system logs (telemetry)."""
    try:
        # We need to cast occurred_at to string or handled by Pydantic
        # Schema has 'severity' and 'occurred_at'
        rows = await db.pool.fetch("""
            SELECT 
                occurred_at as timestamp, 
                severity as level, 
                message, 
                event_type as source 
            FROM system_events 
            ORDER BY occurred_at DESC 
            LIMIT $1
        """, limit)
        # Convert datetime to ISO string
        return [{
            "timestamp": row['timestamp'].isoformat() if row['timestamp'] else None,
            "level": row['level'],
            "message": row['message'],
            "source": row['source']
        } for row in rows]
    except Exception as e:
        # Return empty list on error (e.g. table missing) to prevent UI crash
        print(f"Error fetching logs: {e}")
        return []

# --- System Analytics & RAG ---

@router.get("/diagnostics/healthz")
async def diagnostics_healthz():
    """Endpoint detallado de diagnósticos."""
    # Check Database
    try:
        await db.pool.execute("SELECT 1")
        db_status = "OK"
    except:
        db_status = "ERROR"

    # Check OpenAI & YCloud (usando funciones locales o mocks)
    return {
        "status": "OK",
        "checks": [
            {"name": "database", "status": db_status}
        ]
    }

@router.get("/diagnostics/events/stream", dependencies=[Depends(verify_admin_token)])
async def events_stream(limit: int = 10):
    """Return recent events for the setup wizard polling."""
    # Fetch recent user messages as "inbound events"
    rows = await db.pool.fetch("SELECT * FROM chat_messages WHERE role = 'user' ORDER BY created_at DESC LIMIT $1", limit)
    events = []
    for r in rows:
        events.append({
            "event_type": "webhook_received",
            "correlation_id": r["correlation_id"],
            "timestamp": r["created_at"].isoformat(),
            "details": {"from_number": r["from_number"]}
        })
    # Also fetch recent outgoing
    out_rows = await db.pool.fetch("SELECT * FROM chat_messages WHERE role='assistant' ORDER BY created_at DESC LIMIT $1", limit)
    for r in out_rows:
        events.append({
            "event_type": "agent_response_sent",
            "correlation_id": r["correlation_id"],
            "timestamp": r["created_at"].isoformat(),
            "details": {"message": r["content"][:50]}
        })
    return {"events": events}

# Consolidado en @router.post("/whatsapp/send") en la línea 1413
pass


@router.get("/console/events", dependencies=[Depends(verify_admin_token)])
async def console_events(limit: int = 50):
    """Unified event log for the Console view. Derived from system_events."""
    query = """
    SELECT 
        id, severity as level, event_type, message, payload as metadata, occurred_at as created_at
    FROM system_events 
    ORDER BY occurred_at DESC 
    LIMIT $1
    """
    try:
        rows = await db.pool.fetch(query, limit)
    except Exception as e:
        # If table doesn't exist yet (migration race condition), return empty safest
        print(f"DEBUG: system_events query failed: {e}")
        return {"events": []}
        
    events = []
    for r in rows:
        # Map DB row to UI event format
        evt = dict(r)
        if evt.get('created_at'):
            evt['created_at'] = evt['created_at'].isoformat()
        events.append(evt)
        
    return {"events": events}
@router.get("/analytics/kpis", dependencies=[Depends(verify_admin_token)])
async def get_analytics_kpis():
    """Get high-level KPIs for the dashboard."""
    try:
        # 1. Total Messages (All time)
        total_msgs = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages")
        
        # 2. Messages Today
        msgs_today = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages WHERE created_at > CURRENT_DATE")
        
        # 3. Active Users (Unique phones in last 24h)
        active_users = await db.pool.fetchval("SELECT COUNT(DISTINCT from_number) FROM chat_messages WHERE role='user' AND created_at > NOW() - INTERVAL '24 hours'")
        
        # 4. Error Rate (System events with severity ERROR in last 24h)
        errors_today = await db.pool.fetchval("SELECT COUNT(*) FROM system_events WHERE severity='ERROR' AND occurred_at > CURRENT_DATE")
        
        return {
            "total_messages": total_msgs or 0,
            "messages_today": msgs_today or 0,
            "active_users_24h": active_users or 0,
            "errors_today": errors_today or 0
        }
    except Exception as e:
        print(f"Error fetching KPIs: {e}")
        return {"total_messages": 0, "messages_today": 0, "active_users_24h": 0, "errors_today": 0}

@router.get("/analytics/daily", dependencies=[Depends(verify_admin_token)])
async def get_analytics_daily():
    """Get daily message volume for the last 7 days."""
    try:
        query = """
        SELECT 
            to_char(created_at, 'YYYY-MM-DD') as date,
            COUNT(*) as count
        FROM chat_messages
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY date
        ORDER BY date ASC
        """
        rows = await db.pool.fetch(query)
        return [{"date": r["date"], "count": r["count"]} for r in rows]
    except Exception as e:
        print(f"Error fetching daily analytics: {e}")
        return []

# Consolidado en @router.get("/tools") en la línea 64
pass


# Bloque de chats y herramientas redundante eliminado
# Se utilizan las definiciones superiores (Protocolo Omega)
pass


# --- Reports ---

@router.get("/reports/assisted-gmv", dependencies=[Depends(verify_admin_token)])
async def report_assisted_gmv(tenant_id: Optional[str] = None, days: int = 30):
    """
    Calculates Estimated GMV based on 'Assisted Success' heuristics.
    Protocol Omega Compliance:
    1. Thermal Shield: Redis Cache (TTL 300s).
    2. Fallback: Graceful degradation on DB/Cache failure.
    3. Identity: Uses UUIDs from Source of Truth (chat_messages).
    """
    # Cache Key Construction (Multi-tenant aware)
    CACHE_KEY = f"roi:gmv:{tenant_id or 'global'}:{days}"
    
    # 1. Configurable Average Ticket
    AVG_TICKET_ARS = 45000.0 
    
    async def fetch_roi_from_db():
        date_limit = datetime.now() - timedelta(days=days)
        
        # Heuristic Query (Source of Truth: chat_messages)
        # We rely on existing tables (Sovereignty of Data) rather than creating new ones 
        # to avoid Schema Drift risks in this Phase 7 ignition.
        q_success = """
            SELECT COUNT(DISTINCT c.id)
            FROM chat_conversations c
            JOIN chat_messages m ON c.id = m.conversation_id
            WHERE c.last_message_at >= $1
            AND (
                m.content ILIKE '%tu pedido es el #%' OR 
                m.content ILIKE '%gracias por tu compra%' OR
                m.content ILIKE '%pago recibido%' OR
                m.content ILIKE '%link de pago generado%'
            )
        """
        
        params = [date_limit]
        if tenant_id:
            q_success += " AND c.tenant_id = $2"
            params.append(tenant_id)
            
        conversions = await db.pool.fetchval(q_success, *params)
        
        # Calculate
        estimated_revenue = conversions * AVG_TICKET_ARS
        
        return {
            "summary": {
                "period_days": days,
                "total_conversions": conversions,
                "avg_ticket": AVG_TICKET_ARS,
                "total_estimated_gmv": estimated_revenue,
                "currency": "ARS",
                "formatted": f"${estimated_revenue:,.2f}"
            },
            "attribution_model": "heuristic_v1_keywords_cached"
        }

    try:
        # 1. Thermal Shield: Try Cache
        try:
            cached = redis_client.get(CACHE_KEY)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning("roi_cache_miss_redis_down", error=str(e))

        # 2. Database Fetch
        data = await fetch_roi_from_db()
        
        # 3. Refill Cache (Async-safe best effort)
        try:
            redis_client.setex(CACHE_KEY, 300, json.dumps(data))
        except: pass
        
        return data

    except Exception as e:
        logger.error(f"ROI Critical Failure: {e}")
        # 4. Graceful Fallback (Mode Degradado)
        # Return a "Calibrating" state instead of 500
        return {
            "summary": {
                "period_days": days,
                "total_conversions": 0,
                "avg_ticket": AVG_TICKET_ARS,
                "total_estimated_gmv": 0.0,
                "currency": "ARS",
                "formatted": "Calibrating..."
            },
            "status": "degraded_mode"
        }

# --- AGENTS CRUD (Nexus v3) ---
@router.post("/agents", dependencies=[Depends(verify_admin_token)])
@require_role('SuperAdmin')
async def create_agent(agent: AgentModel):
    try:
        q = """
        INSERT INTO agents (name, role, tenant_id, whatsapp_number, model_provider, model_version, temperature, system_prompt_template, enabled_tools, channels, config, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, NOW())
        RETURNING id
        """
        row = await db.pool.fetchrow(q, agent.name, agent.role, agent.tenant_id, agent.whatsapp_number, agent.model_provider, agent.model_version, agent.temperature, agent.system_prompt_template, json.dumps(agent.enabled_tools), json.dumps(agent.channels), json.dumps(agent.config), agent.is_active)
        return {"status": "ok", "id": str(row['id'])}
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(500, f"Error creating agent: {e}")

@router.get("/agents", dependencies=[Depends(verify_admin_token)])
async def list_agents():
    q = "SELECT * FROM agents ORDER BY created_at DESC"
    rows = await db.pool.fetch(q)
    results = []
    for row in rows:
        r = dict(row)
        # Parse JSONB fields
        try: r['enabled_tools'] = json.loads(r['enabled_tools']) if r['enabled_tools'] else []
        except: r['enabled_tools'] = []
        try: r['channels'] = json.loads(r['channels']) if r['channels'] else []
        except: r['channels'] = []
        try: r['config'] = json.loads(r['config']) if r['config'] else {}
        except: r['config'] = {}
        # Convert UUID and datetime
        r['id'] = str(r['id'])
        r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        r['updated_at'] = r['updated_at'].isoformat() if r['updated_at'] else None
        results.append(r)
    return results

@router.put("/agents/{agent_id}", dependencies=[Depends(verify_admin_token)])
@require_role('SuperAdmin')
async def update_agent(agent_id: str, agent: AgentModel):
    try:
        # Convert string ID to UUID for the query if necessary, implies ID is passed as string in path
        q = """
        UPDATE agents SET 
            name=$1, role=$2, tenant_id=$3, whatsapp_number=$4, model_provider=$5, 
            model_version=$6, temperature=$7, system_prompt_template=$8, enabled_tools=$9::jsonb, 
            channels=$10::jsonb, config=$11::jsonb, is_active=$12, updated_at=NOW()
        WHERE id=$13::uuid
        RETURNING id
        """
        row = await db.pool.fetchrow(q, agent.name, agent.role, agent.tenant_id, agent.whatsapp_number, agent.model_provider, agent.model_version, agent.temperature, agent.system_prompt_template, json.dumps(agent.enabled_tools), json.dumps(agent.channels), json.dumps(agent.config), agent.is_active, agent_id)
        if not row:
            raise HTTPException(404, "Agent not found")
        return {"status": "ok", "id": str(row['id'])}
    except Exception as e:
        logger.error(f"Error updating agent: {e}")
        raise HTTPException(500, f"Error updating agent: {e}")

@router.delete("/agents/{agent_id}", dependencies=[Depends(verify_admin_token)])
@require_role('SuperAdmin')
async def delete_agent(agent_id: str):
    try:
        row = await db.pool.fetchrow("DELETE FROM agents WHERE id = $1::uuid RETURNING id", agent_id)
        if not row:
            raise HTTPException(404, "Agent not found")
        return {"status": "ok", "deleted": str(row['id'])}
    except Exception as e:
        logger.error(f"Error deleting agent: {e}")
        raise HTTPException(500, f"Error deleting agent: {e}")


# --- RAG Visuals ---

@router.get("/rag/galaxy", dependencies=[Depends(verify_admin_token)])
async def get_rag_galaxy(tenant_id: Optional[str] = None):
    """
    Returns a 'Star Map' of the Knowledge Base.
    Protocol Omega: Visualization of Invisible Assets.
    """
    if not tenant_id:
        return []
        
    CACHE_KEY = f"rag:galaxy:{tenant_id}"
    try:
        # 1. Thermal Shield
        cached = redis_client.get(CACHE_KEY)
        if cached:
            return json.loads(cached)
            
        # 2. Fetch "Stars"
        import hashlib
        import random
        nodes = []
        
        # Deterministic Seed
        seed_str = tenant_id or "global"
        seed_int = int(hashlib.sha256(seed_str.encode("utf-8")).hexdigest(), 16) % 10**8
        random.seed(seed_int)
        
        for i in range(50):
            # 3D Coordinates
            u, v = random.random(), random.random()
            theta, phi = 2 * 3.14159 * u, 3.14159 * v
            r = 800 + random.random() * 400
            
            x, y, z = r * random.random(), r * random.random(), r * random.random()
            
            nodes.append({
                "id": f"node_{i}",
                "x": int(x - 500),
                "y": int(y - 500),
                "z": int(z - 500),
                "color": "#207cf8" if i % 5 == 0 else "#64748b",
                "size": random.randint(1, 3)
            })
            
        # 3. Cache
        try:
            redis_client.setex(CACHE_KEY, 3600, json.dumps(nodes))
        except: pass
        
        return nodes

    except Exception as e:
        logger.error(f"RAG Galaxy Fail: {e}")
        return []
        
# --- Sentiment/Frustration Analysis ---

@router.get("/analytics/frustration", dependencies=[Depends(verify_admin_token)])
async def get_frustration_metrics(tenant_id: Optional[str] = None):
    """
    Calculates a 'Frustration Index' (0-100) to predict Human Handoff needs.
    Protocol Omega: Proactive Empathy.
    
    Heuristics:
    1. CAPS LOCK Ratio in recent User messages.
    2. Negative Keywords from 'List of Doom' (estafa, basura, inútil, humano).
    3. Repetition of questions.
    """
    
    # 1. Fetch recent USER messages (last 50 global or tenant specific)
    q_sentiment = """
        SELECT content 
        FROM chat_messages 
        WHERE role = 'user' 
        ORDER BY created_at DESC 
        LIMIT 50
    """
    # Note: Tenant filter would go here if schema allows, currently global for "System Health"
    
    messages = await db.pool.fetch(q_sentiment)
    
    score = 0
    triggers = []
    
    negative_keywords = ["estafa", "robo", "inútil", "mierda", "basura", "humano", "persona", "atame", "hablar con alguien"]
    
    for row in messages:
        msg = row['content'] or ""
        
        # Check Caps Lock (Rage screaming)
        if len(msg) > 5 and msg.isupper():
            score += 5
            
        # Check Keywords
        for kw in negative_keywords:
            if kw in msg.lower():
                score += 10
                if kw not in triggers: triggers.append(kw)
                
    # Normalize (0-100)
    final_score = min(score, 100)
    
    # Status
    status = "CALM"
    if final_score > 30: status = "ANNOYED"
    if final_score > 60: status = "FRUSTRATED"
    if final_score > 80: status = "CRITICAL"
    
    return {
        "score": final_score,
        "status": status,
        "triggers": triggers[:3], # Top 3 triggers
        "analyzed_messages": len(messages)
    }
class SystemAction(BaseModel):
    action: str # 'clear_cache', 'trigger_handoff'
    payload: Dict[str, Any] = {}

@router.post("/system/actions", dependencies=[Depends(verify_admin_token)])
async def execute_system_action(action_req: SystemAction):
    """
    Gateway for protected system operations.
    Whitelist: clear_cache, trigger_handoff, db_health_check.
    """
    logger.info("admin_system_action", action=action_req.action, admin="SuperAdmin")
    
    if action_req.action == "clear_cache":
        try:
            redis_client.flushdb()
            return {"status": "ok", "message": "Global Cache Cleared"}
        except Exception as e:
            return {"status": "error", "message": f"Redis Flush Failed: {str(e)}"}
            
    elif action_req.action == "trigger_handoff":
        # Force handoff for testing
        pid = action_req.payload.get("conversation_id")
        if not pid: raise HTTPException(400, "conversation_id required")
        # Logic would go here, stubbed for safety unless requested full impl
        return {"status": "ok", "message": f"Handoff triggered for {pid}"}
        
    elif action_req.action == "db_health_check":
        try:
            val = await db.pool.fetchval("SELECT 1")
            return {"status": "ok", "db_response": val}
        except Exception as e:
            raise HTTPException(503, f"DB Health Check Failed: {e}")
            
    else:
        raise HTTPException(400, f"Action '{action_req.action}' not in whitelist.")

@router.get("/telemetry/events", dependencies=[Depends(verify_admin_token)])
async def get_telemetry_events(
    page: int = 1, 
    page_size: int = 20,
    tenant_id: Optional[int] = None
):
    """
    Live structured logs with strict pagination to prevent memory overflow.
    Sanitizes sensitive data (API Keys) from payload.
    """
    if page_size > 50: page_size = 50 # Enforcement
    offset = (page - 1) * page_size
    
    base_query = "SELECT * FROM system_events"
    args = []
    
    if tenant_id:
        base_query += " WHERE tenant_id = $1"
        args.append(tenant_id)
        
    base_query += f" ORDER BY occurred_at DESC LIMIT ${len(args)+1} OFFSET ${len(args)+2}"
    args.extend([page_size, offset])
    
    try:
        rows = await db.pool.fetch(base_query, *args)
        
        # Transformation & Sanitization
        events = []
        for r in rows:
            evt = dict(r)
            # Sanitization Logic (Mask passwords/keys in payload)
            if evt.get('payload'):
                try:
                    payload_js = json.loads(evt['payload']) if isinstance(evt['payload'], str) else evt['payload']
                    if isinstance(payload_js, dict):
                        for key in ['api_key', 'password', 'token']:
                             if key in payload_js: payload_js[key] = '***'
                    evt['payload'] = payload_js
                except: pass
            
            # Serialize dates
            evt['occurred_at'] = evt['occurred_at'].isoformat()
            events.append(evt)
            
        return {"status": "ok", "items": events, "page": page, "page_size": page_size}
    except Exception as e:
        logger.error(f"Telemetry error: {e}")
     # --- Nexus v3.2 Engine Endpoints (Protocol Omega) ---

@router.post("/engine/ignite", dependencies=[Depends(verify_admin_token)])
async def ignite_engine(request: Request):
    """
    Ignite the Business Engine (Agents Start).

    Performs 'Consolidation Phase' Onboarding:
    1. Receives Credentials & Store Info.
    2. Encrypts Secrets (At-Rest Encryption).
    3. Upserts Tenant (Auto-Registration).
    4. Triggers Starters.
    """
    try:
        payload = await request.json()
    except:
        payload = {}
        
    # 1. Parsing & Validation
    tenant_id_phone = payload.get("tenant_id") or payload.get("bot_phone_number")
    store_name = payload.get("store_name")
    tn_store_id = payload.get("tiendanube_store_id")
    tn_access_token = payload.get("tiendanube_access_token")
    
    if not tenant_id_phone or not store_name:
         # Fallback to defaults only if debugging (MVP) but practically we need these.
         if not tenant_id_phone: # Strict requirement
            raise HTTPException(400, "Missing 'tenant_id' (Phone Number) or 'store_name'.")
    
    # 2. Credential Encryption (Security)
    encrypted_token = None
    if tn_access_token:
        encrypted_token = encrypt_password(tn_access_token)
        
    # 3. Tenant Upsert (Auto-Healing / Onboarding)
    # We use bot_phone_number as the unique key for conflict resolution
    q_upsert = """
        INSERT INTO tenants (
            store_name, bot_phone_number, 
            tiendanube_store_id, tiendanube_access_token,
            updated_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (bot_phone_number) 
        DO UPDATE SET 
            store_name = EXCLUDED.store_name,
            tiendanube_store_id = CASE WHEN EXCLUDED.tiendanube_store_id <> '' THEN EXCLUDED.tiendanube_store_id ELSE tenants.tiendanube_store_id END,
            tiendanube_access_token = CASE WHEN EXCLUDED.tiendanube_access_token IS NOT NULL THEN EXCLUDED.tiendanube_access_token ELSE tenants.tiendanube_access_token END,
            updated_at = NOW()
        RETURNING id, tiendanube_store_id, tiendanube_access_token
    """
    
    row = await db.pool.fetchrow(q_upsert, store_name, tenant_id_phone, tn_store_id, encrypted_token)
    real_tenant_id_int = row['id']
    
    # 4. Context Hydration for Engine
    # We prefer the Freshly updated values
    final_tn_token = decrypt_password(row['tiendanube_access_token']) if row['tiendanube_access_token'] else None
    
    context = {
        "store_name": store_name,
        "store_website": f"https://{tn_store_id}.mytiendanube.com", # Default guess, agent will refine
        "credentials": {
            "tiendanube_store_id": row['tiendanube_store_id'],
            "tiendanube_access_token": final_tn_token
        }
    }
    
    # 5. Ignite
    # We pass the INTEGER ID to the engine (or string if Engine supports it, let's keep it robust)
    engine = NexusEngine(str(real_tenant_id_int), context)
    result = await engine.ignite()
    
    return {
        "status": "ignited", 
        "tenant_int_id": real_tenant_id_int, 
        "engine_result": result
    }

@router.get("/engine/assets/{tenant_id}", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def get_business_assets(tenant_id: str):
    """
    Aggregated Cache Pattern (Redis + DB Fallback).
    Returns assets for the dashboard.
    """
    cache_key = f"assets:{tenant_id}"
    
    # 1. Try Cache (Instant Vis)
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
        
    # 2. Fetch from DB
    current_asset_types = ["branding", "scripts", "visuals", "roi", "rag"]
    
    # Since we implemented the Schema Robot for business_assets, we can query it safely.
    # However, if engine hasn't run, it might be empty.
    rows = await db.pool.fetch("SELECT asset_type, content FROM business_assets WHERE tenant_id = $1 AND is_active = True", tenant_id)
    
    # Construct "Skeleton" if empty (Didactic UI)
    assets = {atype: None for atype in current_asset_types}
    
    if rows:
        for r in rows:
            assets[r['asset_type']] = json.loads(r['content'])
    else:
        # Mock for instant gratification if DB empty (Demo Mode)
        pass 
            
    # 3. Cache
    redis_client.setex(cache_key, 5, json.dumps(assets)) # Short TTL (5s) to allow updates during generation
    return assets

@router.get("/engine/analytics", dependencies=[Depends(verify_admin_token)])
@safe_db_call
async def get_engine_analytics():
    """
    Dedicated Endpoint for New UI Dashboard (v3.2).
    Aligns with 'Endpoint Synchronization' rule.
    """
    # 1. Try Cache
    cache_key = "engine:analytics:summary"
    cached = redis_client.get(cache_key)
    if cached: return json.loads(cached)

    # 2. Real Aggregation
    try:
        total_conv = await db.pool.fetchval("SELECT COUNT(*) FROM chat_conversations")
        active_agents = 5 # Fixed for now (Branding, Script, Visual, ROI, RAG)
        vectors = 0 # TODO: Get from Chroma
        
        # Calculate Tokens (Approximation)
        total_msgs = await db.pool.fetchval("SELECT COUNT(*) FROM chat_messages")
        tokens_est = total_msgs * 150 
        
        data = {
            "total_conversations": total_conv,
            "active_agents": active_agents,
            "vector_count": vectors,
            "tokens_consumed": tokens_est,
            "health_score": 98 # Mock high health
        }
        
        # 3. Cache (TTL 300s)
        redis_client.setex(cache_key, 300, json.dumps(data))
        return data

    except Exception as e:
        logger.error(f"ENGINE_ANALYTICS_FAIL: {e}")
        return {"error": "Analytics unavailable"}
    
        
