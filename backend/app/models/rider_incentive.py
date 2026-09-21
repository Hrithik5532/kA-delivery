"""Rider incentive quests and bonuses."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class RiderIncentive(Base, TimestampMixin):
    __tablename__ = "rider_incentives"

    id: Mapped[int] = mapped_column(primary_key=True)
    rider_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    incentive_type: Mapped[str] = mapped_column(String(48))
    title: Mapped[str] = mapped_column(String(128))
    subtitle: Mapped[str] = mapped_column(String(255), default="")
    target_value: Mapped[int] = mapped_column(Integer, default=0)
    current_value: Mapped[int] = mapped_column(Integer, default=0)
    bonus_cents: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="active")
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
