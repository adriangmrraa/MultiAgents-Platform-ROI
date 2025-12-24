import uuid
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base, TimestampMixin

class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Partition Key must be part of PK for List Partitioning
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), primary_key=True, nullable=False, index=True)
    
    # Validated Identity Fields
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    
    # Platform Scoped IDs (PSIDs)
    instagram_psid: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    facebook_psid: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    
    # Profile Info
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Business Logic
    tags: Mapped[dict] = mapped_column(JSONB, server_default='[]')
    ltv_score: Mapped[Optional[float]] = mapped_column(Integer, default=0)
    
    # Constraints: Unique Phone per Tenant, Unique IG per Tenant, etc.
    __table_args__ = (
        UniqueConstraint('tenant_id', 'phone_number', name='uq_tenant_phone'),
        UniqueConstraint('tenant_id', 'instagram_psid', name='uq_tenant_ig'),
        UniqueConstraint('tenant_id', 'facebook_psid', name='uq_tenant_fb'),
    )
    
    # Relationships (Forward ref string to avoid circle import issues if not careful, but models usually load together)
    # conversations: Mapped[List["ChatConversation"]] = relationship("ChatConversation", back_populates="customer")
