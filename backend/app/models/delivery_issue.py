"""Partner-reported delivery issues + admin resolution notes."""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, sa_enum
from app.models.enums import DeliveryIssueStatus


class DeliveryIssue(Base, TimestampMixin):
    __tablename__ = "delivery_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    delivery_id: Mapped[int | None] = mapped_column(
        ForeignKey("deliveries.id", ondelete="SET NULL"), nullable=True, index=True
    )
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    rider_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # e.g. "pickup_delay", "customer_unavailable", "wrong_address", "other".
    issue_type: Mapped[str] = mapped_column(String(48), index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[DeliveryIssueStatus] = mapped_column(
        sa_enum(DeliveryIssueStatus), default=DeliveryIssueStatus.open, index=True
    )
    # Internal admin resolution note (not shown to the partner).
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
