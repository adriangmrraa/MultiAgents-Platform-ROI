from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr, field_validator
from typing import Any
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    @field_validator("POSTGRES_DSN", mode="before")
    @classmethod
    def fix_postgres_dialect(cls, v: Any) -> Any:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://") and "asyncpg" not in v:
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Platform AI Solutions"
    
    # Infrastructure
    POSTGRES_DSN: str = "postgresql+asyncpg://postgres:password@postgres:5432/pointcoach"
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Security
    SECRET_KEY: SecretStr = SecretStr("changeme_in_production_please_32chars")
    INTERNAL_API_TOKEN: SecretStr = SecretStr("internal_token_fallback")

settings = Settings()
