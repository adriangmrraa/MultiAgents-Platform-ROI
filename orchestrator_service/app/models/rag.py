from typing import Optional
from sqlalchemy import String, Text, Integer, Column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.schema import Index
from sqlalchemy import text

from app.models.base import Base

class Document(Base):
    """
    Maps to the Supabase/pgvector 'documents' table.
    Used for Schema Management and advanced deletions (cleanup).
    """
    __tablename__ = "documents"

    # Standard LangChain/Supabase fields
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    content: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, server_default='{}') # 'metadata' is reserved in SQLAlchemy Base? No, but careful.
    embedding = Column("embedding", String) # Placeholder for vector(1536), we don't query it via ORM often.

    # Nexus v5.48 Extensions
    collection: Mapped[str] = mapped_column(String, default="General", server_default="General", index=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(Integer, index=True) # Optional for global docs
    file_path: Mapped[Optional[str]] = mapped_column(String) # For deletion consistency

    __table_args__ = (
        # Critical Index for Deletion Performance
        Index('idx_documents_tenant_file_path', 'tenant_id', 'file_path'),
    )
