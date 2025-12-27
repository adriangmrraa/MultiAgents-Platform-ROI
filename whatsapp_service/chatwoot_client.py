import httpx
import structlog

logger = structlog.get_logger()

class ChatwootClient:
    def __init__(self, base_url: str, api_token: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "api_access_token": api_token,
            "Content-Type": "application/json"
        }

    async def send_text_message(self, account_id: int, conversation_id: int, text: str):
        """
        Sends an outgoing message to a specific Chatwoot conversation.
        """
        url = f"{self.base_url}/api/v1/accounts/{account_id}/conversations/{conversation_id}/messages"
        payload = {
            "content": text,
            "message_type": "outgoing"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=self.headers, timeout=10.0)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error("chatwoot_send_failed", account_id=account_id, conv_id=conversation_id, error=str(e))
                raise e
