import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base, TimestampMixin


class AttributedSale(Base, TimestampMixin):
    """
    Tracks Tienda Nube orders and their attribution to AI agent conversations.
    Attribution methods: phone_match (1.0), utm_tracking (0.9), email_match (0.5).
    """
    __tablename__ = "attributed_sales"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)

    # Order data from Tienda Nube
    order_id: Mapped[str] = mapped_column(String(64), nullable=False)
    order_number: Mapped[Optional[str]] = mapped_column(String(32))
    order_total: Mapped[Optional[float]] = mapped_column(Float)
    order_currency: Mapped[str] = mapped_column(String(8), server_default="ARS")
    order_status: Mapped[Optional[str]] = mapped_column(String(32))
    payment_status: Mapped[Optional[str]] = mapped_column(String(32))
    order_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Customer data from order
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50))
    customer_email: Mapped[Optional[str]] = mapped_column(String(128))
    customer_name: Mapped[Optional[str]] = mapped_column(String(128))

    # Attribution fields
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    channel_source: Mapped[Optional[str]] = mapped_column(String(32))
    attribution_method: Mapped[Optional[str]] = mapped_column(String(32))
    # phone_match=1.0, utm_tracking=0.9, email_match=0.5
    attribution_confidence: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    attribution_details: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    attributed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint('tenant_id', 'order_id', name='uq_tenant_order'),
    )
