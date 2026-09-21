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
    total_docs = len(docs) if docs else 4
    verified_count = len(verified) if verified else (4 if profile.approval_status.value == "approved" else 0)

    if verified_count >= total_docs and total_docs > 0:
        doc_summary = f"All {total_docs} verified • Valid till {profile.documents_valid_until}"
    elif verified_count > 0:
        doc_summary = f"{verified_count}/{total_docs} verified • Valid till {profile.documents_valid_until}"
    else:
        doc_summary = f"Upload documents • Target {profile.documents_valid_until}"

    bank_line = ""
    if profile.bank_name:
        bank_line = f"{profile.bank_name} •• {profile.bank_account_masked}"
        if profile.upi_linked:
            bank_line += " (Instant UPI linked)"

    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": profile.contact_email or user.email,
        "phone": user.phone,
        "partner_code": partner_code,
        "rating": round(float(profile.rating or 5.0), 2),
        "trip_count": earnings.summary.total_deliveries,
        "is_online": profile.is_online,
        "approval_status": profile.approval_status,
        "phone_verified": profile.phone_verified,
        "operating_hub": profile.operating_hub,
        "fleet_tier": profile.fleet_tier,
        "surge_priority_pct": profile.surge_priority_pct,
        "vehicle_type": profile.vehicle_type,
        "vehicle_type_label": _vehicle_label(profile.vehicle_type),
        "vehicle_model": profile.vehicle_model or profile.vehicle_type.title(),
        "vehicle_number": profile.vehicle_number,
        "vehicle_fuel_type": profile.vehicle_fuel_type,
        "vehicle_cargo_type": profile.vehicle_cargo_type,
        "rc_status": profile.rc_status,
        "rc_status_label": _rc_label(profile.rc_status),
        "bank_name": profile.bank_name,
        "bank_account_masked": profile.bank_account_masked,
        "bank_summary": bank_line,
        "upi_linked": profile.upi_linked,
        "app_language": profile.app_language,
        "documents_summary": doc_summary,
        "documents_verified_count": verified_count,
        "documents_total_count": total_docs,
        "documents_valid_until": profile.documents_valid_until,
    }
