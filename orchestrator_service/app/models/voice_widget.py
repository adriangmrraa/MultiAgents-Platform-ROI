from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, Boolean, Text, Float
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import ARRAY

from app.models.base import Base, TimestampMixin


class VoiceWidgetConfig(Base, TimestampMixin):
    __tablename__ = "voice_widget_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)

    # Widget Appearance
    widget_name: Mapped[str] = mapped_column(String(100), default="Asistente de Voz")
    brand_color: Mapped[str] = mapped_column(String(7), default="#8B5CF6")
    button_size: Mapped[str] = mapped_column(String(10), default="md")
    button_position: Mapped[str] = mapped_column(String(20), default="bottom-right")
    button_icon: Mapped[str] = mapped_column(String(20), default="phone")
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    welcome_message: Mapped[str] = mapped_column(Text, default="¡Hola! Toca para hablar conmigo.")

    # Voice Configuration
    voice_provider: Mapped[str] = mapped_column(String(50), default="openai")
    voice_model: Mapped[str] = mapped_column(String(100), default="alloy")
    stt_provider: Mapped[str] = mapped_column(String(50), default="openai")
    stt_model: Mapped[str] = mapped_column(String(100), default="whisper-1")
    language: Mapped[str] = mapped_column(String(10), default="es")

    # Pipeline Mode
    voice_pipeline: Mapped[str] = mapped_column(String(20), default="realtime")
    realtime_provider: Mapped[str] = mapped_column(String(50), default="openai")

    # Agent Behavior Override
    system_prompt_override: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    temperature_override: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_call_duration: Mapped[int] = mapped_column(Integer, default=300)

    # Billing Mode
    api_key_mode: Mapped[str] = mapped_column(String(10), default="platform")

    # Embed Config
    widget_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class VoiceUsageRecord(Base, TimestampMixin):
    __tablename__ = "voice_usage_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    widget_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("voice_widget_configs.id"), nullable=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    api_key_mode: Mapped[str] = mapped_column(String(10), default="platform")
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    visitor_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    abuse_detected: Mapped[bool] = mapped_column(Boolean, default=False)
