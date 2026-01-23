from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, UUID, UniqueConstraint, Index, text
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
import uuid
from datetime import datetime
from db import Base

class WhatsAppTemplate(Base):
    __tablename__ = 'whatsapp_templates'
    
    # optimized id with server-side generation
    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    
    meta_id: Mapped[str] = mapped_column(String, nullable=True) # Meta's ID
    name: Mapped[str] = mapped_column(String, nullable=False) # snake_case
    status: Mapped[str] = mapped_column(String, default='PENDING', nullable=False) # APPROVED, REJECTED, PENDING, PAUSED, DISABLED
    category: Mapped[str] = mapped_column(String, nullable=False) # MARKETING, UTILITY, AUTHENTICATION
    language: Mapped[str] = mapped_column(String, default='es_AR')
    
    components: Mapped[dict] = mapped_column(JSONB, server_default='[]') # Header, Body, Footer, Buttons
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Validation / Constraints / Indices
    __table_args__ = (
        UniqueConstraint('tenant_id', 'name', name='uq_whatsapp_template_name'),
        Index('idx_templates_tenant_status', 'tenant_id', 'status'),
    )

    # Relationships
    # tenant = relationship("Tenant", back_populates="templates")
