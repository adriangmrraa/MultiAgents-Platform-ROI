import hmac
import hashlib
import json
import structlog
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException

logger = structlog.get_logger()

class MetaWebhookService:
    """
    Validates and Normalizes Meta Webhook Events.
    Supports: Messenger, Instagram Direct, WhatsApp Cloud API.
    """
    def __init__(self, verify_token: str, app_secret: str):
        self.verify_token = verify_token
        self.app_secret = app_secret

    def verify_challenge(self, mode: str, token: str, challenge: str) -> int:
        """
        Handles the GET /webhook verification challenge.
        """
        if mode == "subscribe" and token == self.verify_token:
            return int(challenge)
        raise HTTPException(status_code=403, detail="Verification failed")

    async def verify_signature(self, request: Request):
        """
        Validates X-Hub-Signature-256 header.
        """
        signature = request.headers.get("X-Hub-Signature-256")
        if not signature:
            # For development, allow bypass if App Secret is not set
            if not self.app_secret:
                return
            raise HTTPException(status_code=403, detail="Missing signature")

        body = await request.body()
        expected = hmac.new(
            self.app_secret.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(f"sha256={expected}", signature):
            raise HTTPException(status_code=403, detail="Invalid signature")

    def normalize_payload(self, body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Main routing logic to parse the incoming webhook object.
        Returns a normalized 'SimpleEvent' dict or None if ignored.
        """
        object_type = body.get("object")
        entry = body.get("entry", [])
        
        if not entry:
            return None

        # Determine Platform based on Object
        platform = "unknown"
        if object_type == "page":
            platform = "facebook" # Covers Messenger & IG (sometimes)
        elif object_type == "instagram":
            platform = "instagram"
        elif object_type == "whatsapp_business_account":
            platform = "whatsapp"

        # Extract first relevant change
        # Meta sends batched entries, but typically 1 relevant message per hook for real-time bots
        change = entry[0]
        
        if platform == "whatsapp":
            return self._normalize_whatsapp(change)
        elif platform == "facebook":
            # Messenger
            messaging = change.get("messaging", [])
            if messaging:
                return self._normalize_messenger(messaging[0], "facebook")
            # Instagram via Page
            # Sometimes IG events come under 'page' object if linked
            return None
        elif platform == "instagram":
            messaging = change.get("messaging", [])
            if messaging:
                return self._normalize_messenger(messaging[0], "instagram")

        return None

    def _normalize_whatsapp(self, change: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Normalizes WhatsApp Cloud API Payload.
        """
        value = change.get("changes", [{}])[0].get("value", {})
        messages = value.get("messages", [])
        
        if not messages:
            # Check for Status updates (sent, delivered, read) - Ignored for now
            return None

        msg = messages[0]
        contact = value.get("contacts", [{}])[0]
        metadata = value.get("metadata", {})

        simple_event = {
            "provider": "meta",
            "platform": "whatsapp",
            "tenant_identifier": metadata.get("display_phone_number"), # Key for multitenancy
            "event_type": "message",
            "timestamp": msg.get("timestamp"),
            "recipient_id": metadata.get("display_phone_number") or metadata.get("phone_number_id"), 
            "sender": {
                "id": msg.get("from"),
                "name": contact.get("profile", {}).get("name")
            },
            "payload": {
                "id": msg.get("id"),
                "type": msg.get("type"),
                "text": msg.get("text", {}).get("body") if msg.get("type") == "text" else None,
                "media_url": None # Setup logic for media retrieval later
            }
        }
        return simple_event

    def _normalize_messenger(self, messaging: Dict[str, Any], platform: str) -> Optional[Dict[str, Any]]:
        """
        Normalizes Messenger / Instagram Direct Payload.
        """
        sender_id = messaging.get("sender", {}).get("id")
        recipient_id = messaging.get("recipient", {}).get("id")
        timestamp = messaging.get("timestamp")
        
        message = messaging.get("message", {})
        if not message:
             # Pass on postbacks, reads, etc.
             return None

        simple_event = {
            "provider": "meta",
            "platform": platform,
            "tenant_identifier": recipient_id, # Page ID / IG ID
            "event_type": "message",
            "timestamp": timestamp,
            "recipient_id": recipient_id,
            "sender": {
                "id": sender_id,
                "name": "User" # Name not provided in webhook, requires separate fetch
            },
            "payload": {
                "id": message.get("mid"),
                "type": "text" if message.get("text") else "image", # Simplified
                "text": message.get("text"),
                "media_url": message.get("attachments", [{}])[0].get("payload", {}).get("url") if message.get("attachments") else None
            }
        }
        return simple_event
