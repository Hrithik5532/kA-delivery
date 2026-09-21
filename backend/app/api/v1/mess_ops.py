"""Mess (kitchen) order workflow: accept -> prepare -> ready + dispatch."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_mess
from app.database import get_db
from app.models.enums import OrderStatus
from app.models.mess import Mess
from app.models.order import Order
from app.models.user import User
from app.schemas.order import OrderOut
from app.services import dispatch_service, notification_service
from app.services import state_machine
from app.services.state_machine import InvalidTransition
from app.services.ws_manager import manager

router = APIRouter(prefix="/mess", tags=["mess"])


def _mess_for_user(db: Session, user: User) -> Mess:
    mess = db.execute(
        select(Mess).where(Mess.owner_user_id == user.id)
    ).scalar_one_or_none()
    if mess is None:
        raise HTTPException(status_code=404, detail="No mess linked to this account")
    return mess


def _get_owned_order(db: Session, mess: Mess, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None or order.mess_id != mess.id:
        raise HTTPException(status_code=404, detail="Order not found for this mess")
    return order


def _transition(
    db: Session, user: User, order_id: int, to_status: OrderStatus
) -> Order:
    mess = _mess_for_user(db, user)
    order = _get_owned_order(db, mess, order_id)
    try:
        state_machine.transition_order(db, order, to_status, actor_user_id=user.id)
    except InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return order


@router.get("/orders", response_model=list[OrderOut])
def mess_orders(
    status: OrderStatus | None = None,
    user: User = Depends(require_mess),
    db: Session = Depends(get_db),
) -> list[OrderOut]:
    mess = _mess_for_user(db, user)
    query = select(Order).where(Order.mess_id == mess.id)
    if status is not None:
        query = query.where(Order.status == status)
    orders = db.execute(query.order_by(Order.created_at.desc())).scalars().all()
    # Never leak the customer's delivery OTP to the mess.
    result = []
    for o in orders:
        out = OrderOut.model_validate(o)
        out.otp_code = None
        result.append(out)
    return result


@router.post("/orders/{order_id}/accept", response_model=OrderOut)
def accept(order_id: int, user: User = Depends(require_mess), db: Session = Depends(get_db)):
    order = _transition(db, user, order_id, OrderStatus.accepted)
    dispatch_service.allocate_on_mess_accept(db, order)
    dispatch_service.repair_assigned_batches(db)
    db.commit()
    manager.publish(order.id)
    notification_service.notify(
        order.customer_id, "Order accepted", f"Order #{order.id} was accepted.",
        {"order_id": order.id, "type": "order_status"},
    )
    out = OrderOut.model_validate(order)
    out.otp_code = None
    return out


@router.post("/orders/{order_id}/prepare", response_model=OrderOut)
def prepare(order_id: int, user: User = Depends(require_mess), db: Session = Depends(get_db)):
    order = _transition(db, user, order_id, OrderStatus.preparing)
    dispatch_service.ensure_missing_deliveries(db)
    db.commit()
    manager.publish(order.id)
    out = OrderOut.model_validate(order)
    out.otp_code = None
    return out


@router.post("/orders/{order_id}/ready", response_model=OrderOut)
def ready(order_id: int, user: User = Depends(require_mess), db: Session = Depends(get_db)):
    order = _transition(db, user, order_id, OrderStatus.ready)
    # Kick off dispatch: batch the ready order and offer to an eligible rider.
    batch = dispatch_service.ensure_batch_for_ready_order(db, order)
    if batch.rider_id is None:
        dispatch_service.offer_batch_to_next_rider(db, batch)
    else:
        dispatch_service.assign_order_if_rider_ready(db, order, batch)
    db.commit()
    manager.publish(order.id)
    notification_service.notify(
        order.customer_id, "Order ready", f"Order #{order.id} is ready for pickup.",
        {"order_id": order.id, "type": "order_status"},
    )
    out = OrderOut.model_validate(order)
    out.otp_code = None
    return out
