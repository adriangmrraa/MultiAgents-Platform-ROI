import structlog
from datetime import datetime
from app.core.rag import RAGCore
from app.models.chat import ChatMessage
from app.models.customer import Customer
from db import db

logger = structlog.get_logger(__name__)

class ShadowIndexer:
    """
    Nexus v5.32 - Background Worker for Shadow RAG.
    Passively vectors messages based on Contact Circles.
    """

    @staticmethod
    async def process_message(message_id: str, tenant_id: int):
        """
        Main entry point for background task.
        """
        try:
            # 1. Fetch Message & Customer Context
            # We join with 'customers' via 'chat_conversations' (message -> conversation -> customer)
            # Schema: Message -> Conversation. Conversation -> Customer?
            # Let's check the schema. Message.conversation_id -> Conversation.customer_id -> Customer.
            
            query = """
                SELECT 
                    m.id, m.content, m.role, m.created_at,
                    c.circle, c.first_name, c.last_name,
                    conv.display_name
                FROM chat_messages m
                JOIN chat_conversations conv ON m.conversation_id = conv.id
                LEFT JOIN customers c ON conv.customer_id = c.id
                WHERE m.id = $1 AND m.tenant_id = $2 AND m.is_shadow_indexed = FALSE
            """
            
            row = await db.fetchrow(query, message_id, tenant_id)
            
            if not row:
                logger.warning("shadow_indexer_skip_not_found", message_id=str(message_id))
                return

            circle = row.get("circle", "unknown")
            content = row.get("content")
            role = row.get("role")
            
            if not content or len(content.strip()) < 5:
                # Skip short/empty messages
                return

            # 2. Vectorize
            # Get Tenant Credentials (need RAG Core to handle it, assumes DB Creds or Global)
            # We init RAGCore with just tenant_id. It will try to use global fallback or tenant specific if passed.
            # In a background worker, getting the tenant specific key might require an extra DB lookup if not using Lazy Resolution.
            # RAGCore v5.3 supports Lazy Resolution.
            
            rag = RAGCore(tenant_id=tenant_id)
            
            metadata = {
                "circle": circle,
                "participant_name": row.get("first_name") or row.get("display_name") or "Unknown",
                "role": role,
                "timestamp": row.get("created_at").timestamp()
            }
            
            success = await rag.ingest_chat_message(content, metadata)
            
            if success:
                # 3. Mark as Indexed
                await db.execute(
                    "UPDATE chat_messages SET is_shadow_indexed = TRUE WHERE id = $1", 
                    message_id
                )
                logger.info("shadow_indexer_success", message_id=str(message_id), circle=circle)
            
        except Exception as e:
            logger.error("shadow_indexer_failed", error=str(e), message_id=str(message_id))
