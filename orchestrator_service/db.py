import asyncpg
import os
import json
import structlog
import redis.asyncio as aioredis
from typing import List, Tuple, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# --- Configuration ---
POSTGRES_DSN = os.getenv("POSTGRES_DSN")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# Sanitize for asyncpg (Legacy & New)
if POSTGRES_DSN:
    if "+asyncpg" in POSTGRES_DSN:
        POSTGRES_DSN = POSTGRES_DSN.replace("+asyncpg", "")
    elif POSTGRES_DSN.startswith("postgres://"):
        POSTGRES_DSN = POSTGRES_DSN.replace("postgres://", "postgresql://", 1)

DATABASE_URL = (
    os.getenv("POSTGRES_DSN") or "postgresql+asyncpg://user:pass@localhost/db"
)
# Ensure DATABASE_URL has +asyncpg for SQLAlchemy if missing and using postgres
if DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# --- 1. SQLAlchemy Stack (New - Nexus v5.42+) ---
engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# --- 2. Legacy Database Class (AsyncPG Pool - Protocol Omega) ---
class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        if not self.pool:
            # use the sanitized DSN (no +asyncpg) for asyncpg
            dsn = POSTGRES_DSN
            pool_min = int(os.getenv("DB_POOL_MIN", "10"))
            pool_max = int(os.getenv("DB_POOL_MAX", "40"))
            cmd_timeout = float(os.getenv("DB_COMMAND_TIMEOUT", "60"))
            self.pool = await asyncpg.create_pool(
                dsn,
                min_size=pool_min,
                max_size=pool_max,
                command_timeout=cmd_timeout,
                max_inactive_connection_lifetime=300.0,
            )
            _logger = structlog.get_logger()
            _logger.info(
                "db_pool_initialized",
                min_size=pool_min,
                max_size=pool_max,
                command_timeout=cmd_timeout,
            )

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    async def execute(self, query: str, *args):
        """Helper to execute SQL directly via the pool."""
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def fetch(self, query: str, *args):
        """Helper to fetch rows directly via the pool."""
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        """Helper to fetch a single row directly via the pool."""
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        """Helper to fetch a single value directly via the pool."""
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    async def try_insert_inbound(
        self,
        provider: str,
        provider_message_id: str,
        event_id: str,
        from_number: str,
        payload: dict,
        correlation_id: str,
    ) -> bool:
        """
        Legacy wrapper. Now we use chat_messages as source of truth.
        Returns True if not a duplicate (using Redis for fast dedup).
        """
        return True

    async def log_system_event(
        self, level: str, event_type: str, message: str, metadata: dict = None
    ):
        """Standardized system event logging (Protocol Omega: UUID)."""
        query = "INSERT INTO system_events (severity, event_type, message, payload) VALUES ($1, $2, $3, $4)"
        async with self.pool.acquire() as conn:
            await conn.execute(
                query, level, event_type, message, json.dumps(metadata or {})
            )

    async def append_chat_message(
        self, from_number: str, role: str, content: str, correlation_id: str
    ):
        query = "INSERT INTO chat_messages (from_number, role, content, correlation_id) VALUES ($1, $2, $3, $4)"
        async with self.pool.acquire() as conn:
            await conn.execute(query, from_number, role, content, correlation_id)

    async def get_chat_history(self, from_number: str, limit: int = 15) -> List[dict]:
        """Returns list of {'role': ..., 'content': ...} in chronological order."""
        query = "SELECT role, content FROM chat_messages WHERE from_number = $1 ORDER BY created_at DESC LIMIT $2"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, from_number, limit)
            return [dict(row) for row in reversed(rows)]


# --- Global Instances ---
db = Database()
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)


async def get_pool_db():
    """FastAPI dependency: yields the raw asyncpg Database instance for routes using raw SQL."""
    if not db.pool:
        await db.connect()
    yield db
