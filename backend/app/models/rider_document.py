"""Partner-submitted verification documents (stored on local disk in dev)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, sa_enum
from app.models.enums import DocumentStatus


class RiderDocument(Base, TimestampMixin):
    __tablename__ = "rider_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    rider_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # e.g. "license", "id_proof", "vehicle_rc", "insurance".
    doc_type: Mapped[str] = mapped_column(String(48), index=True)
    # Path on disk under settings.upload_dir; never exposed directly to clients.
    file_path: Mapped[str] = mapped_column(String(512))
    original_name: Mapped[str] = mapped_column(String(255), default="")
    content_type: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[DocumentStatus] = mapped_column(
        sa_enum(DocumentStatus), default=DocumentStatus.submitted
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
