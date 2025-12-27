import asyncio
import structlog
import os
import json
import httpx
from typing import Dict, Any, List
from db import db 
from app.core.rag import RAGCore

logger = structlog.get_logger()

class NexusEngine:
    """
    The 'Heart' of the Business Engine.
    Orchestrates 5 parallel agents using asyncio to minimize user wait time.
    """
    
    def __init__(self, tenant_id: str, context: Dict[str, Any]):
        self.tenant_id = tenant_id
        self.context = context
        self.rag = RAGCore(tenant_id)
        
    async def ignite(self):
        """
        Triggers the 5-Agent parallel workflow.
        """
        logger.info("engine_ignite_start", tenant_id=self.tenant_id)
        
        # 0. Context Preparation
        tn_store_id = self.context.get('credentials', {}).get('tiendanube_store_id')
        tn_token = self.context.get('credentials', {}).get('tiendanube_access_token')
        
        # 1. Fetch Products (Synchronous step for now, required for other agents)
        products = []
        if tn_store_id and tn_token:
             try:
                 # Internal Call to TiendaNube Service via Protocol Omega (Secret Handshake)
                 service_url = os.getenv('TIENDANUBE_SERVICE_URL', 'http://tiendanube_service:8003')
                 async with httpx.AsyncClient(timeout=30.0) as client:
                     resp = await client.post(
                         f"{service_url}/tools/productsall",
                         json={"store_id": tn_store_id, "access_token": tn_token},
                         headers={"X-Internal-Secret": os.getenv("INTERNAL_API_TOKEN")}
                     )
                     if resp.status_code == 200:
                         tool_resp = resp.json()
                         if tool_resp.get("ok"):
                             products = tool_resp.get("data", [])
             except Exception as e:
                 logger.error("product_fetch_failed", error=str(e))

        # Enrich context for agents
        self.context['catalog'] = products

        # 2. Parallel Execution (The "Multitasking" Requirement)
        # We fire 5 tasks simultaneously
        results = await asyncio.gather(
            self._starter_branding(),
            self._starter_scripts(),
            self._starter_visuals(),
            self._starter_roi(),
            self._starter_rag(),
            return_exceptions=True
        )
        
        # 3. Persistence & Response
        final_summary = {}
        for res in results:
            if isinstance(res, Exception):
                logger.error("agent_crash", error=str(res))
                continue
            if res and "type" in res:
                final_summary[res["type"]] = res.get("data")
                
        return {"status": "ignited", "summary": final_summary}

    async def _persist_asset(self, asset_type: str, content: Any):
        """Helper to save asset to DB (Persistence Requirement)."""
        try:
            await db.pool.execute("""
                INSERT INTO business_assets (tenant_id, asset_type, content, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, True, NOW(), NOW())
                ON CONFLICT (tenant_id, asset_type) 
                DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
            """, self.tenant_id, asset_type, json.dumps(content))
            return True
        except Exception as e:
            logger.error("asset_persist_failed", asset_type=asset_type, error=str(e))
            return False

    async def _starter_branding(self):
        """Task 1: Branding Manual (Identity & Style Selection)"""
        try:
            store_name = self.context.get("store_name", "Brand")
            products = self.context.get("catalog", [])
            
            # Smart Analysis: Detect category from products
            main_category = "General"
            if products:
                # Simple majority or first product category
                first_p = products[0]
                cats = first_p.get("categories", [])
                if cats and isinstance(cats, list):
                    main_category = cats[0].get("name", {}).get("es", "Store")
                elif isinstance(cats, dict): # Sometimes it's a dict
                    main_category = cats.get("name", {}).get("es", "Store")

            # Logic: Determine colors based on name and category
            palette = ["#0f172a", "#334155", "#f8fafc"] # Slate default
            archetype = "The Professional"
            
            if "Bio" in store_name or "Eco" in store_name or "Verde" in store_name:
                palette = ["#14532d", "#22c55e", "#f0fdf4"]
                archetype = "The Caregiver / Naturalist"
            elif any(word in main_category.lower() for word in ["moda", "ropa", "fashion"]):
                palette = ["#be123c", "#f43f5e", "#fff1f2"] # Rose/Pink
                archetype = "The Lover / Fashionista"
            elif "Tech" in store_name or "Smart" in store_name:
                palette = ["#1e1b4b", "#4338ca", "#eef2ff"] # Indigo
                archetype = "The Investigator"
            
            data = {
                "identity": {
                    "name": store_name, 
                    "archetype": archetype, 
                    "category_focus": main_category
                },
                "colors": palette,
                "typography": {
                    "primary": "Montserrat" if "moda" in main_category.lower() else "Inter", 
                    "secondary": "Open Sans"
                },
                "vision": f"Convertirse en el referente regional de {main_category} mediante inteligencia artificial."
            }
            await self._persist_asset("branding", data)
            return {"type": "branding", "data": data}
        except Exception as e:
            logger.error("branding_agent_failed", error=str(e))
            raise e

    async def _starter_scripts(self):
        """Task 2: Sales Scripts (Context Aware)"""
        await asyncio.sleep(1) # Stagger slightly
        products = self.context.get("catalog", [])
        top_product = products[0]['name'] if products else "nuestros productos"
        
        data = {
            "welcome_message": f"¡Hola! Bienvenido a {self.context.get('store_name')}. ¿Buscas {top_product}?",
            "objection_handling": "Si el cliente duda del precio, resalta la calidad premium y el envío gratis.",
            "closing_hook": "Oferta válida solo por hoy."
        }
        await self._persist_asset("scripts", data)
        return {"type": "scripts", "data": data}

    async def _starter_visuals(self):
        """Task 3: Visuals Generation (Product-centric Flyers)"""
        await asyncio.sleep(2)
        products = self.context.get("catalog", [])
        
        social_posts = []
        
        # Scenario A: Product Showcase (using catalog image)
        if products:
            p = products[0]
            images = p.get("images", [])
            p_img = images[0].get("src") if images else None
            p_name = p.get("name", {}).get("es", "Producto")
            
            social_posts.append({
                "type": "Product Flyer",
                "caption": f"Descubre lo nuevo: {p_name} 🌟",
                "prompt": f"Elegant social media layout highlighting {p_name}, luxury aesthetic",
                "base_image": p_img
            })
            
            # Scenario B: Lifestyle (using another product if available)
            if len(products) > 1:
                p2 = products[1]
                images2 = p2.get("images", [])
                p_img2 = images2[0].get("src") if images2 else None
                social_posts.append({
                    "type": "Lifestyle Mockup",
                    "caption": "Calidad en cada detalle. ✨",
                    "prompt": "Highly realistic mockup of product in a modern home environment",
                    "base_image": p_img2
                })
        
        # Fallback if no images
        if not social_posts:
            social_posts = [
                {"type": "Brand Awareness", "caption": "Bienvenidos a la nueva era 🚀", "prompt": "Futuristic abstract brand background"},
                {"type": "Promo", "caption": "Oferta de Lanzamiento ⚡", "prompt": "Minimalist typography luxury style"}
            ]

        data = {"social_posts": social_posts}
        await self._persist_asset("visuals", data)
        return {"type": "visuals", "data": data}

    async def _starter_roi(self):
        """Task 4: ROI Projection"""
        await asyncio.sleep(3)
        # Mock projection based on inputs
        data = {
            "projected_revenue_30d": "$1,200,000",
            "break_even_point": "14 Days",
            "growth_factor": "3.5x"
        }
        await self._persist_asset("roi", data)
        return {"type": "roi", "data": data}

    async def _starter_rag(self):
        """Task 5: RAG Ingestion (The Heavy Lifter)"""
        products = self.context.get("catalog", [])
        url = self.context.get("store_website")
        
        if not products:
             await self._persist_asset("rag", {"status": "skipped", "reason": "No catalog"})
             return {"type": "rag", "data": {"status": "skipped"}}
             
        # Actual Ingestion call
        success = await self.rag.ingest_store(products, url)
        
        data = {
            "vectors_indexed": self.rag.count_vectors() if hasattr(self.rag, 'count_vectors') else len(products),
            "status": "active" if success else "partial_error"
        }
        await self._persist_asset("rag", data)
        return {"type": "rag", "data": data}
