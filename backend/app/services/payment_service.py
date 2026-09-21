"""Payment interface with a cash-on-delivery / mock provider.

Real gateways plug in behind the same two calls. COD keeps the order pending
until delivery, then marks it paid on OTP-verified completion.
"""
from __future__ import annotations

from app.config import settings
from app.models.enums import PaymentStatus
from app.models.order import Order


def authorize(order: Order) -> PaymentStatus:
    """Called at order placement. COD/mock leaves payment pending."""
    if settings.payment_provider == "mock":
        order.payment_status = PaymentStatus.paid
    else:  # cod (default)
        order.payment_status = PaymentStatus.pending
    return order.payment_status


def capture_on_delivery(order: Order) -> PaymentStatus:
    """Called on verified delivery completion; settles COD payment."""
    if order.payment_status != PaymentStatus.paid:
        order.payment_status = PaymentStatus.paid
    return order.payment_status
