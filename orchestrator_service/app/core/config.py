from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr, field_validator, field_serializer, model_validator
from typing import Any, List, Optional
from dotenv import load_dotenv
import os
import logging

load_dotenv()

# --- Secret Validation Helper ---

REQUIRED_PRODUCTION_SECRETS = [
    "SECRET_KEY",
    "INTERNAL_API_TOKEN",
    "ENCRYPTION_KEY",
    "POSTGRES_DSN",
    "REDIS_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "MP_ACCESS_TOKEN",
    "MP_WEBHOOK_SECRET",
    "ADMIN_TOKEN",
    "OPENAI_API_KEY",
    "SUPABASE_SERVICE_KEY",
]


def is_production() -> bool:
    """Determine if we're running in a production environment."""
    env = os.getenv("ENVIRONMENT", "").lower()
    return env == "production" or os.getenv("PRODUCTION", "").lower() == "true"


def require_secret(env_var: str, default: str | None = None) -> str:
    """
    Retrieve the value of an environment variable.
    Raises ValueError if the variable is empty and we're in production
    and the variable is in REQUIRED_PRODUCTION_SECRETS.
    """
    value = os.getenv(env_var, default)
    if not value and is_production() and env_var in REQUIRED_PRODUCTION_SECRETS:
        raise ValueError(f"{env_var} must be set in production!")
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )

    @field_validator("POSTGRES_DSN", mode="before")
    @classmethod
    def fix_postgres_dialect(cls, v: Any) -> Any:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://") and "asyncpg" not in v:
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_list(cls, v: Any) -> Any:
        if isinstance(v, str):
            # Resilience: Handle empty string or generic wildcard
            if not v.strip():
                return []

            # If it looks like a JSON list, try to parse it
            if v.strip().startswith("[") and v.strip().endswith("]"):
                try:
                    import json

                    loaded = json.loads(v)
                    if isinstance(loaded, list):
                        return loaded
                except Exception as e:
                    logging.getLogger(__name__).warning("cors_json_parse_failed: %s", e)
                    # Fallback to comma splitting if JSON fails
                    pass

            # Split by comma and strip whitespace
            return [item.strip() for item in v.split(",") if item.strip()]

        # Guard clause: If it's not a list or string, default to empty list to prevent crash
        if not isinstance(v, list):
            return []

        return v

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def validate_secret_key(cls, v: SecretStr) -> SecretStr:
        """Ensure SECRET_KEY is set to a non-empty secure value in production."""
        secret = v.get_secret_value()
        if is_production() and (
            not secret
            or secret == "changeme_in_production_please_32chars"
            or len(secret) < 32
        ):
            raise ValueError(
                "SECRET_KEY must be set to a secure random string of at least 32 characters in production. "
                "Please set the SECRET_KEY environment variable."
            )
        return v

    @field_validator("ENCRYPTION_KEY", mode="after")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        """Ensure ENCRYPTION_KEY is set in production."""
        if is_production() and not v:
            raise ValueError(
                "ENCRYPTION_KEY must be set in production for credential encryption. "
                "Please set the ENCRYPTION_KEY environment variable."
            )
        return v

    @field_validator("INTERNAL_API_TOKEN", mode="after")
    @classmethod
    def validate_internal_api_token(cls, v: SecretStr) -> SecretStr:
        """Ensure INTERNAL_API_TOKEN is set in production."""
        if is_production() and not v.get_secret_value():
            raise ValueError(
                "INTERNAL_API_TOKEN must be set in production for inter-service authentication. "
                "Please set the INTERNAL_API_TOKEN environment variable."
            )
        return v

    @field_validator(
        "POSTGRES_DSN", "REDIS_URL", "SUPABASE_URL", "SUPABASE_DB_URL", mode="after"
    )
    @classmethod
    def validate_infrastructure_secrets(cls, v: str, info) -> str:
        """Ensure infrastructure URLs are not default in production."""
        default_values = {
            "POSTGRES_DSN": "",
            "REDIS_URL": "redis://redis:6379/0",
            "SUPABASE_URL": "",
            "SUPABASE_DB_URL": "postgresql://postgres:postgres@supabase-db:5432/postgres",
        }
        field_name = info.field_name
        if is_production() and v == default_values.get(field_name):
            raise ValueError(
                f"{field_name} must be set to a production database in production. "
                f"Please set the {field_name} environment variable."
            )
        return v

    @field_validator("LOG_LEVEL", mode="after")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Ensure LOG_LEVEL is a valid logging level."""
        valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in valid:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(valid)}, got {v}")
        return upper

    @model_validator(mode="after")
    def validate_required_secrets(self):
        """Ensure all required production secrets are set when in production."""
        if not is_production():
            return self

        for secret_name in REQUIRED_PRODUCTION_SECRETS:
            value = getattr(self, secret_name, None)
            if isinstance(value, SecretStr):
                value = value.get_secret_value()
            if not value:
                raise ValueError(
                    f"{secret_name} must be set in production. "
                    f"Please set the {secret_name} environment variable."
                )
        return self

    API_V1_STR: str = "/api/v1"
    API_V2_STR: str = "/api/v2"
    PROJECT_NAME: str = "Platform AI Solutions"

    # Logging
    LOG_LEVEL: str = "INFO"

    # Infrastructure
    POSTGRES_DSN: str = ""
    REDIS_URL: str = "redis://redis:6379/0"

    # Database connection pool
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    CORS_ALLOWED_ORIGINS: Any = []
    BOT_PHONE_NUMBER: str | None = None

    # Google OAuth
    GOOGLE_OAUTH_CLIENT_ID: str | None = None

    # Security & AI
    OPENAI_API_KEY: str | None = None
    GOOGLE_API_KEY: str | None = None
    SECRET_KEY: SecretStr = SecretStr("")
    INTERNAL_API_TOKEN: SecretStr = SecretStr("")
    ENCRYPTION_KEY: str = ""
    LEGACY_TOKEN_SUPPORT: bool = True  # Permitir tokens tv:1 durante migración

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # MercadoPago
    MP_ACCESS_TOKEN: Optional[str] = None
    MP_WEBHOOK_SECRET: Optional[str] = None

    # Supabase (RAG)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str | None = None
    SUPABASE_DB_URL: str = "postgresql://postgres:postgres@supabase-db:5432/postgres"


settings = Settings()

# Configure logging based on LOG_LEVEL
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
