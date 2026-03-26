import os
import io
import csv
import json
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from db import db
from app.models.auth import User
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/products", tags=["products"])


# --- Schemas ---

class ProductCreate(BaseModel):
    name: str
    description: str = ""
    category: str = "General"
    price: float = 0
    compare_at_price: Optional[float] = None
    currency: str = "ARS"
    stock: int = 0
    variants: list = []
    images: list = []
    tags: list = []
    sku: Optional[str] = None


class ProductUpdate(ProductCreate):
    is_active: Optional[bool] = True


# --- Helpers ---

async def _get_tenant_id(user: User) -> int:
    if user.tenant_id:
        return user.tenant_id
    row = await db.pool.fetchrow("SELECT id FROM tenants WHERE owner_email = $1 LIMIT 1", user.email)
    if not row:
        raise HTTPException(status_code=404, detail="No tenant found")
    return row["id"]


# --- CRUD ---

@router.get("")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """List products for the tenant."""
    tenant_id = await _get_tenant_id(current_user)
    query = "SELECT * FROM internal_products WHERE tenant_id = $1 AND is_active = true"
    params = [tenant_id]
    idx = 2

    if category:
        query += f" AND category = ${idx}"
        params.append(category)
        idx += 1
    if q:
        query += f" AND (name ILIKE ${idx} OR description ILIKE ${idx})"
        params.append(f"%{q}%")
        idx += 1

    query += f" ORDER BY created_at DESC LIMIT ${idx} OFFSET ${idx + 1}"
    params.extend([limit, offset])

    rows = await db.pool.fetch(query, *params)
    total = await db.pool.fetchval(
        "SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1 AND is_active = true", tenant_id)

    return {"products": [dict(r) for r in rows], "total": total}


@router.get("/categories")
async def list_categories(current_user: User = Depends(get_current_user)):
    """List unique categories."""
    tenant_id = await _get_tenant_id(current_user)
    rows = await db.pool.fetch(
        "SELECT DISTINCT category FROM internal_products WHERE tenant_id = $1 AND is_active = true ORDER BY category",
        tenant_id)
    return [r["category"] for r in rows]


@router.get("/{product_id}")
async def get_product(product_id: int, current_user: User = Depends(get_current_user)):
    """Get single product."""
    tenant_id = await _get_tenant_id(current_user)
    row = await db.pool.fetchrow(
        "SELECT * FROM internal_products WHERE id = $1 AND tenant_id = $2", product_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return dict(row)


@router.post("")
async def create_product(body: ProductCreate, current_user: User = Depends(get_current_user)):
    """Create a product."""
    tenant_id = await _get_tenant_id(current_user)

    # Free trial limit: 50 products
    count = await db.pool.fetchval(
        "SELECT COUNT(*) FROM internal_products WHERE tenant_id = $1", tenant_id)
    if count >= 50:
        # Check plan
        sub = await db.pool.fetchrow(
            "SELECT p.name FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.tenant_id = $1 AND s.status = 'active' LIMIT 1",
            tenant_id)
        plan = sub["name"] if sub else "free"
        if plan == "free" and count >= 50:
            raise HTTPException(status_code=403, detail="Free trial limit: 50 products. Upgrade to add more.")

    row = await db.pool.fetchrow("""
        INSERT INTO internal_products (tenant_id, name, description, category, price, compare_at_price,
            currency, stock, variants, images, tags, sku)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
    """,
        tenant_id, body.name, body.description, body.category, body.price,
        body.compare_at_price, body.currency, body.stock,
        json.dumps(body.variants), json.dumps(body.images), json.dumps(body.tags),
        body.sku
    )
    return dict(row)


@router.put("/{product_id}")
async def update_product(product_id: int, body: ProductUpdate, current_user: User = Depends(get_current_user)):
    """Update a product."""
    tenant_id = await _get_tenant_id(current_user)
    row = await db.pool.fetchrow("""
        UPDATE internal_products SET
            name = $1, description = $2, category = $3, price = $4,
            compare_at_price = $5, currency = $6, stock = $7,
            variants = $8, images = $9, tags = $10, sku = $11,
            is_active = $12, updated_at = NOW()
        WHERE id = $13 AND tenant_id = $14
        RETURNING *
    """,
        body.name, body.description, body.category, body.price,
        body.compare_at_price, body.currency, body.stock,
        json.dumps(body.variants), json.dumps(body.images), json.dumps(body.tags),
        body.sku, body.is_active, product_id, tenant_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return dict(row)


@router.delete("/{product_id}")
async def delete_product(product_id: int, current_user: User = Depends(get_current_user)):
    """Delete a product."""
    tenant_id = await _get_tenant_id(current_user)
    result = await db.pool.execute(
        "DELETE FROM internal_products WHERE id = $1 AND tenant_id = $2", product_id, tenant_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Product not found")
    return {"status": "deleted"}


@router.post("/bulk")
async def bulk_create(products: List[ProductCreate], current_user: User = Depends(get_current_user)):
    """Create up to 50 products at once."""
    if len(products) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 products per bulk create")
    tenant_id = await _get_tenant_id(current_user)
    created = []
    for p in products:
        row = await db.pool.fetchrow("""
            INSERT INTO internal_products (tenant_id, name, description, category, price,
                compare_at_price, currency, stock, variants, images, tags, sku)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, name
        """,
            tenant_id, p.name, p.description, p.category, p.price,
            p.compare_at_price, p.currency, p.stock,
            json.dumps(p.variants), json.dumps(p.images), json.dumps(p.tags), p.sku
        )
        created.append(dict(row))
    return {"created": len(created), "products": created}


# --- Excel/CSV Import ---

@router.get("/export-template")
async def export_template():
    """Download CSV template for product import."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["nombre", "descripcion", "categoria", "precio", "precio_anterior", "variante", "stock", "sku", "imagen_url"])
    writer.writerow(["Remera Algodon", "Premium quality", "Remeras", "15000", "18000", "S", "10", "REM-S", "https://example.com/img.jpg"])
    writer.writerow(["Remera Algodon", "Premium quality", "Remeras", "15000", "18000", "M", "15", "REM-M", ""])
    writer.writerow(["Remera Algodon", "Premium quality", "Remeras", "15000", "18000", "L", "8", "REM-L", ""])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=productos_template.csv"}
    )


@router.post("/import")
async def import_products(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Import products from CSV file."""
    tenant_id = await _get_tenant_id(current_user)
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    products_map = {}
    for row in reader:
        name = row.get("nombre", "").strip()
        if not name:
            continue
        if name not in products_map:
            products_map[name] = {
                "name": name,
                "description": row.get("descripcion", ""),
                "category": row.get("categoria", "General"),
                "price": float(row.get("precio", 0) or 0),
                "compare_at_price": float(row.get("precio_anterior", 0) or 0) or None,
                "variants": [],
                "images": [],
                "stock": 0,
            }
        variante = row.get("variante", "").strip()
        stock = int(row.get("stock", 0) or 0)
        sku = row.get("sku", "").strip()
        img = row.get("imagen_url", "").strip()

        if variante:
            products_map[name]["variants"].append({
                "name": variante, "price": float(row.get("precio", 0) or 0),
                "stock": stock, "sku": sku
            })
            products_map[name]["stock"] += stock
        else:
            products_map[name]["stock"] = stock

        if img and img not in products_map[name]["images"]:
            products_map[name]["images"].append(img)

    created = 0
    for p in products_map.values():
        await db.pool.execute("""
            INSERT INTO internal_products (tenant_id, name, description, category, price,
                compare_at_price, stock, variants, images)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
            tenant_id, p["name"], p["description"], p["category"], p["price"],
            p["compare_at_price"], p["stock"],
            json.dumps(p["variants"]), json.dumps(p["images"])
        )
        created += 1

    return {"imported": created, "products": list(products_map.keys())}


# --- Search (for agent tools — TN-compatible format) ---

internal_search_router = APIRouter(prefix="/internal/products", tags=["internal-products"])


@internal_search_router.get("/search")
async def search_internal(q: str = "", tenant_id: int = 0):
    """Search products — returns TN-compatible format."""
    if not tenant_id:
        return []
    rows = await db.pool.fetch("""
        SELECT * FROM internal_products
        WHERE tenant_id = $1 AND is_active = true AND (name ILIKE $2 OR description ILIKE $2 OR category ILIKE $2)
        LIMIT 5
    """, tenant_id, f"%{q}%")
    return [_to_tn_format(r) for r in rows]


@internal_search_router.get("/category/{category}")
async def search_by_category_internal(category: str, tenant_id: int = 0):
    """Search by category — TN-compatible format."""
    if not tenant_id:
        return []
    rows = await db.pool.fetch("""
        SELECT * FROM internal_products
        WHERE tenant_id = $1 AND is_active = true AND category ILIKE $2
        LIMIT 5
    """, tenant_id, f"%{category}%")
    return [_to_tn_format(r) for r in rows]


@internal_search_router.get("/featured")
async def featured_internal(tenant_id: int = 0):
    """Featured products — TN-compatible format."""
    if not tenant_id:
        return []
    rows = await db.pool.fetch("""
        SELECT * FROM internal_products
        WHERE tenant_id = $1 AND is_active = true
        ORDER BY created_at DESC LIMIT 5
    """, tenant_id)
    return [_to_tn_format(r) for r in rows]


def _to_tn_format(row):
    """Convert internal product to Tienda Nube API-compatible format."""
    images = row["images"] if isinstance(row["images"], list) else json.loads(row["images"] or "[]")
    variants = row["variants"] if isinstance(row["variants"], list) else json.loads(row["variants"] or "[]")

    return {
        "id": row["id"],
        "name": {"es": row["name"]},
        "description": {"es": row["description"] or ""},
        "variants": [
            {
                "id": i + 1,
                "price": str(v.get("price", row["price"])),
                "stock": v.get("stock", row["stock"]),
                "sku": v.get("sku", ""),
                "values": [{"es": v.get("name", "")}] if v.get("name") else []
            }
            for i, v in enumerate(variants)
        ] if variants else [{"id": 1, "price": str(row["price"]), "stock": row["stock"]}],
        "images": [{"src": img if isinstance(img, str) else img.get("src", "")} for img in images],
        "permalink": row.get("public_url") or f"/products/{row['id']}",
        "categories": [{"name": {"es": row["category"]}}] if row["category"] else [],
    }
