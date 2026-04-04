"""add_verification_token_expires_at

Revision ID: 002_add_verification_token_expires_at
Revises: 001_baseline
Create Date: 2026-04-03

Agrega columna verification_token_expires_at a la tabla users para implementar
expiración de 48 horas en los tokens de verificación de email (PROD-13).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "002_add_verification_token_expires_at"
down_revision: Union[str, None] = "001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agrega la columna de expiración del token de verificación
    op.add_column(
        "users",
        sa.Column("verification_token_expires_at", sa.DateTime(), nullable=True),
    )

    # Período de gracia para usuarios no verificados existentes: 7 días desde ahora
    op.execute(
        """
        UPDATE users
        SET verification_token_expires_at = NOW() + INTERVAL '7 days'
        WHERE is_verified = FALSE
          AND verification_token IS NOT NULL
          AND verification_token_expires_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("users", "verification_token_expires_at")
