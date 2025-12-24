from typing import List, Optional
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    store_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Identification
    bot_phone_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    
    # Credentials (Tienda Nube)
    tiendanube_store_id: Mapped[Optional[str]] = mapped_column(String(50))
    tiendanube_access_token: Mapped[Optional[str]] = mapped_column(String(255)) # Encrypted? app logic handles it usually, or plain if strict backend
    
    # AI Configuration
    system_prompt_template: Mapped[Optional[str]] = mapped_column(Text)
    store_catalog_knowledge: Mapped[Optional[str]] = mapped_column(Text)
    store_description: Mapped[Optional[str]] = mapped_column(Text)
    
    # OpenAI (Optional per tenant overrides)
    openai_api_key: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Relationships
    handoff_config: Mapped[Optional["TenantHumanHandoffConfig"]] = relationship(
        "TenantHumanHandoffConfig", back_populates="tenant", uselist=False, cascade="all, delete-orphan"
    )
    credentials: Mapped[List["Credentials"]] = relationship(
        "Credentials", back_populates="tenant", cascade="all, delete-orphan"
    )

class TenantHumanHandoffConfig(Base, TimestampMixin):
    __tablename__ = "tenant_human_handoff_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), unique=True, nullable=False)
    
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Logic
    triggers: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    handoff_instructions: Mapped[Optional[str]] = mapped_column(Text)
    handoff_message: Mapped[Optional[str]] = mapped_column(Text)
    
    # Destination
    destination_email: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Email Context Flags (JSON)
    email_context: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    
    # SMTP Configuration (Encrypted storage implied for password)
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255))
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer, default=587)
    smtp_username: Mapped[Optional[str]] = mapped_column(String(255))
    smtp_password_encrypted: Mapped[Optional[str]] = mapped_column(String(512)) # Stored as corrupted/encrypted string
    smtp_security: Mapped[Optional[str]] = mapped_column(String(20), default="STARTTLS")

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="handoff_config")


class Credentials(Base, TimestampMixin):
    """Secure vault for API keys (e.g. OpenAI, Extra Tools)."""
    __tablename__ = "credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tenants.id"), nullable=True) # Global if Null
    
    service_name: Mapped[str] = mapped_column(String(50), index=True) # 'openai', 'anthropic'
    api_key_encrypted: Mapped[str] = mapped_column(String(512)) # Must be encrypted
    scope: Mapped[str] = mapped_column(String(20), default="tenant") # 'tenant' or 'global'
    
    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", back_populates="credentials")
