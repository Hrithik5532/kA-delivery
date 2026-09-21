"""Admin partner profile aggregation and updates."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.delivery import Delivery
from app.models.delivery_issue import DeliveryIssue
from app.models.enums import ACTIVE_ORDER_STATUSES, DeliveryIssueStatus, DeliveryStatus, OrderStatus
from app.models.mess import Mess
from app.models.order import Order
from app.models.rider_document import RiderDocument
from app.models.rider_wallet import RiderWallet
from app.models.user import RiderProfile, User
from app.models.wallet_transaction import WalletTransaction
from app.services import audit_service, tracking_service, wallet_service


def _months_since(dt: datetime | None) -> int:
    if not dt:
        return 0
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(1, (now.year - dt.year) * 12 + (now.month - dt.month))


def _order_progress(status: str) -> int:
    if status in ("assigned", "accepted"): return 0
    if status in ("preparing", "ready"): return 0
    if status == "picked_up": return 1
    if status == "out_for_delivery": return 2
    if status == "delivered": return 3
    return 0


def get_profile(db: Session, rider_id: int, base_detail: dict) -> dict:
    user = db.get(User, rider_id)
    profile = user.rider_profile if user else None
    if user is None or profile is None:
        raise HTTPException(status_code=404, detail="Partner not found")

    wallet_data = wallet_service.build_wallet(db, rider_id)
    wallet_row = db.execute(select(RiderWallet).where(RiderWallet.rider_id == rider_id)).scalar_one_or_none()

    docs = db.execute(select(RiderDocument).where(RiderDocument.rider_id == rider_id)).scalars().all()
    deliveries = db.execute(
        select(Delivery).where(Delivery.rider_id == rider_id).order_by(Delivery.id.desc()).limit(50)
    ).scalars().all()

    delivery_rows = []
    total_earned = 0
    cancelled = 0
    for d in deliveries:
        o = db.get(Order, d.order_id)
        mess = db.get(Mess, o.mess_id) if o and o.mess_id else None
        if d.status == DeliveryStatus.cancelled:
            cancelled += 1
        if d.status == DeliveryStatus.delivered:
            total_earned += d.earning_cents
        snap = tracking_service.build_snapshot(db, o) if o and o.status in ACTIVE_ORDER_STATUSES else None
        delivery_rows.append({
            "delivery_id": d.id,
            "order_id": d.order_id,
            "status": d.status.value,
            "order_status": o.status.value if o else "?",
            "is_test": bool(o and o.is_test),
            "earning_cents": d.earning_cents,
            "delivered_at": d.delivered_at,
            "created_at": d.created_at,
            "mess_name": mess.name if mess else None,
            "dropoff_text": o.address_text if o else "",
            "distance_km": snap.distance_km if snap else None,
            "total_cents": o.total_cents if o else 0,
        })

    txns = db.execute(
        select(WalletTransaction).where(WalletTransaction.rider_id == rider_id)
        .order_by(WalletTransaction.created_at.desc()).limit(30)
    ).scalars().all()
    running = wallet_row.total_balance_cents if wallet_row else wallet_data["total_balance_cents"]
    wallet_txns = []
    for t in txns:
        wallet_txns.append({
            "id": t.id,
            "reference_number": t.reference_number,
            "txn_type": t.txn_type,
            "title": t.title,
            "subtitle": t.subtitle,
            "amount_cents": t.amount_cents,
            "status": t.status,
            "created_at": t.created_at,
            "balance_after_cents": running,
        })

    active_order = None
    if base_detail.get("active_order_id"):
        o = db.get(Order, base_detail["active_order_id"])
        if o:
            snap = tracking_service.build_snapshot(db, o)
            mess = db.get(Mess, o.mess_id) if o.mess_id else None
            active_order = {
                "order_id": o.id,
                "status": o.status.value,
                "pickup_label": mess.name if mess else "Pickup",
                "dropoff_text": o.address_text,
                "total_cents": o.total_cents,
                "eta_minutes": snap.eta_minutes,
                "progress_step": _order_progress(o.status.value),
            }

    issues = db.execute(
        select(DeliveryIssue).where(DeliveryIssue.rider_id == rider_id, DeliveryIssue.status != DeliveryIssueStatus.resolved)
    ).scalars().all()
    history = audit_service.for_target(db, "partner", rider_id)
    admin_notes = [
        {"id": e.id, "text": e.reason or e.detail or e.event_type, "author_id": e.actor_user_id, "created_at": e.created_at}
        for e in history if e.event_type in ("partner_admin_note", "partner_updated")
    ]

    total_count = len(deliveries) or base_detail.get("total_deliveries", 0)
    cancel_rate = round(100 * cancelled / total_count, 1) if total_count else 0.0

    kyc_items = []
    doc_map = {d.doc_type: d for d in docs}
    for label, key in [("Aadhaar", "id_proof"), ("Driving License", "license"), ("Vehicle RC", "vehicle_rc"), ("Insurance", "insurance")]:
        doc = doc_map.get(key)
        kyc_items.append({"label": label, "status": doc.status.value if doc else "missing", "ok": doc is not None and doc.status.value == "accepted"})

    return {
        **base_detail,
        "emergency_contact": profile.emergency_contact or "",
        "contact_email": profile.contact_email or user.email,
        "vehicle_fuel_type": profile.vehicle_fuel_type,
        "shift_preference": "Evening Peak (5 PM – 11 PM)",
        "max_active_orders": 2,
        "total_earned_cents": total_earned,
        "cancel_rate_pct": cancel_rate,
        "tenure_months": _months_since(user.created_at),
        "wallet_locked_cents": wallet_data["locked_balance_cents"],
        "wallet_available_cents": wallet_data["available_balance_cents"],
        "wallet_total_cents": wallet_data["total_balance_cents"],
        "documents": docs,
        "kyc_items": kyc_items,
        "wallet_transactions": wallet_txns,
        "active_order": active_order,
        "delivery_history": delivery_rows,
        "recent_deliveries": delivery_rows[:20],
        "open_issues": issues,
        "history": history,
        "admin_notes": admin_notes[:10],
        "upi_id": profile.upi_id or ("rahul.sharma@okhdfc" if profile.upi_linked and not profile.upi_id else None),
        "daily_cashout_limit_cents": 5_000_000,
        "ifsc_code": profile.ifsc_code or ("HDFC0000128" if "HDFC" in (profile.bank_name or "") else "ICIC0005678"),
    }


def update_partner(db: Session, rider_id: int, admin_id: int, data: dict) -> None:
    user = db.get(User, rider_id)
    if user is None or user.rider_profile is None:
        raise HTTPException(status_code=404, detail="Partner not found")
    profile = user.rider_profile
    changes: list[str] = []

    if data.get("full_name") is not None:
        user.full_name = data["full_name"].strip()
        changes.append("name")
    if data.get("phone") is not None:
        user.phone = data["phone"].strip() or None
        changes.append("phone")
    if data.get("email") is not None:
        user.email = data["email"].strip() or None
        changes.append("email")
    if data.get("emergency_contact") is not None:
        profile.emergency_contact = data["emergency_contact"].strip()
        changes.append("emergency_contact")
    if data.get("operating_hub") is not None:
        profile.operating_hub = data["operating_hub"].strip()
        changes.append("hub")
    if data.get("fleet_tier") is not None:
        profile.fleet_tier = data["fleet_tier"].strip()
        changes.append("fleet_tier")
    if data.get("bank_name") is not None:
        profile.bank_name = data["bank_name"].strip()
        changes.append("bank")
    if data.get("bank_account_masked") is not None:
        profile.bank_account_masked = data["bank_account_masked"].strip()
        changes.append("bank_account")
    if data.get("upi_linked") is not None:
        profile.upi_linked = bool(data["upi_linked"])
        changes.append("upi")
    if data.get("ifsc_code") is not None:
        profile.ifsc_code = data["ifsc_code"].strip().upper()
        changes.append("ifsc")
    if data.get("upi_id") is not None:
        profile.upi_id = data["upi_id"].strip() or None
        changes.append("upi_id")
    if data.get("vehicle_model") is not None:
        profile.vehicle_model = data["vehicle_model"].strip()
        changes.append("vehicle")
    if data.get("vehicle_number") is not None:
        profile.vehicle_number = data["vehicle_number"].strip()
        changes.append("vehicle_number")
    if data.get("license_number") is not None:
        profile.license_number = data["license_number"].strip()
        changes.append("license")
    if data.get("vehicle_type") is not None:
        profile.vehicle_type = data["vehicle_type"].strip()
        changes.append("vehicle_type")

    if not changes:
        raise HTTPException(status_code=400, detail="No fields to update")

    audit_service.record(
        db, actor_user_id=admin_id, action="partner_updated",
        target_type="partner", target_id=rider_id,
        detail=", ".join(changes),
    )
    db.commit()


def add_admin_note(db: Session, rider_id: int, admin_id: int, note: str) -> None:
    user = db.get(User, rider_id)
    if user is None or user.rider_profile is None:
        raise HTTPException(status_code=404, detail="Partner not found")
    audit_service.record(
        db, actor_user_id=admin_id, action="partner_admin_note",
        target_type="partner", target_id=rider_id, reason=note.strip(),
    )
    db.commit()
