"""Server-authoritative order & delivery state transitions with audit trail.

The client never dictates status; every transition is validated here against an
explicit allowed-transition map and recorded as an ``AuditEvent``.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.delivery import Delivery
from app.models.enums import DeliveryStatus, OrderStatus
from app.models.order import Order
from app.models.tracking import AuditEvent


class InvalidTransition(Exception):
    """Raised when a requested state change is not allowed."""


ALLOWED_ORDER_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.placed: {OrderStatus.accepted, OrderStatus.cancelled},
    OrderStatus.accepted: {OrderStatus.preparing, OrderStatus.cancelled},
    OrderStatus.preparing: {OrderStatus.ready, OrderStatus.cancelled},
    OrderStatus.ready: {OrderStatus.assigned, OrderStatus.cancelled},
    OrderStatus.assigned: {OrderStatus.picked_up, OrderStatus.cancelled},
    OrderStatus.picked_up: {OrderStatus.out_for_delivery, OrderStatus.cancelled},
    OrderStatus.out_for_delivery: {OrderStatus.delivered, OrderStatus.cancelled},
    OrderStatus.delivered: set(),
    OrderStatus.cancelled: set(),
}

ALLOWED_DELIVERY_TRANSITIONS: dict[DeliveryStatus, set[DeliveryStatus]] = {
    DeliveryStatus.pending: {DeliveryStatus.offered, DeliveryStatus.accepted, DeliveryStatus.cancelled},
    DeliveryStatus.offered: {DeliveryStatus.accepted, DeliveryStatus.cancelled},
    DeliveryStatus.accepted: {
        DeliveryStatus.en_route_to_mess,
        DeliveryStatus.picked_up,
        DeliveryStatus.cancelled,
    },
    DeliveryStatus.en_route_to_mess: {
        DeliveryStatus.picked_up,
        DeliveryStatus.cancelled,
    },
    DeliveryStatus.picked_up: {DeliveryStatus.delivering, DeliveryStatus.delivered},
    DeliveryStatus.delivering: {DeliveryStatus.delivered},
    DeliveryStatus.delivered: set(),
    DeliveryStatus.cancelled: set(),
}


def transition_order(
    db: Session,
    order: Order,
    to_status: OrderStatus,
    actor_user_id: int | None = None,
    detail: str | None = None,
) -> Order:
    current = order.status
    if to_status not in ALLOWED_ORDER_TRANSITIONS.get(current, set()):
        raise InvalidTransition(
            f"Order {order.id} cannot move from {current.value} to {to_status.value}"
        )
    order.status = to_status
    if to_status == OrderStatus.delivered:
        order.delivered_at = utcnow()
    db.add(
        AuditEvent(
            order_id=order.id,
            actor_user_id=actor_user_id,
            event_type="order_status",
            from_state=current.value,
            to_state=to_status.value,
            detail=detail,
        )
    )
    return order


def transition_delivery(
    db: Session,
    delivery: Delivery,
    to_status: DeliveryStatus,
    actor_user_id: int | None = None,
    detail: str | None = None,
) -> Delivery:
    current = delivery.status
    if to_status not in ALLOWED_DELIVERY_TRANSITIONS.get(current, set()):
        raise InvalidTransition(
            f"Delivery {delivery.id} cannot move from {current.value} "
            f"to {to_status.value}"
        )
    delivery.status = to_status
    db.add(
        AuditEvent(
            order_id=delivery.order_id,
            delivery_id=delivery.id,
            actor_user_id=actor_user_id,
            event_type="delivery_status",
            from_state=current.value,
            to_state=to_status.value,
            detail=detail,
        )
    )
    return delivery
