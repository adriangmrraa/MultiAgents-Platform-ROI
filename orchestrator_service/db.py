import asyncpg
import os
import json
import redis.asyncio as aioredis 
from typing import List, Tuple, Optional

POSTGRES_DSN = os.getenv("POSTGRES_DSN")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# ... (omitted)

# Global instance
db = Database()
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
