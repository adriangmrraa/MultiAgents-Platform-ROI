import os
import json
import logging
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from db import db
from app.models.auth import User
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/onboarding-wizard", tags=["onboarding-wizard"])


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

@router.get("/progress", dependencies=[Depends(get_current_user)])
async def get_progress(current_user: User = Depends(get_current_user)):
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


@router.put("/progress", dependencies=[Depends(get_current_user)])
async def update_progress(body: ProgressUpdate, current_user: User = Depends(get_current_user)):
    """Update onboarding wizard progress. Validates step sequence."""
    progress = await _get_or_create_progress(current_user)

    # Validate step sequence — can only go forward by 1 or stay
    current = progress["current_step"]
    if body.step > current + 1:
        raise HTTPException(status_code=400, detail="No puedes saltar pasos. Completa el paso actual primero.")

    # Merge step_data
    existing_data = progress["step_data"] if isinstance(progress["step_data"], dict) else {}
    if body.step_data:
        step_key = f"step_{body.step}"
        existing_data[step_key] = {**existing_data.get(step_key, {}), **body.step_data}

    # Update prompt draft if provided
    prompt_draft = body.system_prompt_draft if body.system_prompt_draft is not None else progress["system_prompt_draft"]

    row = await db.pool.fetchrow("""
        UPDATE onboarding_progress
        SET current_step = $1, step_data = $2, system_prompt_draft = $3, updated_at = NOW()
        WHERE user_id = $4
        RETURNING *
    """, body.step, json.dumps(existing_data), prompt_draft, str(current_user.id))

    return dict(row)


@router.post("/create-tenant", dependencies=[Depends(get_current_user)])
async def create_tenant_for_wizard(body: CreateTenant, current_user: User = Depends(get_current_user)):
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


@router.post("/complete", dependencies=[Depends(get_current_user)])
async def complete_wizard(current_user: User = Depends(get_current_user)):
    """Complete the wizard: create agent with accumulated system prompt and mark done."""
    progress = await _get_or_create_progress(current_user)
    tenant_id = current_user.tenant_id or progress.get("tenant_id")

    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated. Complete step 1 first.")

    system_prompt = progress["system_prompt_draft"]
    if not system_prompt or len(system_prompt.strip()) < 20:
        system_prompt = "Eres un asistente virtual de ventas amable y profesional."

    step_data = progress["step_data"] if isinstance(progress["step_data"], dict) else {}
    store_name = step_data.get("step_1", {}).get("store_name", "Mi Tienda")

    # Create agent
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
        json.dumps(["search_specific_products", "search_by_category", "browse_general_storefront", "orders", "derivhumano"]),
        system_prompt
    )

    # Mark wizard complete
    await db.pool.execute("""
        UPDATE onboarding_progress SET completed_at = NOW(), current_step = 7, updated_at = NOW()
        WHERE user_id = $1
    """, str(current_user.id))

    logger.info("wizard_completed", tenant_id=tenant_id, agent_id=agent["id"])
    return {"agent_id": agent["id"], "status": "active", "tenant_id": tenant_id}


@router.post("/test-agent", dependencies=[Depends(get_current_user)])
async def test_agent_preview(body: TestAgentRequest, current_user: User = Depends(get_current_user)):
    """Test the agent with the draft system prompt. Uses platform API key."""
    import openai

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Platform API key not configured")

    client = openai.AsyncOpenAI(api_key=api_key)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": body.system_prompt},
                {"role": "user", "content": body.message}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        logger.error("test_agent_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error testing agent")
