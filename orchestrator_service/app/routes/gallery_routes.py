"""
Smart Gallery Routes (Pomelli-style)
- Brand DNA extraction & management
- Photoshoot (product → studio shots)
- Campaign generation (multi-channel)
- Asset CRUD with version history
- Natural language asset editing
"""
import json
import uuid
import structlog
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_pool_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.core.credentials import get_tenant_credential_by_type

logger = structlog.get_logger()

router = APIRouter(prefix="/gallery", tags=["Smart Gallery"])


# ==================== SCHEMAS ====================

class BrandDNARequest(BaseModel):
    website_url: Optional[str] = None
    force_refresh: bool = False


class PhotoshootRequest(BaseModel):
    product_image_url: str
    product_name: str
    template: str = "studio"  # studio, floating, lifestyle, in_use, ingredient
    custom_prompt: Optional[str] = None


class CampaignRequest(BaseModel):
    product_name: str
    product_image_url: Optional[str] = None
    campaign_goal: str = "vender"
    channels: Optional[List[str]] = None
    custom_prompt: Optional[str] = None
    num_variations: int = 3


class EditImageRequest(BaseModel):
    asset_id: str
    edit_prompt: str
    original_image_url: Optional[str] = None  # If not from DB


class EditTextRequest(BaseModel):
    asset_id: str
    edit_prompt: str
    original_text: Optional[str] = None


class SaveAssetRequest(BaseModel):
    asset_type: str  # photoshoot, campaign_image, campaign_text, brand_dna, edited
    content: dict  # Flexible JSON content
    parent_id: Optional[str] = None  # For versioning (edited from)
    product_name: Optional[str] = None
    channel: Optional[str] = None


# ==================== HELPERS ====================

async def _get_google_key(tenant_id: int) -> Optional[str]:
    """Get Google API key for tenant."""
    key = await get_tenant_credential_by_type(tenant_id, "GOOGLE_API_KEY")
    if not key:
        from app.core.config import settings
        key = settings.GOOGLE_API_KEY
    return key


async def _get_brand_dna(tenant_id: int, db) -> Optional[dict]:
    """Fetch stored Brand DNA for tenant."""
    row = await db.fetchrow("""
        SELECT content FROM business_assets
        WHERE tenant_id = $1 AND asset_type = 'brand_dna' AND is_active = true
        ORDER BY updated_at DESC LIMIT 1
    """, str(tenant_id))
    if row and row["content"]:
        return row["content"] if isinstance(row["content"], dict) else json.loads(row["content"])
    return None


# ==================== BRAND DNA ====================

@router.post("/brand-dna/extract")
async def extract_brand_dna(
    req: BrandDNARequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """
    Extract Brand DNA from website + TiendaNube data.
    Like Pomelli's Business DNA but powered by TiendaNube API.
    """
    tenant_id = current_user.tenant_id

    # Check if already exists (unless force refresh)
    if not req.force_refresh:
        existing = await _get_brand_dna(tenant_id, db)
        if existing:
            return {"brand_dna": existing, "cached": True}

    google_key = await _get_google_key(tenant_id)

    # Get TiendaNube store data
    tn_data = None
    try:
        tenant = await db.fetchrow(
            "SELECT store_name, store_description, store_website, tiendanube_store_id, tiendanube_access_token FROM tenants WHERE id = $1",
            tenant_id
        )
        if tenant and tenant["tiendanube_store_id"] and tenant["tiendanube_access_token"]:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"https://api.tiendanube.com/v1/{tenant['tiendanube_store_id']}/store",
                    headers={"Authentication": f"bearer {tenant['tiendanube_access_token']}"}
                )
                if resp.status_code == 200:
                    tn_data = resp.json()
    except Exception as e:
        logger.warning("brand_dna_tn_fetch_failed", error=str(e))

    # Determine website URL
    website_url = req.website_url
    if not website_url and tenant:
        website_url = tenant["store_website"]
    if not website_url and tn_data:
        website_url = tn_data.get("url_with_protocol") or tn_data.get("main_url")

    # Extract Brand DNA
    from app.services.brand_dna import BrandDNAExtractor
    extractor = BrandDNAExtractor(google_api_key=google_key)

    brand_dna = await extractor.extract(
        website_url=website_url,
        tiendanube_data=tn_data,
        store_name=tenant["store_name"] if tenant else None,
        store_description=tenant["store_description"] if tenant else None
    )

    # Persist as business asset (upsert: only 1 brand_dna per tenant)
    existing_id = await db.fetchval(
        "SELECT id FROM business_assets WHERE tenant_id = $1 AND asset_type = 'brand_dna' LIMIT 1",
        str(tenant_id)
    )
    if existing_id:
        await db.execute(
            "UPDATE business_assets SET content = $1::jsonb, updated_at = NOW() WHERE id = $2",
            json.dumps(brand_dna), str(existing_id)
        )
    else:
        await db.execute("""
            INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active)
            VALUES ($1, $2, 'brand_dna', $3::jsonb, true)
        """, str(uuid.uuid4()), str(tenant_id), json.dumps(brand_dna))

    return {"brand_dna": brand_dna, "cached": False}


@router.get("/brand-dna")
async def get_brand_dna(
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Get stored Brand DNA for current tenant."""
    dna = await _get_brand_dna(current_user.tenant_id, db)
    if not dna:
        return {"brand_dna": None, "message": "No Brand DNA extracted yet. Use POST /gallery/brand-dna/extract"}
    return {"brand_dna": dna}


# ==================== PHOTOSHOOT ====================

@router.get("/photoshoot/templates")
async def list_photoshoot_templates():
    """List available photoshoot templates."""
    from app.services.creative_studio import get_photoshoot_templates
    return get_photoshoot_templates()


@router.post("/photoshoot/generate")
async def generate_photoshoot(
    req: PhotoshootRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Generate a studio-quality product shot."""
    google_key = await _get_google_key(current_user.tenant_id)
    brand_dna = await _get_brand_dna(current_user.tenant_id, db)

    from app.services.creative_studio import CreativeStudio
    studio = CreativeStudio(google_api_key=google_key)

    result = await studio.photoshoot(
        product_image_url=req.product_image_url,
        product_name=req.product_name,
        template=req.template,
        brand_dna=brand_dna,
        custom_prompt=req.custom_prompt
    )

    # Auto-save as asset
    asset_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active)
        VALUES ($1, $2, 'photoshoot', $3::jsonb, true)
    """, asset_id, str(current_user.tenant_id), json.dumps({
        **result,
        "generated_at": datetime.utcnow().isoformat()
    }))

    result["asset_id"] = asset_id
    return result


# ==================== CAMPAIGN GENERATOR ====================

@router.get("/campaigns/channels")
async def list_campaign_channels():
    """List available campaign channels."""
    from app.services.creative_studio import get_campaign_channels
    return get_campaign_channels()


@router.post("/campaigns/generate")
async def generate_campaign(
    req: CampaignRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Generate a multi-channel marketing campaign."""
    google_key = await _get_google_key(current_user.tenant_id)
    brand_dna = await _get_brand_dna(current_user.tenant_id, db)

    from app.services.creative_studio import CreativeStudio
    studio = CreativeStudio(google_api_key=google_key)

    result = await studio.generate_campaign(
        product_name=req.product_name,
        product_image_url=req.product_image_url,
        campaign_goal=req.campaign_goal,
        channels=req.channels,
        brand_dna=brand_dna,
        custom_prompt=req.custom_prompt,
        num_variations=req.num_variations
    )

    # Auto-save each channel asset
    campaign_id = str(uuid.uuid4())
    saved_assets = []

    for channel_asset in result.get("channels", []):
        asset_id = str(uuid.uuid4())
        await db.execute("""
            INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active)
            VALUES ($1, $2, 'campaign', $3::jsonb, true)
        """, asset_id, str(current_user.tenant_id), json.dumps({
            "campaign_id": campaign_id,
            "channel": channel_asset["channel"],
            "channel_name": channel_asset["channel_name"],
            "texts": channel_asset["texts"],
            "image_url": channel_asset.get("image_url"),
            "product_name": req.product_name,
            "campaign_goal": req.campaign_goal,
            "generated_at": datetime.utcnow().isoformat()
        }))
        channel_asset["asset_id"] = asset_id
        saved_assets.append(asset_id)

    result["campaign_id"] = campaign_id
    result["saved_asset_ids"] = saved_assets
    return result


# ==================== ASSET EDITOR ====================

@router.post("/assets/edit-image")
async def edit_image_asset(
    req: EditImageRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Edit an image asset using natural language prompt."""
    google_key = await _get_google_key(current_user.tenant_id)
    brand_dna = await _get_brand_dna(current_user.tenant_id, db)

    # Get original image from DB if asset_id provided
    original_url = req.original_image_url
    product_name = None
    if req.asset_id and req.asset_id != "new":
        asset = await db.fetchrow(
            "SELECT content FROM business_assets WHERE id = $1 AND tenant_id = $2",
            req.asset_id, str(current_user.tenant_id)
        )
        if asset and asset["content"]:
            content = asset["content"] if isinstance(asset["content"], dict) else json.loads(asset["content"])
            original_url = original_url or content.get("image_url")
            product_name = content.get("product_name")

    if not original_url:
        raise HTTPException(status_code=400, detail="No image found to edit")

    from app.services.creative_studio import CreativeStudio
    studio = CreativeStudio(google_api_key=google_key)

    result = await studio.edit_image_asset(
        original_image_url=original_url,
        edit_prompt=req.edit_prompt,
        product_name=product_name,
        brand_dna=brand_dna
    )

    # Save as new version
    new_asset_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active)
        VALUES ($1, $2, 'edited_image', $3::jsonb, true)
    """, new_asset_id, str(current_user.tenant_id), json.dumps({
        **result,
        "parent_asset_id": req.asset_id,
        "generated_at": datetime.utcnow().isoformat()
    }))

    result["asset_id"] = new_asset_id
    result["parent_asset_id"] = req.asset_id
    return result


@router.post("/assets/edit-text")
async def edit_text_asset(
    req: EditTextRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Edit a text asset (script, copy) using natural language."""
    google_key = await _get_google_key(current_user.tenant_id)
    brand_dna = await _get_brand_dna(current_user.tenant_id, db)

    # Get original text from DB
    original_text = req.original_text
    asset_type = "scripts"
    if req.asset_id and req.asset_id != "new":
        asset = await db.fetchrow(
            "SELECT content, asset_type FROM business_assets WHERE id = $1 AND tenant_id = $2",
            req.asset_id, str(current_user.tenant_id)
        )
        if asset:
            content = asset["content"] if isinstance(asset["content"], dict) else json.loads(asset["content"])
            asset_type = asset["asset_type"] or "scripts"
            # Extract text from various content shapes
            if isinstance(content, dict):
                original_text = original_text or content.get("text") or content.get("body") or content.get("script") or json.dumps(content)
            elif isinstance(content, str):
                original_text = original_text or content

    if not original_text:
        raise HTTPException(status_code=400, detail="No text found to edit")

    from app.services.creative_studio import CreativeStudio
    studio = CreativeStudio(google_api_key=google_key)

    result = await studio.edit_text_asset(
        original_text=original_text,
        edit_prompt=req.edit_prompt,
        asset_type=asset_type,
        brand_dna=brand_dna
    )

    # Save as new version
    new_asset_id = str(uuid.uuid4())
    await db.execute("""
        INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active)
        VALUES ($1, $2, $3, $4::jsonb, true)
    """, new_asset_id, str(current_user.tenant_id), f"edited_{asset_type}", json.dumps({
        **result,
        "parent_asset_id": req.asset_id,
        "generated_at": datetime.utcnow().isoformat()
    }))

    result["asset_id"] = new_asset_id
    result["parent_asset_id"] = req.asset_id
    return result


# ==================== ASSET GALLERY (CRUD) ====================

@router.get("/assets")
async def list_assets(
    asset_type: str = None,
    search: str = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """List all gallery assets for the tenant with filtering."""
    conditions = ["tenant_id = $1", "is_active = true"]
    params = [str(current_user.tenant_id)]
    idx = 2

    if asset_type:
        conditions.append(f"asset_type = ${idx}")
        params.append(asset_type)
        idx += 1

    if search:
        conditions.append(f"(content::text ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1

    where = " AND ".join(conditions)
    params.extend([limit, offset])

    rows = await db.fetch(f"""
        SELECT id, asset_type, content, created_at, updated_at
        FROM business_assets
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """, *params)

    total = await db.fetchval(f"""
        SELECT COUNT(*) FROM business_assets WHERE {where}
    """, *params[:-2])

    return {
        "assets": [
            {
                "id": str(r["id"]),
                "asset_type": r["asset_type"],
                "content": r["content"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None
            }
            for r in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/assets/{asset_id}")
async def get_asset(
    asset_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Get a single asset with its version history."""
    asset = await db.fetchrow(
        "SELECT * FROM business_assets WHERE id = $1 AND tenant_id = $2",
        asset_id, str(current_user.tenant_id)
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Get version history (children that reference this as parent)
    content = asset["content"] if isinstance(asset["content"], dict) else json.loads(asset["content"]) if asset["content"] else {}

    versions = await db.fetch("""
        SELECT id, asset_type, content, created_at
        FROM business_assets
        WHERE tenant_id = $1
        AND content::text LIKE $2
        ORDER BY created_at DESC
    """, str(current_user.tenant_id), f'%"parent_asset_id": "{asset_id}"%')

    return {
        "id": str(asset["id"]),
        "asset_type": asset["asset_type"],
        "content": content,
        "created_at": asset["created_at"].isoformat() if asset["created_at"] else None,
        "versions": [
            {
                "id": str(v["id"]),
                "asset_type": v["asset_type"],
                "content": v["content"],
                "created_at": v["created_at"].isoformat() if v["created_at"] else None
            }
            for v in versions
        ]
    }


@router.delete("/assets/{asset_id}")
async def delete_asset(
    asset_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Soft-delete an asset."""
    result = await db.execute(
        "UPDATE business_assets SET is_active = false WHERE id = $1 AND tenant_id = $2",
        asset_id, str(current_user.tenant_id)
    )
    return {"deleted": True, "asset_id": asset_id}


@router.post("/assets/save")
async def save_asset(
    req: SaveAssetRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_pool_db)
):
    """Manually save an asset to the gallery."""
    asset_id = str(uuid.uuid4())
    content = {
        **req.content,
        "product_name": req.product_name,
        "channel": req.channel,
        "parent_asset_id": req.parent_id,
        "saved_at": datetime.utcnow().isoformat()
    }

    await db.execute("""
        INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active)
        VALUES ($1, $2, $3, $4::jsonb, true)
    """, asset_id, str(current_user.tenant_id), req.asset_type, json.dumps(content))

    return {"asset_id": asset_id, "saved": True}
