from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "PointCoach Orchestrator"
    
    # Infrastructure
    POSTGRES_DSN: str = "postgresql+asyncpg://postgres:password@postgres:5432/pointcoach"
    REDIS_URL: str = "redis://redis:6379/0"
    
    # Security
    SECRET_KEY: SecretStr = SecretStr("changeme_in_production_please_32chars")
    INTERNAL_API_TOKEN: SecretStr = SecretStr("internal_token_fallback")

settings = Settings()
