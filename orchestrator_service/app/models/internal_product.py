from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, Boolean, Text, Float, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base, TimestampMixin


class InternalProduct(Base, TimestampMixin):
    __tablename__ = "internal_products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(100), default="General")
    sku: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    compare_at_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="ARS")

    stock: Mapped[int] = mapped_column(Integer, default=0)
    track_stock: Mapped[bool] = mapped_column(Boolean, default=True)

    variants: Mapped[dict] = mapped_column(JSONB, server_default='[]')
    images: Mapped[dict] = mapped_column(JSONB, server_default='[]')
    tags: Mapped[dict] = mapped_column(JSONB, server_default='[]')

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    slug: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    public_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
