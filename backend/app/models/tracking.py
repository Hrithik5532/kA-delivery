"""Rider location history and audit event models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text  # noqa: F401
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class RiderLocation(Base):
    """A single reported rider position.

    Both the device-reported ``client_timestamp`` and the ``server_timestamp``
    (receipt time) are kept so staleness is judged against the server clock and
    never spoofable by the client.
    """

    __tablename__ = "rider_locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    rider_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    heading: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    client_timestamp: Mapped[datetime] = mapped_column(DateTime)
    server_timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)


class AuditEvent(Base, TimestampMixin):
    """Append-only record of server-authoritative state transitions."""

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    delivery_id: Mapped[int | None] = mapped_column(
        ForeignKey("deliveries.id", ondelete="SET NULL"), nullable=True
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(48))
    from_state: Mapped[str | None] = mapped_column(String(24), nullable=True)
    to_state: Mapped[str | None] = mapped_column(String(24), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Generic admin-action fields (additive; null for order/delivery events).
    # e.g. target_type="rider"/"order"/"partner", target_id=<id>, reason=<free text>.
    target_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
