from sqlalchemy import String, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import datetime
import uuid

from app.models.base import Base

# Note: Partitioning usually requires valid primary keys that include the partition key.
# We will use a Composite Primary Key (id, created_at).

class SystemEvent(Base):
    __tablename__ = "system_events"
    # We don't define __table_args__ for partitioning in pure ORM easily for 'create_all', 
    # usually needs manual DDL for partitions. We define the schema here for query support.
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level: Mapped[str] = mapped_column(String(20), index=True) # info, error, warning
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    message: Mapped[str] = mapped_column(Text)
    metadata: Mapped[dict] = mapped_column(JSONB, server_default='{}')
    created_at: Mapped[datetime.datetime] = mapped_column(primary_key=True, server_default=func.now())
    
    # We skip standard TimestampMixin because we need created_at in PK for partitioning
