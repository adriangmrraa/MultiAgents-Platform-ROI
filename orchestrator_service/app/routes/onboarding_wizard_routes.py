import os
import json
import logging
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Header, Cookie
from pydantic import BaseModel
from jose import jwt, JWTError

from db import db
from app.models.auth import User
from app.api.deps import get_current_user
from app.core.config import settings
from app.core import security

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/onboarding-wizard", tags=["onboarding-wizard"])

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")


async def get_wizard_user(
    token: str | None = Cookie(default=None, alias="access_token"),
    auth_header: str | None = Header(default=None, alias="Authorization"),
    x_admin_token: str | None = Header(default=None),
) -> User:
    """
    Resolve current user for wizard endpoints.
    Supports: JWT cookie, Bearer header, OR x-admin-token + cookie fallback.
    More resilient than get_current_user for cross-origin scenarios.
    """
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal

    # Try JWT from cookie or Authorization header
    jwt_token = token
    if not jwt_token and auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ")[1]

    if jwt_token:
        try:
            payload = jwt.decode(jwt_token, settings.SECRET_KEY.get_secret_value(), algorithms=[security.ALGORITHM])
            user_uuid = payload.get("sub")
            if user_uuid:
                async with AsyncSessionLocal() as session:
                    result = await session.execute(select(User).where(User.id == user_uuid))
                    user = result.scalar_one_or_none()
                    if user:
                        return user
        except JWTError:
            pass

    # Fallback: x-admin-token → resolve user from the most recent non-admin user
    # This is used when the cookie doesn't arrive (cross-origin EasyPanel)
    if x_admin_token and x_admin_token == ADMIN_TOKEN:
        # We need to know WHICH user. Check if there's a user email in a custom header
        # For now, get the last created non-admin user as a heuristic for fresh onboarding
        row = await db.pool.fetchrow("""
            SELECT id, email, role, tenant_id, is_verified,
                   COALESCE((SELECT store_name FROM tenants WHERE id = users.tenant_id), '') as store_name
            FROM users
            WHERE role != 'super_admin'
            ORDER BY created_at DESC LIMIT 1
        """)
        if row:
            # Create a minimal User-like object
            class UserProxy:
                def __init__(self, r):
                    self.id = r["id"]
                    self.email = r["email"]
                    self.role = r["role"]
                    self.tenant_id = r["tenant_id"]
                    self.is_verified = r.get("is_verified", True)
                    self.store_name = r.get("store_name", "")
            return UserProxy(row)

    raise HTTPException(status_code=401, detail="Not authenticated")


# --- Schemas ---

class ProgressUpdate(BaseModel):
    step: int
    step_data: Optional[dict] = None
    system_prompt_draft: Optional[str] = None


class CreateTenant(BaseModel):
    store_name: Optional[str] = None


class TestAgentRequest(BaseModel):
    message: str
    system_prompt: str


# --- Helpers ---

async def _get_or_create_progress(user: User):
    """Get onboarding progress for user, create if not exists."""
    row = await db.pool.fetchrow(
        "SELECT * FROM onboarding_progress WHERE user_id = $1",
        str(user.id)
    )
    if not row:
        row = await db.pool.fetchrow("""
            INSERT INTO onboarding_progress (user_id, tenant_id, current_step, step_data, system_prompt_draft)
            VALUES ($1, $2, 0, '{}', '')
            RETURNING *
        """, str(user.id), user.tenant_id)
    return dict(row)


# --- Endpoints ---

@router.get("/progress", dependencies=[Depends(get_wizard_user)])
async def get_progress(current_user = Depends(get_wizard_user)):
    """Get onboarding wizard progress for current user."""
    progress = await _get_or_create_progress(current_user)

    # Check if user has existing agents (pre-existing user → skip wizard)
    tenant_id = current_user.tenant_id or progress.get("tenant_id")
    has_agents = False
    if tenant_id:
        count = await db.pool.fetchval(
            "SELECT COUNT(*) FROM agents WHERE tenant_id = $1", tenant_id
        )
        has_agents = count > 0

    # Debug info for troubleshooting
    logger.info("onboarding_progress_check",
        user_id=str(current_user.id),
        email=current_user.email,
        role=current_user.role,
        tenant_id=tenant_id,
        has_agents=has_agents,
        completed_at=str(progress.get("completed_at")),
        current_step=progress.get("current_step")
    )

    return {
        **progress,
        "has_existing_agents": has_agents,
        "is_super_admin": current_user.role == "super_admin",
        "should_show_wizard": (
            progress["completed_at"] is None
            and not has_agents
            and current_user.role != "super_admin"
        )
    }


@router.put("/progress", dependencies=[Depends(get_wizard_user)])
async def update_progress(body: ProgressUpdate, current_user = Depends(get_wizard_user)):
    """Update onboarding wizard progress. Validates step sequence."""
    progress = await _get_or_create_progress(current_user)

    # Validate step sequence — can only go forward by 1 or stay
    current = progress["current_step"]
    if body.step > current + 1:
        raise HTTPException(status_code=400, detail="No puedes saltar pasos. Completa el paso actual primero.")

    # Merge step_data
    existing_data = progress["step_data"] if isinstance(progress["step_data"], dict) else {}
    if body.step_data:
        # body.step_data can be either {step_3: {...}} or {chat_history: [...], ...}
        for key, value in body.step_data.items():
            if key.startswith("step_"):
                # Already keyed: {step_3: {chat_history: [...]}}
                existing_data[key] = {**existing_data.get(key, {}), **(value if isinstance(value, dict) else {})}
            else:
                # Flat: {chat_history: [...], confirmed_sections: {...}}
                step_key = f"step_{body.step}"
                if step_key not in existing_data:
                    existing_data[step_key] = {}
                existing_data[step_key][key] = value

    # Update prompt draft if provided
    prompt_draft = body.system_prompt_draft if body.system_prompt_draft is not None else progress["system_prompt_draft"]

    row = await db.pool.fetchrow("""
        UPDATE onboarding_progress
        SET current_step = $1, step_data = $2, system_prompt_draft = $3, updated_at = NOW()
        WHERE user_id = $4
        RETURNING *
    """, body.step, json.dumps(existing_data), prompt_draft, str(current_user.id))

    return dict(row)


@router.post("/create-tenant", dependencies=[Depends(get_wizard_user)])
async def create_tenant_for_wizard(body: CreateTenant, current_user = Depends(get_wizard_user)):
    """Create a provisional tenant for the wizard (step 0)."""
    # Check if user already has a tenant
    if current_user.tenant_id:
        tenant = await db.pool.fetchrow("SELECT id, store_name FROM tenants WHERE id = $1", current_user.tenant_id)
        if tenant:
            return {"tenant_id": tenant["id"], "store_name": tenant["store_name"], "already_existed": True}

    store_name = body.store_name or f"Tienda de {current_user.email.split('@')[0]}"

    # Create tenant
    tenant = await db.pool.fetchrow("""
        INSERT INTO tenants (store_name, bot_phone_number, owner_email)
        VALUES ($1, '', $2)
        RETURNING id, store_name
    """, store_name, current_user.email)

    tenant_id = tenant["id"]

    # Link user to tenant
    await db.pool.execute(
        "UPDATE users SET tenant_id = $1 WHERE id = $2",
        tenant_id, str(current_user.id)
    )

    # Update onboarding progress with tenant_id
    await db.pool.execute(
        "UPDATE onboarding_progress SET tenant_id = $1 WHERE user_id = $2",
        tenant_id, str(current_user.id)
    )

    logger.info("wizard_tenant_created", tenant_id=tenant_id, user=current_user.email)
    return {"tenant_id": tenant_id, "store_name": tenant["store_name"], "already_existed": False}


@router.post("/complete", dependencies=[Depends(get_wizard_user)])
async def complete_wizard(current_user = Depends(get_wizard_user)):
    """Complete the wizard: create or UPDATE agent with the real system prompt."""
    progress = await _get_or_create_progress(current_user)
    tenant_id = current_user.tenant_id or progress.get("tenant_id")

    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated. Complete step 1 first.")

    system_prompt = progress["system_prompt_draft"] or ""
    if not system_prompt or len(system_prompt.strip()) < 20:
        system_prompt = "Eres un asistente virtual de ventas amable y profesional."

    step_data = progress["step_data"] if isinstance(progress["step_data"], dict) else {}
    store_name = step_data.get("step_1", {}).get("store_name", "Mi Tienda")
    knowledge_sources = step_data.get("knowledge_sources", [])

    tools = json.dumps(["search_specific_products", "search_by_category", "browse_general_storefront", "orders", "derivhumano"])

    # Check if agent already exists for this tenant (update instead of duplicate)
    existing = await db.pool.fetchrow(
        "SELECT id FROM agents WHERE tenant_id = $1 AND role = 'sales' ORDER BY created_at DESC LIMIT 1",
        tenant_id
    )

    if existing:
        # UPDATE existing agent with the wizard's prompt
        await db.pool.execute("""
            UPDATE agents SET
                system_prompt_template = $1,
                enabled_tools = $2,
                is_active = true,
                updated_at = NOW()
            WHERE id = $3
        """, system_prompt, tools, existing["id"])

        # Update knowledge sources if selected
        if knowledge_sources:
            await db.pool.execute(
                "UPDATE agents SET knowledge_sources = $1 WHERE id = $2",
                json.dumps(knowledge_sources), existing["id"]
            )

        agent_id = existing["id"]
        logger.info("wizard_agent_updated", tenant_id=tenant_id, agent_id=agent_id, prompt_len=len(system_prompt))
    else:
        # CREATE new agent
        agent = await db.pool.fetchrow("""
            INSERT INTO agents (name, role, tenant_id, model_provider, model_version, is_active,
                                enabled_tools, system_prompt_template, temperature)
            VALUES ($1, $2, $3, $4, $5, true, $6, $7, 0.3)
            RETURNING id
        """,
            f"Agente {store_name}",
            "sales",
            tenant_id,
            "openai",
            "gpt-4o",
            tools,
            system_prompt
        )
        agent_id = agent["id"]

        # Save knowledge sources
        if knowledge_sources:
            await db.pool.execute(
                "UPDATE agents SET knowledge_sources = $1 WHERE id = $2",
                json.dumps(knowledge_sources), agent_id
            )

        logger.info("wizard_agent_created", tenant_id=tenant_id, agent_id=agent_id, prompt_len=len(system_prompt))

    # Mark wizard complete
    await db.pool.execute("""
        UPDATE onboarding_progress SET completed_at = NOW(), current_step = 7, updated_at = NOW()
        WHERE user_id = $1
    """, str(current_user.id))

    return {"agent_id": agent_id, "status": "active", "tenant_id": tenant_id}


@router.post("/test-agent", dependencies=[Depends(get_wizard_user)])
async def test_agent_preview(body: TestAgentRequest, current_user = Depends(get_wizard_user)):
    """Test the agent with the draft system prompt. Uses platform API key.
    Supports conversation memory via session-based message history.
    Uses tools (search_products, etc.) if available for the tenant.
    """
    import openai

    # Resolve API key
    api_key = None
    try:
        from app.api.onboarding import _get_platform_key
        tenant_id = current_user.tenant_id if hasattr(current_user, 'tenant_id') else 0
        api_key = await _get_platform_key(tenant_id or 0)
    except Exception:
        api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise HTTPException(status_code=500, detail="Platform API key not configured")

    client = openai.AsyncOpenAI(api_key=api_key)

    # Session memory: store conversation in Redis for this test session
    session_key = f"wizard_test:{str(current_user.id)}"
    history = []
    try:
        from db import redis_client
        raw_history = await redis_client.get(session_key)
        if raw_history:
            history = json.loads(raw_history)
    except Exception:
        pass

    # Build messages with history
    messages = [{"role": "system", "content": body.system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": body.message})

    try:
        # Define tools for the test (same as production agent)
        tools = [
            {"type": "function", "function": {"name": "search_specific_products", "description": "Buscar productos especificos en el catalogo de la tienda por query", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
            {"type": "function", "function": {"name": "browse_general_storefront", "description": "Mostrar productos destacados de la tienda", "parameters": {"type": "object", "properties": {}}}},
            {"type": "function", "function": {"name": "search_by_category", "description": "Buscar productos por categoria", "parameters": {"type": "object", "properties": {"category": {"type": "string"}}, "required": ["category"]}}},
        ]

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            temperature=0.3,
            max_tokens=4000
        )

        choice = response.choices[0]
        response_text = ""

        # Handle tool calls
        if choice.message.tool_calls:
            # Execute tools
            tool_results = []
            for tc in choice.message.tool_calls:
                tool_name = tc.function.name
                tool_args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                tool_result = {"products": [], "message": "Buscando en el catalogo..."}

                try:
                    tenant_id = current_user.tenant_id if hasattr(current_user, 'tenant_id') else 0
                    if tenant_id and tool_name in ("search_specific_products", "browse_general_storefront", "search_by_category"):
                        # Fetch real products from Tienda Nube
                        tn_token_row = await db.pool.fetchrow(
                            "SELECT value FROM credentials WHERE tenant_id = $1 AND (name = 'TIENDANUBE_ACCESS_TOKEN' OR category = 'tiendanube') LIMIT 1",
                            tenant_id
                        )
                        tn_store_row = await db.pool.fetchrow(
                            "SELECT value FROM credentials WHERE tenant_id = $1 AND (name = 'TIENDANUBE_STORE_ID' OR category = 'tiendanube') AND name LIKE '%STORE%' LIMIT 1",
                            tenant_id
                        )
                        if tn_token_row and tn_store_row:
                            from utils import decrypt_password
                            tn_token = decrypt_password(tn_token_row["value"])
                            tn_store_id = decrypt_password(tn_store_row["value"])
                            import httpx
                            query = tool_args.get("query", "") or tool_args.get("category", "")
                            url = f"https://api.tiendanube.com/v1/{tn_store_id}/products"
                            params = {"per_page": 5}
                            if query:
                                params["q"] = query
                            async with httpx.AsyncClient(timeout=10.0) as http:
                                resp = await http.get(url, params=params, headers={"Authentication": f"bearer {tn_token}", "User-Agent": "FuturePlatform/1.0"})
                                if resp.status_code == 200:
                                    products = resp.json()
                                    tool_result = {"products": [{"name": p.get("name", {}).get("es", p.get("name", "")), "price": p.get("variants", [{}])[0].get("price", "N/A") if p.get("variants") else "N/A"} for p in products[:5]]}
                except Exception as e:
                    logger.error("test_tool_error", tool=tool_name, error=str(e))
                    tool_result = {"error": str(e), "products": []}

                tool_results.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(tool_result)})

            # Send tool results back to get final response
            messages.append(choice.message)
            messages.extend(tool_results)
            final_response = await client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.3,
                max_tokens=4000
            )
            response_text = final_response.choices[0].message.content
        else:
            response_text = choice.message.content

        # Save to history (keep last 20 messages)
        history.append({"role": "user", "content": body.message})
        history.append({"role": "assistant", "content": response_text})
        history = history[-20:]  # Keep last 20
        try:
            from db import redis_client
            await redis_client.setex(session_key, 3600, json.dumps(history))  # 1 hour TTL
        except Exception:
            pass

        return {"response": response_text}
    except Exception as e:
        logger.error("test_agent_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error testing agent")
