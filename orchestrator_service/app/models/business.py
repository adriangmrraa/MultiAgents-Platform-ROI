from sqlalchemy import Column, String, Boolean, JSON, TIMESTAMP
from sqlalchemy.sql import func
from app.models.base import Base
import uuid

class BusinessAsset(Base):
    __tablename__ = "business_assets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, nullable=False, index=True)
    asset_type = Column(String, nullable=False) # 'branding', 'script', 'image', 'roi_report'
    content = Column(JSON, nullable=False) # Structured content
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
