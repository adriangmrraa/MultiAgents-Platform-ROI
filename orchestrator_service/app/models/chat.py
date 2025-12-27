import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base, TimestampMixin
from app.schemas.common import ChatStatus, MessageType, MessageRole

class ChatConversation(Base, TimestampMixin):
    __tablename__ = "chat_conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Identity Link (New)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("customers.id"), index=True)
    
    channel: Mapped[str] = mapped_column(String(50), default="whatsapp")
    channel_source: Mapped[str] = mapped_column(String(32), server_default="whatsapp", default="whatsapp")
    
    external_user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # Keep for b/w compat for now
    
    # Chatwoot Integration
    external_chatwoot_id: Mapped[Optional[int]] = mapped_column(Integer)
    external_account_id: Mapped[Optional[int]] = mapped_column(Integer)
    
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    status: Mapped[ChatStatus] = mapped_column(
        SAEnum(ChatStatus, native_enum=False), 
        default=ChatStatus.OPEN,
        server_default=ChatStatus.OPEN.value,
        index=True
    )
    
    # Logic state
    human_override_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_message_preview: Mapped[Optional[str]] = mapped_column(String(255))
    
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="conversation")
    # customer: Mapped[Optional["Customer"]] = relationship("Customer") 

class ChatMedia(Base, TimestampMixin):
    __tablename__ = "chat_media"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    
    channel: Mapped[str] = mapped_column(String(20))
    provider_media_id: Mapped[str] = mapped_column(String(255))
    
    media_type: Mapped[MessageType] = mapped_column(String(20))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    storage_url: Mapped[Optional[str]] = mapped_column(Text)


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_conversations.id"), index=True, nullable=False)
    
    role: Mapped[MessageRole] = mapped_column(String(20), nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text)
    
    message_type: Mapped[MessageType] = mapped_column(String(20), default=MessageType.TEXT)
    media_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("chat_media.id"))
    
    correlation_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    
    # Metadata
    human_override: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_from: Mapped[Optional[str]] = mapped_column(String(50)) 
    
    # Polymorphism (Nexus)
    platform: Mapped[str] = mapped_column(String(50), default='whatsapp', server_default='whatsapp')
    platform_message_id: Mapped[Optional[str]] = mapped_column(String(255))
    platform_metadata: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    content_attributes: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    reply_to_message_id: Mapped[Optional[str]] = mapped_column(String(255))
    
    conversation: Mapped["ChatConversation"] = relationship("ChatConversation", back_populates="messages")
