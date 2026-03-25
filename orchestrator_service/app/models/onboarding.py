from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base, TimestampMixin


class OnboardingProgress(Base, TimestampMixin):
    __tablename__ = "onboarding_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tenants.id"), nullable=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    step_data: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    system_prompt_draft: Mapped[str] = mapped_column(Text, default='')
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
