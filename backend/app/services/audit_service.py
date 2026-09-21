"""Append-only audit trail for sensitive admin actions.

Reuses the existing ``AuditEvent`` table (also used by ``state_machine`` for
order/delivery transitions). Admin actions set ``target_type``/``target_id``/
``reason`` so who-did-what-to-whom-and-why is always recoverable.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tracking import AuditEvent


def record(
    db: Session,
    *,
    actor_user_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    reason: str | None = None,
    detail: str | None = None,
    order_id: int | None = None,
    delivery_id: int | None = None,
) -> AuditEvent:
    """Persist an admin audit event (caller commits)."""
    event = AuditEvent(
        actor_user_id=actor_user_id,
        event_type=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        detail=detail,
        order_id=order_id,
        delivery_id=delivery_id,
    )
    db.add(event)
    return event


def for_target(db: Session, target_type: str, target_id: int) -> list[AuditEvent]:
    """All audit events recorded against a given target, newest first."""
    return list(
        db.execute(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == target_type,
                AuditEvent.target_id == target_id,
            )
            .order_by(AuditEvent.id.desc())
        ).scalars()
    )


def for_order(db: Session, order_id: int) -> list[AuditEvent]:
    """Full timeline for an order (status transitions + admin actions), oldest first."""
    return list(
        db.execute(
            select(AuditEvent)
            .where(AuditEvent.order_id == order_id)
            .order_by(AuditEvent.id.asc())
        ).scalars()
    )
