import structlog
from db import db
from utils import decrypt_password

logger = structlog.get_logger()

async def get_tenant_credential_by_type(tenant_id: int, internal_key: str) -> str | None:
    """
    Fetches and decrypts a tenant-specific credential by its internal_key (Credential Architecture v2).
    
    This function uses the credential_types catalog to find credentials, making it robust
    against user input variations (e.g., "OPEN AI CODEXY PRUEBAS" vs "OPENAI_API_KEY").
    
    Args:
        tenant_id: The ID of the tenant.
        internal_key: The internal key of the credential type (e.g., 'OPENAI_API_KEY', 'CHATWOOT_API_TOKEN').
        
    Returns:
        The decrypted credential value, or None if not found.
        
    Example:
        >>> openai_key = await get_tenant_credential_by_type(1, "OPENAI_API_KEY")
        >>> chatwoot_token = await get_tenant_credential_by_type(1, "CHATWOOT_API_TOKEN")
    """
    try:
        query = """
            SELECT c.value 
            FROM credentials c
            JOIN credential_types ct ON c.credential_type_id = ct.id
            WHERE c.tenant_id = $1 
              AND ct.internal_key = $2
              AND c.is_valid = true
            ORDER BY c.created_at DESC
            LIMIT 1
        """
        
        # Ensure DB is connected
        if not db.pool:
            await db.connect()
            
        row = await db.pool.fetchrow(query, tenant_id, internal_key)
        
        if not row:
            # Fallback: Search by name directly if JOIN failed (migration safe v7.6.1)
            fallback_query = "SELECT value FROM credentials WHERE tenant_id = $1 AND name = $2 LIMIT 1"
            row = await db.pool.fetchrow(fallback_query, tenant_id, internal_key)

        if row and row['value']:
            decrypted = decrypt_password(row['value'])
            return decrypted if decrypted else row['value']
            
        return None
    except Exception as e:
        logger.error("credential_fetch_by_type_failed", tenant_id=tenant_id, internal_key=internal_key, error=str(e))
        return None


async def get_tenant_credential(tenant_id: int, category: str, name_pattern: str = None) -> str | None:
    """
    DEPRECATED: Use get_tenant_credential_by_type() instead.
    
    Fetches and decrypts a tenant-specific credential from the database.
    Maintained for backward compatibility during migration to Credential Architecture v2.
    
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
            WHERE tenant_id = $1 AND LOWER(category) = LOWER($2)
        """
        params = [tenant_id, category]
        
        if name_pattern:
            query += " AND name ILIKE $3"
            params.append(name_pattern)
            
        query += " ORDER BY created_at DESC LIMIT 1"
        
        # Ensure DB is connected (ignite in main.py usually handles this, but safe is better)
        if not db.pool:
            await db.connect()
            
        row = await db.pool.fetchrow(query, *params)
        
        if row and row['value']:
            decrypted = decrypt_password(row['value'])
            return decrypted if decrypted else row['value']
            
        return None
    except Exception as e:
        logger.error("credential_fetch_failed", tenant_id=tenant_id, category=category, error=str(e))
        return None
