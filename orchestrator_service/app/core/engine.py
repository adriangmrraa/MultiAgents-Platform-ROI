import asyncio
import structlog
import os
import json
import httpx
from datetime import datetime
from uuid import uuid4
from typing import Dict, Any, List
from db import db, redis_client 
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
                         headers={"X-Internal-Secret": os.getenv("INTERNAL_API_TOKEN") or os.getenv("INTERNAL_SECRET_KEY") or "super-secret-internal-token"}
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
        
        # Protocol Omega: Signal Completion
        await self._publish_event("task_completed", {"status": "success", "summary_count": len(final_summary)})

        return {"status": "ignited", "summary": final_summary}

    async def _persist_asset(self, asset_type: str, content: Any):
        """Helper to save asset to DB (Persistence Requirement) & Stream."""
        try:
            # 1. SSOT Persistence (Postgres)
            asset_id = str(uuid4()) # Generate ID early for event
            await db.pool.execute("""
                INSERT INTO business_assets (id, tenant_id, asset_type, content, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, True, NOW(), NOW())
                ON CONFLICT (tenant_id, asset_type) 
                DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
            """, asset_id, self.tenant_id, asset_type, json.dumps(content))
            
            # 2. Protocol Omega Streaming (Redis Pub/Sub)
            await self._publish_event("asset_generated", {
                "asset_id": asset_id,
                "asset_type": asset_type,
                "content": content
            })
            
            return True
        except Exception as e:
            logger.error("asset_persist_failed", asset_type=asset_type, error=str(e))
            return False

    async def _publish_event(self, event_type: str, data: Any):
        """Protocol Omega: Strict Event Publishing"""
        try:
            channel = f"events:tenant:{self.tenant_id}:assets"
            payload = {
                "event_id": str(uuid4()),
                "timestamp": datetime.utcnow().isoformat(),
                "type": event_type,
                "data": data
            }
            await redis_client.publish(channel, json.dumps(payload))
        except Exception as e:
            logger.error("redis_publish_failed", error=str(e))

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
        """Task 3: Visuals Generation (REAL-TIME FUSION for 5 Products)"""
        # Note: User explicitly requested full generation during onboarding despite API costs.
        # UPDATED: Added staggered delays to prevent 429 Rate Limits from OpenAI.
        from app.core.image_utils import analyze_image_with_gpt4o, generate_image_dalle3
        
        await asyncio.sleep(1)
        products = self.context.get("catalog", [])
        store_name = self.context.get("store_name", "Brand")
        
        # Select top 5
        top_products = products[:5]
        social_posts = []
        
        # Sequential Processing with Delay
        for i, p in enumerate(top_products):
            try:
                # Rate Limit Safety: Sleep 2s between requests (except first)
                if i > 0: await asyncio.sleep(2)
                
                images = p.get("images", [])
                p_img = images[0].get("src") if images else None
                p_name = p.get("name", {}).get("es", "Producto")
                
                if not p_img: continue

                # 1. Vision Analysis (Describe product)
                description = await analyze_image_with_gpt4o(p_img, f"Product for {store_name}")
                
                # 2. Construct Fusion Prompt
                fusion_prompt = f"Professional advertising photography of {p_name}. The product features: {description}. Context: Luxury minimal studio setting, cinematic soft lighting, 8k resolution, commercial aesthetic."
                
                # 3. Generate Image (DALL-E 3)
                gen_url = await generate_image_dalle3(fusion_prompt)
                
                social_posts.append({
                    "type": "Ad Fusion",
                    "title": f"{p_name} Campaign",
                    "caption": f"Descubre {p_name}. Calidad que inspira.",
                    "prompt": fusion_prompt,
                    "base_image": p_img,
                    "generated_url": gen_url,
                    "product_name": p_name
                })
                
                # Report Progress via Logging (Optional for debugging)
                logger.info("visual_gen_success", product=p_name)
                
            except Exception as e:
                logger.error("fusion_item_failed", product=p.get("id"), error=str(e))
                # Continue loop despite error
                continue
        
        # Fallback if no products or all failed
        if not social_posts:
             social_posts = [
                {"type": "Brand Awareness", "title": "Brand Launch", "caption": "Bienvenidos a la nueva era 🚀", "prompt": "Futuristic abstract brand background", "generated_url": None},
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
