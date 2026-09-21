"""Partner (rider) verification workflow.

State machine for ``RiderProfile.approval_status``:

    draft ─┐
           ├─▶ submitted ─▶ under_review ─▶ approved
    needs_correction ─┘                  ├─▶ rejected
    rejected ─▶ submitted (resubmit)     └─▶ needs_correction ─▶ submitted

Approval is **backend enforced**: only ``approved`` partners pass
``require_approved_rider`` and may go online / accept deliveries. Every admin
decision is recorded as an ``AuditEvent`` (actor + reason).
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enums import ApprovalStatus
from app.models.user import RiderProfile, User
from app.services import audit_service

# States an admin may act on.
_ADMIN_ACTIONABLE = {
    ApprovalStatus.submitted,
    ApprovalStatus.under_review,
    ApprovalStatus.pending,  # legacy rows
}
# States a partner may (re)submit from.
_RESUBMITTABLE = {
    ApprovalStatus.draft,
    ApprovalStatus.needs_correction,
    ApprovalStatus.rejected,
    ApprovalStatus.pending,
}


def _profile(db: Session, rider_id: int) -> RiderProfile:
    rider = db.get(User, rider_id)
    if rider is None or rider.rider_profile is None:
        raise HTTPException(status_code=404, detail="Partner application not found")
    return rider.rider_profile


def _set(
    db: Session,
    profile: RiderProfile,
    new_status: ApprovalStatus,
    *,
    actor_user_id: int,
    action: str,
    reason: str | None,
) -> RiderProfile:
    prev = profile.approval_status
    profile.approval_status = new_status
    profile.correction_reason = reason if new_status == ApprovalStatus.needs_correction else None
    audit_service.record(
        db,
        actor_user_id=actor_user_id,
        action=action,
        target_type="partner",
        target_id=profile.user_id,
        reason=reason,
        detail=f"{prev.value}->{new_status.value}",
    )
    return profile


def start_review(db: Session, rider_id: int, actor_user_id: int) -> RiderProfile:
    profile = _profile(db, rider_id)
    if profile.approval_status not in _ADMIN_ACTIONABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot start review from {profile.approval_status.value}",
        )
    return _set(
        db, profile, ApprovalStatus.under_review,
        actor_user_id=actor_user_id, action="partner_under_review", reason=None,
    )


def approve(db: Session, rider_id: int, actor_user_id: int) -> RiderProfile:
    profile = _profile(db, rider_id)
    if profile.approval_status == ApprovalStatus.approved:
        return profile
    if profile.approval_status not in _ADMIN_ACTIONABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot approve from {profile.approval_status.value}",
        )
    return _set(
        db, profile, ApprovalStatus.approved,
        actor_user_id=actor_user_id, action="partner_approved", reason=None,
    )


def reject(db: Session, rider_id: int, actor_user_id: int, reason: str) -> RiderProfile:
    if not reason or not reason.strip():
        raise HTTPException(status_code=400, detail="A rejection reason is required")
    profile = _profile(db, rider_id)
    if profile.approval_status not in _ADMIN_ACTIONABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot reject from {profile.approval_status.value}",
        )
    return _set(
        db, profile, ApprovalStatus.rejected,
        actor_user_id=actor_user_id, action="partner_rejected", reason=reason.strip(),
    )


def request_correction(
    db: Session, rider_id: int, actor_user_id: int, reason: str
) -> RiderProfile:
    if not reason or not reason.strip():
        raise HTTPException(
            status_code=400, detail="Describe what the partner must correct"
        )
    profile = _profile(db, rider_id)
    if profile.approval_status not in _ADMIN_ACTIONABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot request correction from {profile.approval_status.value}",
        )
    return _set(
        db, profile, ApprovalStatus.needs_correction,
        actor_user_id=actor_user_id, action="partner_needs_correction",
        reason=reason.strip(),
    )


def resubmit(db: Session, rider: User) -> RiderProfile:
    """Partner re-submits after a correction request / rejection."""
    profile = rider.rider_profile
    if profile is None:
        raise HTTPException(status_code=404, detail="No partner application")
    if profile.approval_status not in _RESUBMITTABLE:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot resubmit from {profile.approval_status.value}",
        )
    return _set(
        db, profile, ApprovalStatus.submitted,
        actor_user_id=rider.id, action="partner_resubmitted", reason=None,
    )
