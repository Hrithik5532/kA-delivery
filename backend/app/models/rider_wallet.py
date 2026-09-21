"""Rider wallet balances."""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class RiderWallet(Base, TimestampMixin):
    __tablename__ = "rider_wallets"

    id: Mapped[int] = mapped_column(primary_key=True)
    rider_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    total_balance_cents: Mapped[int] = mapped_column(Integer, default=0)
    locked_balance_cents: Mapped[int] = mapped_column(Integer, default=0)
    available_balance_cents: Mapped[int] = mapped_column(Integer, default=0)
