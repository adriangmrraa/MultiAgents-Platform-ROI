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
            resp = await client.get(url, params=params)
            data = resp.json()
            
            if "error" in data:
                logger.error("meta_code_exchange_failed", error=data["error"])
                raise HTTPException(status_code=400, detail=data["error"]["message"])
                
            return data.get("access_token")

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
            resp = await client.get(url_pages, params=params)
            data = resp.json()
            
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
                        
                        # Subscribe App to Page Webhooks
                        await self._subscribe_page(client, page["id"], page["access_token"])

                        # IG Asset
                        if "instagram_business_account" in page:
                            ig = page["instagram_business_account"]
                            assets["instagram"].append({
                                "id": ig["id"],
                                "username": ig.get("username"),
                                "linked_page_id": page["id"]
                            })

            # 2. Get WABA (This often requires granular permission 'whatsapp_business_management')
            # For simplicity in this MVP, we assume WABA ID is provided manually or via different flow
            # If we had 'whatsapp_business_management', we'd query /me/whatsapp_business_accounts
            
            return assets

    async def _subscribe_page(self, client: httpx.AsyncClient, page_id: str, page_token: str):
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
