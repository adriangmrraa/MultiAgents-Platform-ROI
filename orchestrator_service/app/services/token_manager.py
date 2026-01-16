import time
import httpx
import os
from typing import Optional, Dict, Any
import structlog
from app.core.credentials import get_tenant_credential
from db import db

logger = structlog.get_logger()

class TokenManager:
    """
    Sovereign Token Manager.
    Handles the lifecycle of credentials, including expiry checks and auto-refresh using the Auth Broker.
    """
    
    @staticmethod
    async def get_valid_token(tenant_id: int, category: str = "tiendanube") -> Optional[str]:
        """
        Retrieves a valid access token. 
        If expired or near expiry (10 min buffer), it attempts to refresh it.
        """
        try:
            # 1. Fetch Credentials + Metadata
            # Helper to fetch with name (Standardized)
            provider_map = {
                "tiendanube": {
                    "access": "TIENDANUBE_ACCESS_TOKEN",
                    "refresh": "TIENDANUBE_REFRESH_TOKEN",
                    "expiry": "TIENDANUBE_EXPIRES_AT"
                }
            }
            
            keys = provider_map.get(category)
            if not keys:
                # Fallback for simple fetch if not managed
                return await get_tenant_credential(tenant_id, category, f"{category.upper()}_ACCESS_TOKEN")

            # Bulk fetch or individual? get_tenant_credential is easy.
            access_token = await get_tenant_credential(tenant_id, category, keys["access"])
            # If no access token, we can't do anything (unless we support flow from refresh only, but basic flow implies we had one)
            if not access_token:
                return None

            expires_at_str = await get_tenant_credential(tenant_id, category, keys["expiry"])
            
            # 2. Check Expiry
            should_refresh = False
            if expires_at_str:
                try:
                    expires_at = float(expires_at_str)
                    buffer_seconds = 600 # 10 minutes
                    if time.time() > (expires_at - buffer_seconds):
                        should_refresh = True
                        logger.info("token_near_expiry", tenant_id=tenant_id, category=category, expires_at=expires_at)
                except ValueError:
                    logger.warning("invalid_expiry_format", tenant_id=tenant_id, val=expires_at_str)
            
            # If we don't have expiration, we assume it's valid? Or do we try to refresh if we have a refresh token?
            # Strategy: If we have a refresh token and NO expiry, we might stick with current until 401.
            # But here we are PROACTIVE. If we have expiry, we use it. 
            
            if should_refresh:
                refresh_token = await get_tenant_credential(tenant_id, category, keys["refresh"])
                if refresh_token:
                    new_creds = await TokenManager._perform_refresh(tenant_id, category, refresh_token)
                    if new_creds:
                        return new_creds["access_token"]
            
            return access_token

        except Exception as e:
            logger.error("token_manager_check_error", error=str(e), tenant_id=tenant_id)
            return None

    @staticmethod
    async def _perform_refresh(tenant_id: int, category: str, refresh_token: str) -> Optional[Dict[str, Any]]:
        """
        Calls the Auth Broker (tiendanube_service) to refresh the token.
        Updates the Vault with new values.
        """
        try:
            # Resolve Service URL
            # In Docker: http://tiendanube_service:8003
            service_url = os.getenv("TIENDANUBE_SERVICE_URL", "http://tiendanube_service:8003")
            
            # Prepare Request (Assuming standardized tool call format or custom endpoint)
            # We implemented /auth/refresh in tiendanube_service
            url = f"{service_url}/auth/refresh"
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json={"refresh_token": refresh_token})
                
                if resp.status_code != 200:
                    logger.error("refresh_request_failed", status=resp.status_code, body=resp.text)
                    return None
                    
                data = resp.json()
                # Unpack ToolResponse (ok, data) if it uses that envelope, or raw?
                # The code I wrote returns ToolResponse.
                if "data" in data and data.get("ok"):
                    token_info = data["data"]
                elif "access_token" in data: # Fallback if direct
                    token_info = data
                else:
                    return None # Error in ToolResponse
                
                new_access = token_info.get("access_token")
                new_refresh = token_info.get("refresh_token") # Might rotate
                expires_in = token_info.get("expires_in")
                
                if new_access:
                    # UPDATE VAULT
                    # Uses admin_routes logic? No, we need direct DB access or internal call.
                    # Since we are INSIDE orchestrator, use DB.
                    
                    # We need to reuse the UPSERT logic found in admin_routes or extract it.
                    # Ideally, we call a core function. admin_routes.save_credential is an endpoint.
                    
                    # Let's perform secure update directly in DB
                    from utils import encrypt_password
                    
                    async def update_cred(name, value):
                        enc_val = encrypt_password(value)
                        # We use the tenant-scoped upsert logic
                        await db.pool.execute("""
                            INSERT INTO credentials (name, value, category, scope, tenant_id, description, updated_at)
                            VALUES ($1, $2, $3, 'tenant', $4, 'Auto-Refreshed', NOW())
                            ON CONFLICT (scope, name, tenant_id) WHERE scope = 'tenant'
                            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                        """, name, enc_val, category, tenant_id)
                        
                    await update_cred("TIENDANUBE_ACCESS_TOKEN", new_access)
                    
                    if new_refresh:
                        await update_cred("TIENDANUBE_REFRESH_TOKEN", new_refresh)
                        
                    if expires_in:
                        new_expiry = time.time() + int(expires_in)
                        # Expiry is not encrypted usually, but our table encrypts all 'value' column? 
                        # 'credentials.value' is text. Admin routes encrypts sensitive cats. 
                        # TIENDANUBE category is sensitive. So we encrypt it. Consistency is key.
                        await update_cred("TIENDANUBE_EXPIRES_AT", str(new_expiry))
                        
                    logger.info("token_refreshed_success", tenant_id=tenant_id)
                    return {"access_token": new_access}

        except Exception as e:
            logger.error("refresh_execution_error", error=str(e))
            return None
        
        return None
