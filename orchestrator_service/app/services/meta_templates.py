from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.template import WhatsAppTemplate
from app.core.credentials import get_tenant_credential
import httpx
import structlog
import uuid
from datetime import datetime

logger = structlog.get_logger(__name__)

class MetaTemplateService:
    
    @staticmethod
    async def get_meta_credentials(tenant_id: int):
        token = await get_tenant_credential(tenant_id, 'whatsapp', 'meta_page_token')
        waba_id = await get_tenant_credential(tenant_id, 'whatsapp', 'meta_business_account_id')
        
        if not token or not waba_id:
            # Fallback for dev/legacy or manual setups if stored differently
            # But per strict requirement, we expect them here.
            raise ValueError("Meta Credentials not found for tenant")
            
        return token, waba_id

    @staticmethod
    async def submit_template(tenant_id: int, data: dict, db_session: AsyncSession) -> WhatsAppTemplate:
        """
        Submits a new template to Meta and persists it in PENDING status.
        """
        # 1. Validation & Sanitization
        name = data.get('name', '').lower().strip().replace(' ', '_')
        body_text = data.get('body_text', '')
        category = data.get('category', 'MARKETING')
        language = data.get('language', 'es_AR')

        if not name or not body_text:
            raise ValueError("Name and Body are required")

        # Check for trailing newline (Meta Rule)
        if body_text.endswith('\n'):
            raise ValueError("Body text cannot end with a newline")

        # 2. Get Credentials
        try:
            token, waba_id = await MetaTemplateService.get_meta_credentials(tenant_id)
        except ValueError:
            # If no creds, maybe save as local draft? User requested strict "Meta not connected" error.
            raise ValueError("Meta credentials missing. Please connect WhatsApp first.")

        # 3. Construct Meta Payload
        # Simply supporting BODY text for now as per MVP requirements
        payload = {
            "name": name,
            "category": category,
            "allow_category_change": True,
            "language": language,
            "components": [
                {
                    "type": "BODY",
                    "text": body_text
                }
            ]
        }
        
        # 4. API Call
        url = f"https://graph.facebook.com/v18.0/{waba_id}/message_templates"
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url, 
                json=payload, 
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if resp.status_code != 200:
                error_data = resp.json()
                error_msg = error_data.get('error', {}).get('message', resp.text)
                logger.error("meta_submit_failed", tenant_id=tenant_id, error=error_msg)
                raise ValueError(f"Meta Error: {error_msg}")
            
            meta_resp = resp.json()
            meta_id = meta_resp.get('id')
            status = meta_resp.get('status', 'PENDING')

        # 5. Persist to DB
        new_template = WhatsAppTemplate(
            tenant_id=tenant_id,
            name=name,
            category=category,
            language=language,
            status=status,
            meta_id=meta_id,
            components=payload['components'] # Store what we sent
        )
        
        db_session.add(new_template)
        await db_session.commit()
        await db_session.refresh(new_template)
        
        return new_template

    @staticmethod
    async def sync_status(tenant_id: int, db_session: AsyncSession) -> dict:
        """
        Syncs local templates with Meta's current state.
        """
        try:
            token, waba_id = await MetaTemplateService.get_meta_credentials(tenant_id)
        except ValueError:
             return {"status": "error", "message": "No credentials"}

        url = f"https://graph.facebook.com/v18.0/{waba_id}/message_templates"
        
        async with httpx.AsyncClient() as client:
            # Fetching limit 100
            resp = await client.get(
                url,
                params={"limit": 100},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if resp.status_code != 200:
                raise ValueError(f"Meta Sync Error: {resp.text}")
            
            data = resp.json()
            meta_templates = data.get('data', [])
            
            updated_count = 0
            created_count = 0
            
            # Map existing for quick lookup
            stmt = select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == tenant_id)
            result = await db_session.execute(stmt)
            local_map = {t.name: t for t in result.scalars().all()}
            
            for mt in meta_templates:
                m_name = mt.get('name')
                m_status = mt.get('status')
                m_id = mt.get('id')
                m_components = mt.get('components', [])
                
                if m_name in local_map:
                    # Update
                    local = local_map[m_name]
                    if local.status != m_status or local.meta_id != m_id:
                        local.status = m_status
                        local.meta_id = m_id
                        # Optionally update components if changed
                        updated_count += 1
                else:
                    # Create new (Import)
                    new_t = WhatsAppTemplate(
                        tenant_id=tenant_id,
                        name=m_name,
                        category=mt.get('category', 'UTILITY'),
                        language=mt.get('language', 'es'),
                        status=m_status,
                        meta_id=m_id,
                        components=m_components
                    )
                    db_session.add(new_t)
                    created_count += 1
            
            await db_session.commit()
            return {
                "status": "success", 
                "updated": updated_count, 
                "imported": created_count, 
                "total_meta": len(meta_templates)
            }
