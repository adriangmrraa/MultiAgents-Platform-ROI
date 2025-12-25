import uuid
from typing import Optional, Dict, Any
from sqlalchemy import String, Integer, ForeignKey, Boolean, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base, TimestampMixin

class Agent(Base, TimestampMixin):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="sales")
    whatsapp_number: Mapped[str] = mapped_column(String(20), nullable=True) # Changed to nullable as per guide if undefined
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Brain Configuration
    model_provider: Mapped[str] = mapped_column(String(50), default="openai")
    model_version: Mapped[str] = mapped_column(String(50), default="gpt-4o") # Acts as model_name
    temperature: Mapped[float] = mapped_column(Float, default=0.3)
    system_prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Tools Configuration (List of enabled tool names)
    enabled_tools: Mapped[dict] = mapped_column(JSONB, server_default='[]')
    
    # Advanced Config
    config: Mapped[dict] = mapped_column(JSONB, server_default='{}')

    # Relationships
    # tenant = relationship("Tenant") # Defined in Tenant model usually

class AgentTool(Base, TimestampMixin):
    __tablename__ = "tools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True) # Null = Global Tool
    
    name: Mapped[str] = mapped_column(String(100), nullable=False) # Not unique globally if scoped? enforcing unique name for simplicity now.
    type: Mapped[str] = mapped_column(String(50), nullable=False) # 'http', 'function', 'integration'
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    config: Mapped[dict] = mapped_column(JSONB, default={}) # Payload definition, headers, etc.
    service_url: Mapped[str] = mapped_column(String(255), nullable=True) # For http tools
