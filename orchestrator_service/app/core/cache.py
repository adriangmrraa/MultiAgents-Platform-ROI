import json
import os
from structlog import get_logger
from db import redis_client # Protocol Omega: SSOT for Redis

logger = get_logger()

class TenantAwareCache:
    """
    Secure wrapper for Redis that enforces tenant isolation.
    All keys are automatically prefixed with 'tenant:{id}:'.
    """
    def __init__(self, tenant_id: int):
        self.tenant_id = tenant_id
        self._redis = redis_client
        self._prefix = f"tenant:{tenant_id}:"

    def _key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    async def get(self, key: str):
        try:
            val = await self._redis.get(self._key(key))
            # Try to auto-decode JSON if it looks like it
            if val and isinstance(val, str) and (val.startswith('{') or val.startswith('[')):
                try:
                    return json.loads(val)
                except:
                    return val
            return val
        except Exception as e:
            logger.error("redis_read_error", tenant_id=self.tenant_id, key=key, error=str(e))
            return None

    async def set(self, key: str, value, ttl: int = 300):
        try:
            secure_key = self._key(key)
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            await self._redis.setex(secure_key, ttl, value)
        except Exception as e:
            logger.error("redis_write_error", tenant_id=self.tenant_id, key=key, error=str(e))

    async def delete(self, key: str):
        try:
            await self._redis.delete(self._key(key))
        except Exception as e:
             logger.error("redis_delete_error", tenant_id=self.tenant_id, key=key, error=str(e))

    async def flush_tenant_data(self):
        """Dangerous: Deletes ALL data for this tenant."""
        try:
            keys = await self._redis.keys(f"{self._prefix}*")
            if keys:
                await self._redis.delete(*keys)
        except Exception as e:
            logger.error("redis_flush_error", tenant_id=self.tenant_id, error=str(e))
