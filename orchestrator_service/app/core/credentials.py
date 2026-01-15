import structlog
from db import db
from utils import decrypt_password

logger = structlog.get_logger()

async def get_tenant_credential(tenant_id: int, category: str, name_pattern: str = None) -> str | None:
    """
    Fetches and decrypts a tenant-specific credential from the database.
    
    Args:
        tenant_id: The ID of the tenant.
        category: The category of the credential (e.g., 'openai', 'whatsapp').
        name_pattern: Optional ILIKE pattern for the credential name (e.g., '%api_key%').
        
    Returns:
        The decrypted credential value, or None if not found.
    """
    try:
        query = """
            SELECT value FROM credentials 
            WHERE tenant_id = $1 AND category = $2
        """
        params = [tenant_id, category]
        
        if name_pattern:
            query += " AND name ILIKE $3"
            params.append(name_pattern)
            
        query += " LIMIT 1"
        
        # Ensure DB is connected (ignite in main.py usually handles this, but safe is better)
        if not db.pool:
            await db.connect()
            
        row = await db.pool.fetchrow(query, *params)
        
        if row and row['value']:
            decrypted = decrypt_password(row['value'])
            return decrypted
            
        return None
    except Exception as e:
        logger.error("credential_fetch_failed", tenant_id=tenant_id, category=category, error=str(e))
        return None
