from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db import get_db
from app.models.template import WhatsAppTemplate
from app.api.deps import get_current_tenant
from app.schemas.tenant import TenantInternal
from typing import List, Optional, Any
from pydantic import BaseModel, Field, field_validator
import uuid
import structlog
from app.services.meta_templates import MetaTemplateService

router = APIRouter()
logger = structlog.get_logger(__name__)

# --- Schemas ---
class TemplateCreate(BaseModel):
    name: str
    category: str # MARKETING, UTILITY, AUTHENTICATION
    body_text: str
    language: str = "es_AR"

class TemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    status: str
    language: str
    meta_id: Optional[str] = None
    components: List[dict] = []
    
    # Virtual field for frontend compatibility
    body_text: str = ""

    @field_validator('body_text', mode='before')
    @classmethod
    def extract_body(cls, v: Any, info) -> str:
        # If body_text is already provided (e.g. from ORM object attribute if one existed), returns it.
        # But our ORM doesn't have it. We rely on 'components'.
        # Pydantic V2 validator access to other fields is via 'info.data' but 'mode=before' 
        # means we might be getting the ORM object itself? 
        # Actually, simpler to use a computed_field or property, but let's do it in the endpoint for simplicity
        # or rely on `from_attributes=True` and a property on the ORM model?
        # Let's adjust the endpoint to shape the response dict.
        return v or ""

    class Config:
        from_attributes = True

# Helper to flatten components to body_text
def flatten_template(t: WhatsAppTemplate) -> dict:
    body = ""
    # t.components is a list of dicts or just a list (JSONB)
    comps = t.components if isinstance(t.components, list) else []
    for c in comps:
        if c.get("type") == "BODY":
            body = c.get("text", "")
            break
            
    return {
        "id": t.id,
        "name": t.name,
        "category": t.category,
        "status": t.status,
        "language": t.language,
        "meta_id": t.meta_id,
        "components": comps,
        "body_text": body
    }

# --- Endpoints ---

@router.get("/", response_model=List[TemplateResponse])
async def list_templates(
    tenant: TenantInternal = Depends(get_current_tenant),
    db_session: AsyncSession = Depends(get_db)
):
    """
    List all templates for the current tenant.
    """
    result = await db_session.execute(
        select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == tenant.id).order_by(WhatsAppTemplate.created_at.desc())
    )
    templates = result.scalars().all()
    # Serialize manually to handle the body_text extraction
    return [flatten_template(t) for t in templates]

@router.post("/create", response_model=TemplateResponse)
async def create_template(
    t: TemplateCreate,
    tenant: TenantInternal = Depends(get_current_tenant),
    db_session: AsyncSession = Depends(get_db)
):
    """
    Create a new template and submit to Meta Graph API.
    """
    try:
        new_template = await MetaTemplateService.submit_template(
            tenant_id=tenant.id, 
            data=t.model_dump(), 
            db_session=db_session
        )
        return flatten_template(new_template)
    except ValueError as e:
        # Handle "Meta Error" clean return
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("template_create_unexpected_error", error=str(e))
        raise HTTPException(status_code=500, detail="Internal Server Error during template creation")

@router.post("/sync")
async def sync_templates(
    tenant: TenantInternal = Depends(get_current_tenant),
    db_session: AsyncSession = Depends(get_db)
):
    """
    Force Sync status from Meta.
    """
    result = await MetaTemplateService.sync_status(tenant.id, db_session)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result
