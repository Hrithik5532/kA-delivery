"""Kitchen prep ETA helpers for rider-facing screens."""
from __future__ import annotations

from app.models.enums import OrderStatus
from app.models.order import Order


def prep_ready_in_minutes(order: Order) -> int:
    if order.status in (
        OrderStatus.ready,
        OrderStatus.assigned,
        OrderStatus.picked_up,
        OrderStatus.out_for_delivery,
        OrderStatus.delivered,
    ):
        return 0
    if order.status == OrderStatus.preparing:
        return 8
    if order.status == OrderStatus.accepted:
        return 12
    return 15
