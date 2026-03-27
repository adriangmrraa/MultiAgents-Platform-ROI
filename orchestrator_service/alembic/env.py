"""Alembic env.py — async migration support for Platform AI Solutions."""
import os
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Load .env
from dotenv import load_dotenv
load_dotenv()

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import ALL models so metadata knows about them
from app.models.base import Base
from app.models.tenant import Tenant
from app.models.chat import ChatConversation, ChatMessage, ChatMedia
from app.models.customer import Customer
from app.models.agent import Agent
from app.models.auth import User
from app.models.billing import Plan, Subscription, UsageRecord, Invoice, AuditLog
from app.models.attributed_sale import AttributedSale
from app.models.voice_widget import VoiceWidgetConfig, VoiceUsageRecord
from app.models.onboarding import OnboardingProgress
from app.models.internal_product import InternalProduct

target_metadata = Base.metadata


def get_url():
    """Get async database URL from environment."""
    url = os.getenv("POSTGRES_DSN", "")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL without connecting)."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    connectable = create_async_engine(get_url(), poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point for online migrations."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
