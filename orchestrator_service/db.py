import asyncpg
import os
import json
from typing import List, Tuple, Optional

POSTGRES_DSN = os.getenv("POSTGRES_DSN")

# Sanitize for asyncpg (must not have +asyncpg)
if POSTGRES_DSN:
    if "+asyncpg" in POSTGRES_DSN:
        POSTGRES_DSN = POSTGRES_DSN.replace("+asyncpg", "")
    elif POSTGRES_DSN.startswith("postgres://"):
        POSTGRES_DSN = POSTGRES_DSN.replace("postgres://", "postgresql://", 1)

class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        if not self.pool:
            self.pool = await asyncpg.create_pool(POSTGRES_DSN)

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    async def try_insert_inbound(self, provider: str, provider_message_id: str, event_id: str, from_number: str, payload: dict, correlation_id: str) -> bool:
        """
        Legacy wrapper. Now we use chat_messages as source of truth.
        Returns True if not a duplicate (using Redis for fast dedup).
        """
        # Dedup is now handled in main.py via Redis, but we keep this for legacy compatibility if needed
        return True

    async def log_system_event(self, level: str, event_type: str, message: str, metadata: dict = None):
        """Standardized system event logging (Protocol Omega: UUID)."""
        # Note: ID is gen_random_uuid in DB, so we don't need to pass it, but if we did:
        # query = "INSERT INTO system_events (id, severity, event_type, message, payload) VALUES ($1, $2, $3, $4, $5)"
        # We'll stick to DB generation for simplicity unless required.
        query = "INSERT INTO system_events (severity, event_type, message, payload) VALUES ($1, $2, $3, $4)"
        async with self.pool.acquire() as conn:
            await conn.execute(query, level, event_type, message, json.dumps(metadata or {}))

    async def append_chat_message(self, from_number: str, role: str, content: str, correlation_id: str):
        query = "INSERT INTO chat_messages (from_number, role, content, correlation_id) VALUES ($1, $2, $3, $4)"
        async with self.pool.acquire() as conn:
            await conn.execute(query, from_number, role, content, correlation_id)



    async def get_chat_history(self, from_number: str, limit: int = 15) -> List[dict]:
        """Returns list of {'role': ..., 'content': ...} in chronological order."""
        query = "SELECT role, content FROM chat_messages WHERE from_number = $1 ORDER BY created_at DESC LIMIT $2"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, from_number, limit)
            return [dict(row) for row in reversed(rows)]

# Global instance
db = Database()
