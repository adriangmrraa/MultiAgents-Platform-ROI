import uuid
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationship to Tenant (Sovereign Identity)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )

    role: Mapped[str] = mapped_column(String(50), default="owner", nullable=False)

    # Zero Trust Verification
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    verification_token: Mapped[str] = mapped_column(
        String(255), nullable=True, unique=True
    )
    # Expiración del token de verificación de email (48 horas desde emisión)
    verification_token_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    last_verification_email_at: Mapped[datetime] = mapped_column(nullable=True)

    # Password Reset
    password_reset_token: Mapped[str] = mapped_column(
        String(255), nullable=True, unique=True
    )
    password_reset_expires_at: Mapped[datetime] = mapped_column(nullable=True)

    # UX Profile
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(500), nullable=True)

    # 2FA
    two_factor_enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    two_factor_secret: Mapped[str] = mapped_column(String(255), nullable=True)

    # Back relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", backref="users", lazy="joined")
