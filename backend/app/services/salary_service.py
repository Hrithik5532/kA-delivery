"""Monthly salary invoices: generate (draft) -> approve -> mark paid.

Partners are paid a fixed monthly salary set by ops; per-delivery earnings are
not paid out. Each month ops generate an invoice per partner, may add
additions/deductions with notes, approve it (the partner can then see it in
the app) and mark it paid with the bank/UPI reference.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.delivery import Delivery
from app.models.enums import ApprovalStatus, DeliveryStatus, UserRole
from app.models.salary import SalaryInvoice
from app.models.user import RiderProfile, User
from app.services import audit_service, shift_service

_PERIOD_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def current_period() -> str:
    return shift_service.local_now().strftime("%Y-%m")


def validate_period(period: str) -> str:
    if not _PERIOD_RE.match(period or ""):
        raise HTTPException(status_code=422, detail="Month must look like 2026-11")
    return period


def period_bounds_utc(period: str) -> tuple[datetime, datetime]:
    """Naive-UTC [start, end) of a business-local calendar month."""
    y, m = (int(x) for x in period.split("-"))
    tz = shift_service.tz()
    start = datetime(y, m, 1, tzinfo=tz)
    end = datetime(y + (m == 12), (m % 12) + 1, 1, tzinfo=tz)
    to_utc = lambda d: d.astimezone(timezone.utc).replace(tzinfo=None)  # noqa: E731
    return to_utc(start), to_utc(end)


def month_activity(db: Session, rider_id: int, period: str) -> tuple[int, int]:
    """(delivered stops, distinct local days with a delivery) in the month."""
    start, end = period_bounds_utc(period)
    times = db.execute(
        select(Delivery.delivered_at).where(
            Delivery.rider_id == rider_id,
            Delivery.status == DeliveryStatus.delivered,
            Delivery.delivered_at >= start,
            Delivery.delivered_at < end,
        )
    ).scalars().all()
    tz = shift_service.tz()
    days = {t.replace(tzinfo=timezone.utc).astimezone(tz).date() for t in times if t}
    return len(times), len(days)


def _recompute(inv: SalaryInvoice) -> None:
    inv.net_cents = max(0, inv.base_salary_cents + inv.additions_cents - inv.deductions_cents)


def _invoice_number(db: Session, rider: User, period: str) -> str:
    code = (rider.rider_profile.partner_code if rider.rider_profile else None) or f"P{rider.id}"
    return f"SAL-{period.replace('-', '')}-{code}"


def _partner(db: Session, rider_id: int) -> User:
    user = db.get(User, rider_id)
    if user is None or user.rider_profile is None:
        raise HTTPException(status_code=404, detail="Partner not found")
    return user


def create_invoice(db: Session, rider_id: int, period: str, admin_id: int) -> SalaryInvoice:
    validate_period(period)
    rider = _partner(db, rider_id)
    salary = rider.rider_profile.monthly_salary_cents
    if not salary:
        raise HTTPException(status_code=409, detail=f"Set {rider.full_name}'s monthly salary first")
    exists = db.execute(
        select(SalaryInvoice).where(
            SalaryInvoice.rider_id == rider_id, SalaryInvoice.period == period
        )
    ).scalar_one_or_none()
    if exists is not None:
        raise HTTPException(status_code=409, detail="An invoice for this month already exists")
    deliveries, days = month_activity(db, rider_id, period)
    inv = SalaryInvoice(
        rider_id=rider_id,
        period=period,
        invoice_number=_invoice_number(db, rider, period),
        base_salary_cents=salary,
        additions_cents=0,
        deductions_cents=0,
        deliveries_count=deliveries,
        days_active=days,
        status="draft",
        notes="",
        created_by_user_id=admin_id,
    )
    _recompute(inv)
    db.add(inv)
    db.flush()
    audit_service.record(
        db, actor_user_id=admin_id, action="salary_invoice_created",
        target_type="salary_invoice", target_id=inv.id, detail=f"{inv.invoice_number}",
    )
    return inv


def generate_for_period(db: Session, period: str, admin_id: int) -> dict:
    """Draft invoices for every approved, active partner with a salary set."""
    validate_period(period)
    profiles = db.execute(
        select(RiderProfile).where(RiderProfile.approval_status == ApprovalStatus.approved)
    ).scalars().all()
    created: list[SalaryInvoice] = []
    skipped: list[dict] = []
    have = set(
        db.execute(select(SalaryInvoice.rider_id).where(SalaryInvoice.period == period)).scalars()
    )
    for p in profiles:
        user = db.get(User, p.user_id)
        if user is None or not user.has_role(UserRole.rider):
            continue
        name = user.full_name
        if p.user_id in have:
            skipped.append({"rider_id": p.user_id, "name": name, "reason": "Invoice already exists"})
        elif not p.monthly_salary_cents:
            skipped.append({"rider_id": p.user_id, "name": name, "reason": "Monthly salary not set"})
        elif not user.is_active:
            skipped.append({"rider_id": p.user_id, "name": name, "reason": "Partner is suspended"})
        else:
            created.append(create_invoice(db, p.user_id, period, admin_id))
    return {"created": created, "skipped": skipped}


def _get(db: Session, invoice_id: int, lock: bool = False) -> SalaryInvoice:
    inv = db.get(SalaryInvoice, invoice_id, with_for_update=lock)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


def update_draft(db: Session, invoice_id: int, admin_id: int, data: dict) -> SalaryInvoice:
    inv = _get(db, invoice_id, lock=True)
    if inv.status != "draft":
        raise HTTPException(status_code=409, detail="Only draft invoices can be edited")
    for key in ("base_salary_cents", "additions_cents", "deductions_cents"):
        if data.get(key) is not None:
            setattr(inv, key, int(data[key]))
    if data.get("notes") is not None:
        inv.notes = data["notes"].strip()
    if data.get("refresh_activity"):
        inv.deliveries_count, inv.days_active = month_activity(db, inv.rider_id, inv.period)
    _recompute(inv)
    audit_service.record(
        db, actor_user_id=admin_id, action="salary_invoice_updated",
        target_type="salary_invoice", target_id=inv.id,
        detail=f"base={inv.base_salary_cents} add={inv.additions_cents} ded={inv.deductions_cents}",
    )
    return inv


def approve(db: Session, invoice_id: int, admin_id: int) -> SalaryInvoice:
    inv = _get(db, invoice_id, lock=True)
    if inv.status != "draft":
        raise HTTPException(status_code=409, detail="Only draft invoices can be approved")
    inv.status = "approved"
    inv.approved_by_user_id = admin_id
    inv.approved_at = utcnow()
    audit_service.record(
        db, actor_user_id=admin_id, action="salary_invoice_approved",
        target_type="salary_invoice", target_id=inv.id, detail=inv.invoice_number,
    )
    from app.services import notification_service

    notification_service.notify(
        inv.rider_id, "Salary invoice ready",
        f"Your salary invoice for {inv.period} is approved.",
        {"type": "salary_invoice", "invoice_id": inv.id},
    )
    return inv


def mark_paid(db: Session, invoice_id: int, admin_id: int, reference: str) -> SalaryInvoice:
    inv = _get(db, invoice_id, lock=True)
    if inv.status != "approved":
        raise HTTPException(status_code=409, detail="Approve the invoice before marking it paid")
    inv.status = "paid"
    inv.paid_at = utcnow()
    inv.payment_reference = reference.strip()
    audit_service.record(
        db, actor_user_id=admin_id, action="salary_invoice_paid",
        target_type="salary_invoice", target_id=inv.id, detail=f"ref={inv.payment_reference}",
    )
    from app.services import notification_service

    notification_service.notify(
        inv.rider_id, "Salary paid",
        f"Your salary for {inv.period} has been paid.",
        {"type": "salary_invoice", "invoice_id": inv.id},
    )
    return inv


def cancel(db: Session, invoice_id: int, admin_id: int, reason: str) -> SalaryInvoice:
    inv = _get(db, invoice_id, lock=True)
    if inv.status not in ("draft", "approved"):
        raise HTTPException(status_code=409, detail="Paid or cancelled invoices cannot be cancelled")
    inv.status = "cancelled"
    inv.cancelled_reason = reason.strip()
    audit_service.record(
        db, actor_user_id=admin_id, action="salary_invoice_cancelled",
        target_type="salary_invoice", target_id=inv.id, reason=inv.cancelled_reason,
    )
    return inv


def delete_cancelled(db: Session, invoice_id: int, admin_id: int) -> None:
    """Remove a cancelled invoice so the month can be regenerated."""
    inv = _get(db, invoice_id, lock=True)
    if inv.status != "cancelled":
        raise HTTPException(status_code=409, detail="Only cancelled invoices can be deleted")
    audit_service.record(
        db, actor_user_id=admin_id, action="salary_invoice_deleted",
        target_type="salary_invoice", target_id=inv.id, detail=inv.invoice_number,
    )
    db.delete(inv)


def invoice_out(db: Session, inv: SalaryInvoice) -> dict:
    rider = db.get(User, inv.rider_id)
    prof = rider.rider_profile if rider else None
    approver = db.get(User, inv.approved_by_user_id) if inv.approved_by_user_id else None
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "rider_id": inv.rider_id,
        "rider_name": rider.full_name if rider else "",
        "rider_phone": rider.phone if rider else None,
        "partner_code": prof.partner_code if prof else None,
        "bank_name": prof.bank_name if prof else "",
        "bank_account_masked": prof.bank_account_masked if prof else "",
        "ifsc_code": prof.ifsc_code if prof else "",
        "upi_id": prof.upi_id if prof else None,
        "period": inv.period,
        "period_label": datetime.strptime(inv.period, "%Y-%m").strftime("%B %Y"),
        "base_salary_cents": inv.base_salary_cents,
        "additions_cents": inv.additions_cents,
        "deductions_cents": inv.deductions_cents,
        "net_cents": inv.net_cents,
        "deliveries_count": inv.deliveries_count,
        "days_active": inv.days_active,
        "status": inv.status,
        "notes": inv.notes,
        "payment_reference": inv.payment_reference,
        "approved_by": approver.full_name if approver else None,
        "approved_at": inv.approved_at,
        "paid_at": inv.paid_at,
        "cancelled_reason": inv.cancelled_reason,
        "created_at": inv.created_at,
    }


def rider_summary(db: Session, rider: User) -> dict:
    period = current_period()
    deliveries, days = month_activity(db, rider.id, period)
    invoices = db.execute(
        select(SalaryInvoice)
        .where(
            SalaryInvoice.rider_id == rider.id,
            SalaryInvoice.status.in_(("approved", "paid")),
        )
        .order_by(SalaryInvoice.period.desc())
    ).scalars().all()
    paid_total = sum(i.net_cents for i in invoices if i.status == "paid")
    return {
        "monthly_salary_cents": rider.rider_profile.monthly_salary_cents if rider.rider_profile else None,
        "current_period": period,
        "current_period_label": datetime.strptime(period, "%Y-%m").strftime("%B %Y"),
        "current_month_deliveries": deliveries,
        "current_month_days_active": days,
        "total_paid_cents": paid_total,
        "invoices": [invoice_out(db, i) for i in invoices],
    }


def rider_invoice(db: Session, rider: User, invoice_id: int) -> dict:
    inv = db.get(SalaryInvoice, invoice_id)
    if inv is None or inv.rider_id != rider.id or inv.status not in ("approved", "paid"):
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice_out(db, inv)


def list_invoices(db: Session, period: str | None, status: str | None) -> list[dict]:
    stmt = select(SalaryInvoice)
    if period:
        stmt = stmt.where(SalaryInvoice.period == validate_period(period))
    if status:
        stmt = stmt.where(SalaryInvoice.status == status)
    rows = db.execute(stmt.order_by(SalaryInvoice.period.desc(), SalaryInvoice.id)).scalars().all()
    return [invoice_out(db, i) for i in rows]


def totals(db: Session, period: str) -> dict:
    rows = db.execute(
        select(SalaryInvoice.status, func.count(SalaryInvoice.id), func.sum(SalaryInvoice.net_cents))
        .where(SalaryInvoice.period == period)
        .group_by(SalaryInvoice.status)
    ).all()
    return {s: {"count": c, "net_cents": int(n or 0)} for s, c, n in rows}



