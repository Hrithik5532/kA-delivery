"""Monthly salary invoices for delivery partners (salaried, not per-delivery)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin

# draft -> approved -> paid ; draft/approved -> cancelled
SALARY_STATUSES = ("draft", "approved", "paid", "cancelled")


class SalaryInvoice(Base, TimestampMixin):
    __tablename__ = "salary_invoices"
    __table_args__ = (UniqueConstraint("rider_id", "period", name="uq_salary_rider_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    rider_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)  # "YYYY-MM"
    invoice_number: Mapped[str] = mapped_column(String(40), unique=True)
    base_salary_cents: Mapped[int] = mapped_column(Integer, default=0)
    additions_cents: Mapped[int] = mapped_column(Integer, default=0)
    deductions_cents: Mapped[int] = mapped_column(Integer, default=0)
    net_cents: Mapped[int] = mapped_column(Integer, default=0)
    deliveries_count: Mapped[int] = mapped_column(Integer, default=0)
    days_active: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    notes: Mapped[str] = mapped_column(String(1000), default="")
    payment_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
