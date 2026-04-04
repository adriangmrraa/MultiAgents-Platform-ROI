import re
from datetime import datetime, timedelta
from typing import Optional
import structlog

logger = structlog.get_logger()

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


class AccountSecurity:
    def __init__(self, redis):
        self.redis = redis

    async def check_login_attempts(self, email: str) -> bool:
        """Check if account is locked due to too many failed attempts."""
        key = f"failed_login:{email.lower()}"
        attempts = await self.redis.get(key)
        return attempts and int(attempts) >= MAX_LOGIN_ATTEMPTS

    async def record_failed_login(self, email: str):
        """Record a failed login attempt with exponential backoff."""
        key = f"failed_login:{email.lower()}"
        attempts = await self.redis.incr(key)

        if attempts == 1:
            await self.redis.expire(key, LOCKOUT_DURATION_MINUTES * 60)
        elif attempts >= MAX_LOGIN_ATTEMPTS:
            # Extend lockout with exponential backoff
            backoff_factor = 2 ** (attempts - MAX_LOGIN_ATTEMPTS)
            new_duration = LOCKOUT_DURATION_MINUTES * 60 * backoff_factor
            await self.redis.expire(key, new_duration)
            logger.warning(
                "account_locked_exponential_backoff",
                email=email,
                attempts=attempts,
                duration_minutes=new_duration / 60,
            )
        else:
            # Still within limit, ensure TTL is set
            await self.redis.expire(key, LOCKOUT_DURATION_MINUTES * 60)

    async def reset_failed_logins(self, email: str):
        """Reset failed login counter on successful login."""
        key = f"failed_login:{email.lower()}"
        await self.redis.delete(key)
        logger.info("failed_logins_reset", email=email)

    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, str]:
        """Validate password meets security requirements."""
        if len(password) < 8:
            return False, "Password must be at least 8 characters"
        if not re.search(r"[A-Z]", password):
            return False, "Password must contain at least one uppercase letter"
        if not re.search(r"[a-z]", password):
            return False, "Password must contain at least one lowercase letter"
        if not re.search(r"[0-9]", password):
            return False, "Password must contain at least one number"
        # Optional: special character requirement
        # if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        #     return False, "Password must contain at least one special character"
        return True, "Password is valid"

    async def get_lockout_remaining(self, email: str) -> Optional[int]:
        """Get remaining lockout time in seconds, or None if not locked."""
        key = f"failed_login:{email.lower()}"
        ttl = await self.redis.ttl(key)
        if ttl > 0:
            attempts = await self.redis.get(key)
            if attempts and int(attempts) >= MAX_LOGIN_ATTEMPTS:
                return ttl
        return None
