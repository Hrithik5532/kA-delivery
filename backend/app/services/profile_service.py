"""Rider partner profile aggregation for the mobile profile screen."""
from __future__ import annotations

from app.models.enums import DocumentStatus
from app.models.user import User
from app.services import document_service, earnings_service
from sqlalchemy.orm import Session

_VEHICLE_LABELS = {
    "bike": "Two Wheeler",
    "scooter": "Two Wheeler",
    "car": "Four Wheeler",
    "van": "Van",
}

_RC_LABELS = {
    "active": "RC Active",
    "expired": "RC Expired",
    "pending": "RC Pending",
}


def _vehicle_label(vehicle_type: str) -> str:
    return _VEHICLE_LABELS.get(vehicle_type.lower(), vehicle_type.replace("_", " ").title())


def _rc_label(rc_status: str) -> str:
    return _RC_LABELS.get(rc_status.lower(), rc_status.replace("_", " ").title())


def ensure_partner_code(profile) -> str:
    if profile.partner_code:
        return profile.partner_code
    code = f"DM-PARTNER-{profile.user_id:04d}"
    profile.partner_code = code
    return code


def build_profile(db: Session, user: User) -> dict:
    profile = user.rider_profile
    if profile is None:
        raise ValueError("Not a rider")

    partner_code = ensure_partner_code(profile)
    earnings = earnings_service.summary_for_rider(db, user.id)
    docs = document_service.list_for_rider(db, user.id)
    verified = [d for d in docs if d.status == DocumentStatus.accepted]
    total_docs = max(len(docs), 4)  # 4 required document types
    verified_count = len(verified)

    # Several profile columns are nullable in the DB (unset for freshly
    # registered riders), but RiderProfileDetailOut requires non-null strings.
    # Coalesce to safe defaults so the endpoint never 500s on a sparse profile.
    vehicle_type = profile.vehicle_type or "bike"
    valid_until = profile.documents_valid_until or "—"

    if verified_count >= total_docs and total_docs > 0:
        doc_summary = f"All {total_docs} verified • Valid till {valid_until}"
    elif verified_count > 0:
        doc_summary = f"{verified_count}/{total_docs} verified • Valid till {valid_until}"
    else:
        doc_summary = f"Upload documents • Target {valid_until}"

    bank_line = ""
    if profile.bank_name:
        bank_line = f"{profile.bank_name} •• {profile.bank_account_masked}"
        if profile.upi_id:
            bank_line += f" · UPI {profile.upi_id}"

    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": profile.contact_email or user.email,
        "phone": user.phone,
        "partner_code": partner_code,
        "rating": round(float(profile.rating), 2) if profile.rating is not None else None,
        "trip_count": earnings.summary.total_deliveries,
        "is_online": profile.is_online,
        "approval_status": profile.approval_status,
        "phone_verified": profile.phone_verified,
        "operating_hub": profile.operating_hub or "—",
        "fleet_tier": profile.fleet_tier or "standard",
        "surge_priority_pct": profile.surge_priority_pct or 0,
        "vehicle_type": vehicle_type,
        "vehicle_type_label": _vehicle_label(vehicle_type),
        "vehicle_model": profile.vehicle_model or vehicle_type.title(),
        "vehicle_number": profile.vehicle_number or "—",
        "vehicle_fuel_type": profile.vehicle_fuel_type or "—",
        "vehicle_cargo_type": profile.vehicle_cargo_type or "—",
        "rc_status": profile.rc_status or "pending",
        "rc_status_label": _rc_label(profile.rc_status or "pending"),
        "bank_name": profile.bank_name or "",
        "bank_account_masked": profile.bank_account_masked or "",
        "bank_summary": bank_line,
        "upi_linked": bool(profile.upi_linked),
        "app_language": profile.app_language or "en",
        "documents_summary": doc_summary,
        "documents_verified_count": verified_count,
        "documents_total_count": total_docs,
        "documents_valid_until": valid_until,
    }
