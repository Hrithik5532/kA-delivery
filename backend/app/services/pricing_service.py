"""Surge and incentive calculations for rider offers."""
from __future__ import annotations

from datetime import datetime

from app.models.order import Order


def base_earning_cents(order: Order) -> int:
    return 1500 + order.delivery_fee_cents


def surge_cents_for_order(order: Order, now: datetime | None = None) -> int:
    now = now or datetime.utcnow()
    hour = now.hour
    fee = order.delivery_fee_cents
    if 12 <= hour < 14 or 19 <= hour < 22:
        return int(fee * 0.25)
    if 11 <= hour < 12 or 18 <= hour < 19:
        return int(fee * 0.15)
    return 0


def batch_incentive_cents(order_count: int) -> int:
    if order_count >= 3:
        return 3500
    if order_count >= 2:
        return 2000
    return 0


def offer_earnings(orders: list[Order], order_count: int) -> dict[str, int]:
    base = sum(base_earning_cents(o) for o in orders)
    surge = sum(surge_cents_for_order(o) for o in orders)
    incentive = batch_incentive_cents(order_count)
    total = base + surge + incentive
    return {
        "base_earning_cents": base,
        "surge_cents": surge,
        "incentive_cents": incentive,
        "estimated_earning_cents": total,
    }
