"""Rider working shift slots.

Ops define daily slots (e.g. Lunch 11:00-14:00, Dinner 19:00-22:00). A rider
selects the slots they will work; the selection recurs every day. While a
selected slot is running the rider is online; outside it they are offline.
Times are wall-clock ``HH:MM`` in ``settings.business_timezone``. A slot whose
end is earlier than its start runs past midnight.
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class ShiftSlot(Base, TimestampMixin):
    __tablename__ = "shift_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    start_time: Mapped[str] = mapped_column(String(5))  # "HH:MM"
    end_time: Mapped[str] = mapped_column(String(5))  # "HH:MM"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    # Optional cap on riders who may select this slot (None = unlimited).
    max_riders: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class RiderShiftSlot(Base, TimestampMixin):
    """A rider's (recurring daily) selection of a slot."""

    __tablename__ = "rider_shift_slots"
    __table_args__ = (UniqueConstraint("rider_id", "slot_id", name="uq_rider_shift_slot"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    rider_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    slot_id: Mapped[int] = mapped_column(
        ForeignKey("shift_slots.id", ondelete="CASCADE"), index=True
    )
