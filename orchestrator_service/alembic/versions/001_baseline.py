"""Baseline — mark all existing tables as migrated.

Revision ID: 001_baseline
Revises: None
Create Date: 2026-03-26

This is a stamp migration. All tables already exist via SQLAlchemy create_all.
Future migrations will use Alembic for schema changes.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '001_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Stamp only — all tables already exist from SQLAlchemy Base.metadata.create_all()
    # Tables: tenants, users, agents, chat_conversations, chat_messages, chat_media,
    # customers, plans, subscriptions, usage_records, invoices, audit_logs,
    # credentials, rag_documents, inbound_messages, business_assets,
    # voice_widget_configs, voice_usage_records, onboarding_progress,
    # internal_products, attributed_sales, whatsapp_templates
    pass


def downgrade() -> None:
    pass
