import os
import httpx
import structlog
from fastapi import HTTPException
from pydantic import BaseModel

logger = structlog.get_logger()

class MetaAuthService:
    """
    Handles Meta Graph API for OAuth 2.0 Token Exchange and Asset Discovery.
    ClinicForge-grade token management: code → short-lived → long-lived → page tokens.
    """
    def __init__(self):
        self.app_id = os.getenv("META_APP_ID")
        self.app_secret = os.getenv("META_APP_SECRET")
        self.api_version = os.getenv("META_GRAPH_API_VERSION", "v22.0")
        self.base_url = f"https://graph.facebook.com/{self.api_version}"

    async def exchange_code(self, code: str, redirect_uri: str) -> str:
        """
        Exchanges an Authorization Code for a Long-Lived User Access Token (60 days).
        Tries redirect_uri with and without trailing slash (Meta is strict about exact match).
        Flow: code → short-lived token → long-lived token (fb_exchange_token)
        """
        # For FB.login() via JS SDK, Meta internally uses a special redirect_uri.
        # We try multiple known variants in priority order.
        from urllib.parse import urlparse
        parsed = urlparse(redirect_uri)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        uris_to_try = [
            # 1. The standard SDK redirect (what FB.login popup uses internally)
            "https://www.facebook.com/connect/login_success.html",
            # 2. Exact as received from frontend
            redirect_uri,
            # 3. With/without trailing slash
            redirect_uri.rstrip("/") if redirect_uri.endswith("/") else redirect_uri + "/",
            # 4. Origin only
            origin,
            origin + "/",
        ]
        # Deduplicate while preserving order
        uris_to_try = list(dict.fromkeys(uris_to_try))

        url = f"{self.base_url}/oauth/access_token"
        last_error = None

        async with httpx.AsyncClient(timeout=15.0) as client:
            for uri in uris_to_try:
                # Step 1: Code → Short-Lived Token
                resp = await client.get(url, params={
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "redirect_uri": uri,
                    "code": code
                })
                data = resp.json()

                if "error" in data:
                    last_error = data["error"]
                    logger.warning("code_exchange_attempt_failed", uri=uri, error=data["error"].get("message", ""))
                    continue  # Try next URI variant

                short_token = data.get("access_token")
                if not short_token:
                    last_error = {"message": "No access_token in response"}
                    continue

                logger.info("short_token_obtained", uri=uri)

                # Step 2: Short-Lived → Long-Lived Token (60 days)
                resp_exchange = await client.get(url, params={
                    "grant_type": "fb_exchange_token",
                    "client_id": self.app_id,
                    "client_secret": self.app_secret,
                    "fb_exchange_token": short_token
                })
                exchange_data = resp_exchange.json()

                if "access_token" in exchange_data:
                    expires_in = exchange_data.get("expires_in")
                    logger.info("long_lived_token_obtained",
                        expires_in_seconds=expires_in,
                        valid_days=round(expires_in / 86400) if expires_in else "unknown"
                    )
                    return exchange_data["access_token"]

                # Long-lived exchange failed — still return short token as fallback
                logger.warning("long_lived_exchange_failed", response=exchange_data)
                return short_token

        # All URI variants failed
        error_msg = last_error.get("message", "Unknown error") if last_error else "Code exchange failed"
        logger.error("all_code_exchange_attempts_failed", error=error_msg, uris_tried=uris_to_try)
        raise HTTPException(status_code=400, detail=f"Meta token exchange failed: {error_msg}")

    async def check_token_health(self, access_token: str) -> dict:
        """
        Validates the token and returns its metadata (expiry, scopes).
        Uses /debug_token endpoint.
        """
        url = f"{self.base_url}/debug_token"
        params = {
            "input_token": access_token,
            "access_token": f"{self.app_id}|{self.app_secret}" # App Access Token required for debug
        }
        
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(url, params=params)
                data = resp.json()
                
                if "data" in data:
                    return data["data"]
                
                if "error" in data:
                    logger.warning("token_health_check_failed", error=data["error"])
                    return {"is_valid": False, "error": data["error"]}
                    
                return {"is_valid": False, "reason": "unknown_response"}
                
            except Exception as e:
                logger.error("token_health_check_error", error=str(e))
                return {"is_valid": False, "error": str(e)}

    async def get_accounts(self, access_token: str):
        """
        Fetches Pages, Instagram Business Accounts, and WhatsApp Business Accounts.
        - Auto-subscribes pages to webhooks for messaging
        - Fetches WhatsApp phone numbers for each WABA
        - Page tokens from /me/accounts are already long-lived when user token is long-lived
        """
        assets = {
            "pages": [],
            "instagram": [],
            "whatsapp": []
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            # ==================== 1. PAGES + INSTAGRAM ====================
            try:
                resp = await client.get(f"{self.base_url}/me/accounts", params={
                    "access_token": access_token,
                    "fields": "id,name,access_token,instagram_business_account{id,username,profile_picture_url},tasks"
                })
                data = resp.json()

                if "error" in data:
                    logger.error("meta_pages_error", error=data["error"])
                    raise HTTPException(400, f"Meta API Error: {data['error'].get('message')}")

                for page in data.get("data", []):
                    tasks = page.get("tasks", [])
                    if not any(t in tasks for t in ["MANAGE", "MODERATE", "CREATE_CONTENT"]):
                        continue

                    page_token = page["access_token"]

                    # Auto-subscribe page to webhooks (messages, reads, postbacks)
                    try:
                        await self.subscribe_page(client, page["id"], page_token)
                    except Exception as sub_err:
                        logger.warning("page_auto_subscribe_failed", page_id=page["id"], error=str(sub_err))

                    assets["pages"].append({
                        "id": page["id"],
                        "name": page["name"],
                        "access_token": page_token  # Long-lived (derived from long-lived user token)
                    })

                    # Instagram Business Account linked to this page
                    if "instagram_business_account" in page:
                        ig = page["instagram_business_account"]
                        assets["instagram"].append({
                            "id": ig["id"],
                            "username": ig.get("username"),
                            "profile_picture_url": ig.get("profile_picture_url"),
                            "linked_page_id": page["id"],
                            "access_token": page_token  # IG uses the page token
                        })

            except httpx.ConnectError as e:
                logger.error("meta_connection_error_pages", error=str(e))
                raise HTTPException(503, "Could not connect to Meta API")

            # ==================== 2. WHATSAPP BUSINESS ACCOUNTS ====================
            try:
                resp_waba = await client.get(f"{self.base_url}/me/whatsapp_business_accounts", params={
                    "access_token": access_token,
                    "fields": "id,name,currency,timezone_id,message_template_namespace"
                })
                data_waba = resp_waba.json()

                for waba in data_waba.get("data", []):
                    waba_id = waba["id"]

                    # Fetch phone numbers for this WABA
                    phone_numbers = []
                    try:
                        resp_phones = await client.get(f"{self.base_url}/{waba_id}/phone_numbers", params={
                            "access_token": access_token,
                            "fields": "id,display_phone_number,verified_name,quality_rating,code_verification_status"
                        })
                        phones_data = resp_phones.json()
                        for phone in phones_data.get("data", []):
                            phone_numbers.append({
                                "id": phone["id"],  # This is the phone_number_id needed for sending
                                "display_phone_number": phone.get("display_phone_number"),
                                "verified_name": phone.get("verified_name"),
                                "quality_rating": phone.get("quality_rating"),
                                "status": phone.get("code_verification_status")
                            })
                    except Exception as ph_err:
                        logger.warning("waba_phone_fetch_failed", waba_id=waba_id, error=str(ph_err))

                    assets["whatsapp"].append({
                        "id": waba_id,
                        "name": waba["name"],
                        "currency": waba.get("currency"),
                        "timezone_id": waba.get("timezone_id"),
                        "namespace": waba.get("message_template_namespace"),
                        "phone_numbers": phone_numbers,
                        "access_token": access_token  # WABA uses the user token
                    })

            except Exception as e:
                logger.warning("waba_fetch_failed", error=str(e))

            logger.info("assets_discovered",
                pages=len(assets["pages"]),
                instagram=len(assets["instagram"]),
                whatsapp=len(assets["whatsapp"])
            )
            return assets

    async def subscribe_page(self, client: httpx.AsyncClient, page_id: str, page_token: str):
        """
        Subscribes the App to the Page's webhook events.
        Includes messaging fields for both Facebook Messenger AND Instagram Direct.
        """
        url = f"{self.base_url}/{page_id}/subscribed_apps"
        params = {
            "access_token": page_token,
            "subscribed_fields": "messages,messaging_postbacks,message_reads,message_deliveries"
        }
        try:
            resp = await client.post(url, params=params)
            data = resp.json()
            if resp.status_code == 200 and data.get("success"):
                logger.info("webhook_subscribed", page_id=page_id)
            else:
                logger.warning("webhook_subscribe_failed", page_id=page_id, status=resp.status_code, response=data)
        except Exception as e:
            logger.error("webhook_subscribe_error", page_id=page_id, error=str(e))
