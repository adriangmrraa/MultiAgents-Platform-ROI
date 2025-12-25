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
        """Task 1: Branding Manual"""
        try:
            # Simulation of Analysis
            store_name = self.context.get("store_name", "Brand")
            
            # Logic: Determine colors based on name logic (Mock AI)
            palette = ["#000000", "#FFFFFF"]
            if "Bio" in store_name or "Eco" in store_name:
                palette = ["#4ade80", "#14532d", "#fefce8"]
            elif "Tech" in store_name or "Cyber" in store_name:
                palette = ["#06b6d4", "#0f172a", "#f8fafc"]
            
            data = {
                "identity": {"name": store_name, "archetype": "Innovator"},
                "colors": palette,
                "typography": {"primary": "Inter", "secondary": "Roboto Mono"}
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
        """Task 3: Visuals Generation"""
        await asyncio.sleep(2)
        data = {
            "social_posts": [
                {"caption": "Nueva Colección 🚀", "prompt": "Futuristic product showcase, unreal engine 5"},
                {"caption": "Oferta Limitada ⚡", "prompt": "Minimalist typography luxury style"}
            ]
        }
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
