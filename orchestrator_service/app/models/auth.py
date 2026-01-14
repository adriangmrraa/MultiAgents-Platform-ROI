import uuid
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Relationship to Tenant (Sovereign Identity)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    
    role: Mapped[str] = mapped_column(String(50), default="owner", nullable=False)
    
    # Zero Trust Verification
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    # Zero Trust Verification
    is_verified: Mapped[bool] = mapped_column(default=False, nullable=False)
    verification_token: Mapped[str] = mapped_column(String(255), nullable=True, unique=True)

    # UX Profile
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str] = mapped_column(String(500), nullable=True)

    # Back relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", backref="users", lazy="joined")
