"""Customer ordering: checkout preview, placement, history and tracking."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_customer
from app.database import get_db
from app.models.order import Order
from app.models.user import User
from app.schemas.order import (
    CheckoutRequest,
    CheckoutResponse,
    OrderOut,
    PlaceOrderRequest,
)
from app.schemas.tracking import TrackingSnapshot
from app.services import order_service, tracking_service

router = APIRouter(prefix="/orders", tags=["orders"])


def _order_out(order: Order, *, include_otp: bool) -> OrderOut:
    out = OrderOut.model_validate(order)
    if not include_otp:
        out.otp_code = None
    return out


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    data: CheckoutRequest,
    _: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> CheckoutResponse:
    """Return the authoritative price breakdown without creating an order."""
    return order_service.price_cart(db, data.mess_id, data.items)


@router.post("", response_model=OrderOut, status_code=201)
def place_order(
    data: PlaceOrderRequest,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = order_service.create_order(db, user, data)
    return _order_out(order, include_otp=True)


@router.get("", response_model=list[OrderOut])
def list_orders(
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> list[OrderOut]:
    orders = db.execute(
        select(Order)
        .where(Order.customer_id == user.id)
        .order_by(Order.created_at.desc())
    ).scalars().all()
    return [_order_out(o, include_otp=True) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.get(Order, order_id)
    if order is None or order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_out(order, include_otp=True)


@router.get("/{order_id}/tracking", response_model=TrackingSnapshot)
def get_tracking(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrackingSnapshot:
    """Initial state and REST recovery for the live tracking screen.

    Order-scoped: only the owning customer may read it.
    """
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if not tracking_service.customer_can_view(order, user):
        raise HTTPException(status_code=403, detail="Not authorized for this order")
    return tracking_service.build_snapshot(db, order)
