import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Integer,
    Float,
    ForeignKey,
    DateTime,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base, TimestampMixin


class Plan(Base, TimestampMixin):
    """SaaS subscription plans (Free, Pro, Enterprise)."""

    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )  # free, pro, enterprise
    display_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "Free", "Pro", "Enterprise"
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Pricing
    price_usd: Mapped[float] = mapped_column(Float, default=0.0)  # Monthly price in USD
    price_ars: Mapped[float] = mapped_column(Float, default=0.0)  # Monthly price in ARS
    price_usd_yearly: Mapped[float] = mapped_column(Float, default=0.0)
    price_ars_yearly: Mapped[float] = mapped_column(Float, default=0.0)
    billing_period: Mapped[str] = mapped_column(
        String(20), default="monthly"
    )  # monthly, yearly

    # Stripe
    stripe_price_id: Mapped[Optional[str]] = mapped_column(String(255))
    stripe_price_id_yearly: Mapped[Optional[str]] = mapped_column(String(255))
    stripe_product_id: Mapped[Optional[str]] = mapped_column(String(255))

    # MercadoPago
    mp_plan_id: Mapped[Optional[str]] = mapped_column(String(255))
    mp_plan_id_yearly: Mapped[Optional[str]] = mapped_column(String(255))

    # Limits
    max_agents: Mapped[int] = mapped_column(Integer, default=1)
    max_messages_per_month: Mapped[int] = mapped_column(Integer, default=100)
    max_knowledge_docs: Mapped[int] = mapped_column(Integer, default=10)
    max_channels: Mapped[int] = mapped_column(Integer, default=1)
    max_team_members: Mapped[int] = mapped_column(Integer, default=1)
    max_tokens_per_month: Mapped[int] = mapped_column(
        Integer, default=50000
    )  # LLM tokens

    # Feature flags
    features: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    # e.g. {"analytics": true, "custom_branding": false, "api_access": true, "priority_support": false}

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    subscriptions: Mapped[List["Subscription"]] = relationship(
        "Subscription", back_populates="plan"
    )


class Subscription(Base, TimestampMixin):
    """Active subscription linking a tenant to a plan."""

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id"), nullable=False)

    # Status
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False)
    # active, trialing, past_due, canceled, suspended

    # Dates
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    current_period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    canceled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Payment provider
    payment_provider: Mapped[Optional[str]] = mapped_column(
        String(30)
    )  # stripe, mercadopago
    external_subscription_id: Mapped[Optional[str]] = mapped_column(
        String(255)
    )  # Stripe sub_xxx / MP preapproval_xxx
    external_customer_id: Mapped[Optional[str]] = mapped_column(
        String(255)
    )  # Stripe cus_xxx / MP customer

    # Relationships
    plan: Mapped["Plan"] = relationship("Plan", back_populates="subscriptions")
    tenant: Mapped["Tenant"] = relationship(
        "Tenant", backref="subscription", uselist=False
    )

    __table_args__ = (UniqueConstraint("tenant_id", name="uq_subscription_tenant"),)


class UsageRecord(Base):
    """Track resource usage per tenant per period."""

    __tablename__ = "usage_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )

    # Period
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Counters
    messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    messages_received: Mapped[int] = mapped_column(Integer, default=0)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    api_calls: Mapped[int] = mapped_column(Integer, default=0)

    # Costs (in USD)
    llm_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)

    # Metadata
    breakdown: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    # e.g. {"openai_tokens": 42000, "anthropic_tokens": 8000, "gpt4_calls": 15}

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "period_start", name="uq_usage_tenant_period"),
    )


class Invoice(Base, TimestampMixin):
    """Billing invoices for tenants."""

    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("subscriptions.id")
    )

    # Amounts
    amount_usd: Mapped[float] = mapped_column(Float, default=0.0)
    amount_local: Mapped[float] = mapped_column(Float, default=0.0)  # ARS/BRL
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Status
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending, paid, failed, refunded, void

    # Payment
    payment_provider: Mapped[Optional[str]] = mapped_column(String(30))
    external_invoice_id: Mapped[Optional[str]] = mapped_column(String(255))
    external_payment_id: Mapped[Optional[str]] = mapped_column(String(255))

    # Period
    period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Line items detail
    line_items: Mapped[dict] = mapped_column(JSONB, server_default="[]")
    # e.g. [{"description": "Pro Plan - March 2026", "amount": 49.0}]


class AuditLog(Base):
    """Track all admin/user actions for compliance."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)

    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # e.g. "tenant.suspend", "plan.change", "user.login", "subscription.cancel"

    resource_type: Mapped[Optional[str]] = mapped_column(String(50))
    resource_id: Mapped[Optional[str]] = mapped_column(String(255))

    details: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
