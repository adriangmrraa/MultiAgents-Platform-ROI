import os
import httpx
import structlog
from fastapi import HTTPException
from pydantic import BaseModel

logger = structlog.get_logger()

class MetaAuthService:
    """
    Handles Meta Graph API for OAuth 2.0 Token Exchange and Asset Discovery.
    Version: v19.0
    """
    def __init__(self):
        self.app_id = os.getenv("META_APP_ID")
        self.app_secret = os.getenv("META_APP_SECRET")
        self.api_version = "v19.0"
        self.base_url = f"https://graph.facebook.com/{self.api_version}"

    async def exchange_code(self, code: str, redirect_uri: str) -> str:
        """
        Exchanges an Authorization Code for a User Access Token.
        Required for 'Business Login for Tech Providers' (System User Flow).
        """
        url = f"{self.base_url}/oauth/access_token"
        params = {
            "client_id": self.app_id,
            "client_secret": self.app_secret,
            "redirect_uri": redirect_uri,
            "code": code
        }
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(url, params=params)
                data = resp.json()
                
                if "error" in data:
                    logger.error("meta_code_exchange_failed", error=data["error"])
                    raise HTTPException(status_code=400, detail=data["error"]["message"])
                    
                # Step 1: Get Short-Lived User Token
                short_token = data.get("access_token")

                # Step 2: Exchange for Long-Lived Token (60 days)
                # https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
                exchange_url = f"{self.base_url}/oauth/access_token"
                exchange_params = {
                    "grant_type": "fb_exchange_token",
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "fb_exchange_token": short_token
                }
                
                resp_exchange = await client.get(exchange_url, params=exchange_params)
                exchange_data = resp_exchange.json()
                
                if "access_token" in exchange_data:
                    # Parse Expiration (seconds)
                    expires_in = exchange_data.get("expires_in")
                    
                    logger.info("Sovereign Token Persisted", 
                        valid_for="60 days", 
                        expires_in_seconds=expires_in,
                        token_type="long_lived"
                    )
                    return exchange_data["access_token"]
                
                # Fallback to short token if exchange fails (though unlikely)
                logger.warning("token_exchange_fallback_short")
                return short_token
            except httpx.ConnectError as e:
                logger.error("meta_connection_error", url=url, error=str(e))
                raise HTTPException(status_code=503, detail=f"Could not connect to Meta API at {url}. Check DNS/Network.")

    async def get_accounts(self, access_token: str):
        """
        Fetches Pages, Instagram Business Accounts, and WhatsApp Business Accounts associated with the user/token.
        Also subscribes the App to the Pages' webhooks.
        """
        # 1. Fetch Pages
        url_pages = f"{self.base_url}/me/accounts"
        params = {
            "access_token": access_token,
            "fields": "id,name,access_token,instagram_business_account{id,username},tasks"
        }

        assets = {
            "pages": [],
            "instagram": [],
            "whatsapp": []
        }

        async with httpx.AsyncClient() as client:
            # 1. Get Pages
            try:
                resp = await client.get(url_pages, params=params)
                data = resp.json()
                
                if "error" in data:
                    logger.error("meta_assets_fetch_error", error=data["error"])
                    # Don't crash entirely, but maybe warn? 
                    # Actually, if we can't fetch pages, something is wrong with the token/perms.
                    raise HTTPException(400, f"Meta API Error: {data['error'].get('message')}")

                if "data" in data:
                    for page in data["data"]:
                        # Filter for ADMIN/MODERATE tasks to ensure we can manage
                        tasks = page.get("tasks", [])
                        if "MANAGE" in tasks or "MODERATE" in tasks or "CREATE_CONTENT" in tasks:
                            # Page Asset
                            assets["pages"].append({
                                "id": page["id"],
                                "name": page["name"],
                                "access_token": page["access_token"]
                            })
                            
                            # Note: We NO LONGER auto-subscribe here. 
                            # Orchestrator will call subscribe_page for selected assets.

                            # IG Asset
                            if "instagram_business_account" in page:
                                ig = page["instagram_business_account"]
                                assets["instagram"].append({
                                    "id": ig["id"],
                                    "username": ig.get("username"),
                                    "linked_page_id": page["id"]
                                })
            except httpx.ConnectError as e:
                logger.error("meta_connection_error_pages", url=url_pages, error=str(e))
                raise HTTPException(status_code=503, detail=f"Could not resolve {url_pages}. DNS error?")

            # 2. Get WABA (WhatsApp Business Accounts)
            # This requires 'whatsapp_business_management' permission which is included in the Tech Provider Config
            url_waba = f"{self.base_url}/me/whatsapp_business_accounts"
            params_waba = {
                "access_token": access_token,
                "fields": "id,name,currency,timezone_id,message_template_namespace"
            }
            
            try:
                resp_waba = await client.get(url_waba, params=params_waba)
                data_waba = resp_waba.json()
                
                if "data" in data_waba:
                    for waba in data_waba["data"]:
                        assets["whatsapp"].append({
                            "id": waba["id"],
                            "name": waba["name"],
                            "currency": waba.get("currency"),
                            "timezone_id": waba.get("timezone_id"),
                            "namespace": waba.get("message_template_namespace")
                        })
                        # Note: We likely need to fetch Phone Numbers for this WABA separately
            except httpx.ConnectError as e:
                logger.error("meta_connection_error_waba", url=url_waba, error=str(e))
                # We don't necessarily want to crash the whole thing if only WABA fails, but logging is vital
            except Exception as e:
                logger.warning("waba_fetch_failed", error=str(e))
            
            return assets

    async def subscribe_page(self, client: httpx.AsyncClient, page_id: str, page_token: str):
        """
        Subscribes the App to the Page's `messages` and `messaging_postbacks` events.
        """
        url = f"{self.base_url}/{page_id}/subscribed_apps"
        params = {
            "access_token": page_token,
            "subscribed_fields": "messages,messaging_postbacks,message_reads"
        }
        try:
            resp = await client.post(url, params=params)
            if resp.status_code == 200:
                logger.info("webhook_subscribed", page_id=page_id, success=True)
            else:
                logger.warning("webhook_subscribe_failed", page_id=page_id, status=resp.status_code, error=resp.text)
        except Exception as e:
            logger.error("webhook_subscribe_error", error=str(e))
