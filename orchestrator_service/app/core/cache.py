import json
import redis
import os
from structlog import get_logger

logger = get_logger()

# Raw client - NEVER use this directly in business logic
# Only for init or non-tenant ops (like health checks)
_raw_redis_client = None

def get_redis_client():
    global _raw_redis_client
    if _raw_redis_client is None:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
        _raw_redis_client = redis.from_url(redis_url, decode_responses=True)
    return _raw_redis_client

class TenantAwareCache:
    """
    Secure wrapper for Redis that enforces tenant isolation.
    All keys are automatically prefixed with 'tenant:{id}:'.
    """
    def __init__(self, tenant_id: int):
        self.tenant_id = tenant_id
        self._redis = get_redis_client()
        self._prefix = f"tenant:{tenant_id}:"

    def _key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    def get(self, key: str):
        try:
            val = self._redis.get(self._key(key))
            # Try to auto-decode JSON if it looks like it
            if val and (val.startswith('{') or val.startswith('[')):
                try:
                    return json.loads(val)
                except:
                    return val
            return val
        except Exception as e:
            logger.error("redis_read_error", tenant_id=self.tenant_id, key=key, error=str(e))
            return None

    def set(self, key: str, value, ttl: int = 300):
        try:
            secure_key = self._key(key)
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            self._redis.setex(secure_key, ttl, value)
        except Exception as e:
            logger.error("redis_write_error", tenant_id=self.tenant_id, key=key, error=str(e))

    def delete(self, key: str):
        try:
            self._redis.delete(self._key(key))
        except Exception as e:
             logger.error("redis_delete_error", tenant_id=self.tenant_id, key=key, error=str(e))

    def flush_tenant_data(self):
        """Dangerous: Deletes ALL data for this tenant."""
        try:
            keys = self._redis.keys(f"{self._prefix}*")
            if keys:
                self._redis.delete(*keys)
        except Exception as e:
            logger.error("redis_flush_error", tenant_id=self.tenant_id, error=str(e))
