"""Delivery lifecycle: offer accept/reject, pickup, and OTP completion."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_approved_rider
from app.database import get_db
from app.models.base import utcnow
from app.models.delivery import Delivery, DeliveryBatch, DeliveryOffer
from app.models.enums import (
    BatchStatus,
    DeliveryStatus,
    OrderStatus,
)
from app.models.mess import Mess
from app.models.order import Order
from app.models.user import User
from app.schemas.delivery import (
    ArrivedAtDropOut,
    ArrivedAtPickupOut,
    PickupDetailOut,
    PickupVerifyItemsOut,
    PickupVerifyItemsRequest,
    CompleteDeliveryRequest,
    DeliveryCompletionOut,
    DeliveryHandoverOut,
    DeliveryPhotoOut,
    OfferOut,
    VerifyOtpResultOut,
)
from app.services import (
    active_delivery_service,
    pickup_service,
    dispatch_service,
    earnings_service,
    completion_service,
    handover_service,
    history_service,
    notification_service,
    payment_service,
    state_machine,
)
from app.services.state_machine import InvalidTransition
from app.services.ws_manager import manager

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


def _owned_delivery(db: Session, delivery_id: int, rider: User) -> Delivery:
    delivery = db.get(Delivery, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery.rider_id != rider.id:
        # A rider must never touch another rider's assignment.
        raise HTTPException(status_code=403, detail="Not your delivery")
    return delivery


@router.post("/offers/{offer_id}/accept")
def accept_offer(
    offer_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
):
    offer = db.get(DeliveryOffer, offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    try:
        batch = dispatch_service.accept_offer(db, offer, rider)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Offer is not yours")
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    for delivery in batch.deliveries:
        manager.publish(delivery.order_id)
        order = db.get(Order, delivery.order_id)
        if order and not order.is_test:
            notification_service.notify(
                order.customer_id, "Rider assigned",
                f"A rider is on the way to pick up order #{order.id}.",
                {"order_id": order.id, "type": "order_status"},
            )
    return {"batch_id": batch.id, "status": batch.status.value}


@router.post("/offers/{offer_id}/reject")
def reject_offer(
    offer_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
):
    offer = db.get(DeliveryOffer, offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    try:
        next_offer = dispatch_service.reject_offer(db, offer, rider)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Offer is not yours")
    db.commit()
    return {"rejected": True, "reoffered": next_offer is not None}




@router.get("/{delivery_id}/pickup", response_model=PickupDetailOut)
def pickup_details(
    delivery_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
) -> PickupDetailOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    order = db.get(Order, delivery.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    mess = db.get(Mess, order.mess_id)
    data = pickup_service.build_pickup(delivery, order, mess, rider)
    db.commit()
    return PickupDetailOut.model_validate(data)


@router.post("/{delivery_id}/pickup/arrived", response_model=ArrivedAtPickupOut)
def arrived_at_pickup(
    delivery_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
) -> ArrivedAtPickupOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    result = pickup_service.mark_arrived_at_pickup(delivery)
    db.commit()
    return ArrivedAtPickupOut(**result)


@router.post("/{delivery_id}/pickup/verify-items", response_model=PickupVerifyItemsOut)
def verify_pickup_items(
    delivery_id: int,
    data: PickupVerifyItemsRequest,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
) -> PickupVerifyItemsOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    result = pickup_service.verify_items(delivery, data.item_keys)
    db.commit()
    return PickupVerifyItemsOut(**result)


@router.post("/{delivery_id}/pickup")
def pickup(
    delivery_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
):
    """Confirm collection at the mess. Marks the whole batch picked up and every
    order out for delivery.
    """
    delivery = _owned_delivery(db, delivery_id, rider)
    batch = db.get(DeliveryBatch, delivery.batch_id)
    if batch.status == BatchStatus.picked_up:
        return {"batch_id": batch.id, "status": batch.status.value}
    try:
        dispatch_service.prepare_batch_for_pickup(db, batch, rider)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    now = utcnow()
    for d in batch.deliveries:
        order = db.get(Order, d.order_id)
        if order is None:
            continue
        try:
            if d.status in (DeliveryStatus.accepted, DeliveryStatus.en_route_to_mess):
                state_machine.transition_delivery(
                    db, d, DeliveryStatus.picked_up, actor_user_id=rider.id
                )
            if d.status == DeliveryStatus.picked_up:
                state_machine.transition_delivery(
                    db, d, DeliveryStatus.delivering, actor_user_id=rider.id
                )
            if order.status == OrderStatus.assigned:
                state_machine.transition_order(
                    db, order, OrderStatus.picked_up, actor_user_id=rider.id
                )
            if order.status == OrderStatus.picked_up:
                state_machine.transition_order(
                    db, order, OrderStatus.out_for_delivery, actor_user_id=rider.id
                )
            d.picked_up_at = now
        except InvalidTransition as exc:
            raise HTTPException(status_code=409, detail=str(exc))

    batch.status = BatchStatus.picked_up
    batch.picked_up_at = now
    db.commit()
    for d in batch.deliveries:
        manager.publish(d.order_id)
    return {"batch_id": batch.id, "status": batch.status.value}



@router.get("/{delivery_id}/handover", response_model=DeliveryHandoverOut)
def handover_details(
    delivery_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
) -> DeliveryHandoverOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    order = db.get(Order, delivery.order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    mess = db.get(Mess, order.mess_id)
    customer = db.get(User, order.customer_id)
    data = handover_service.build_handover(delivery, order, mess, customer)
    db.commit()
    return DeliveryHandoverOut.model_validate(data)


@router.post("/{delivery_id}/verify-otp", response_model=VerifyOtpResultOut)
def verify_delivery_otp(
    delivery_id: int,
    data: CompleteDeliveryRequest,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
) -> VerifyOtpResultOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    order = db.get(Order, delivery.order_id)
    if not data.otp:
        raise HTTPException(status_code=400, detail="OTP is required")
    result = handover_service.verify_otp(delivery, order, data.otp)
    db.commit()
    return VerifyOtpResultOut(**result)


@router.post("/{delivery_id}/photo", response_model=DeliveryPhotoOut)
def upload_delivery_photo(
    delivery_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
) -> DeliveryPhotoOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    result = handover_service.save_delivery_photo(delivery, file)
    db.commit()
    return DeliveryPhotoOut(**result)


@router.get("/{delivery_id}/completion", response_model=DeliveryCompletionOut)
def completion_summary(
    delivery_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
) -> DeliveryCompletionOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    if delivery.status != DeliveryStatus.delivered:
        raise HTTPException(status_code=409, detail="Delivery is not completed yet")
    order = db.get(Order, delivery.order_id)
    mess = db.get(Mess, order.mess_id) if order else None
    customer = db.get(User, order.customer_id) if order else None
    batch = db.get(DeliveryBatch, delivery.batch_id)
    pending = sum(1 for d in batch.deliveries if d.status != DeliveryStatus.delivered) if batch else 0
    summary = completion_service.build_completion_summary(delivery, order, mess, customer)
    summary["pending_stops"] = pending
    return DeliveryCompletionOut.model_validate(summary)




@router.post("/{delivery_id}/arrived", response_model=ArrivedAtDropOut)
def arrived_at_drop(
    delivery_id: int,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
) -> ArrivedAtDropOut:
    delivery = _owned_delivery(db, delivery_id, rider)
    if delivery.status not in (DeliveryStatus.picked_up, DeliveryStatus.delivering):
        raise HTTPException(status_code=409, detail="Delivery is not en route")
    result = active_delivery_service.mark_arrived_at_drop(delivery)
    db.commit()
    return ArrivedAtDropOut(**result)

@router.post("/{delivery_id}/complete", response_model=DeliveryCompletionOut)
def complete(
    delivery_id: int,
    data: CompleteDeliveryRequest,
    rider: User = Depends(require_approved_rider),
    db: Session = Depends(get_db),
):
    """Complete a single stop using the customer's OTP as server-verified proof."""
    delivery = _owned_delivery(db, delivery_id, rider)
    order = db.get(Order, delivery.order_id)

    if delivery.status not in (DeliveryStatus.picked_up, DeliveryStatus.delivering):
        raise HTTPException(status_code=409, detail="Delivery is not out for delivery")

    handover_service.assert_otp_ready(delivery, order, data.otp)

    now = utcnow()
    try:
        state_machine.transition_delivery(
            db, delivery, DeliveryStatus.delivered, actor_user_id=rider.id
        )
        state_machine.transition_order(
            db, order, OrderStatus.delivered, actor_user_id=rider.id
        )
    except InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    delivery.delivered_at = now
    mess = db.get(Mess, order.mess_id)
    customer = db.get(User, order.customer_id)
    completion_service.capture_completion_metrics(delivery, order, mess, customer)
    # Test orders never settle a real payment.
    if not order.is_test:
        payment_service.capture_on_delivery(order)

    # If every stop in the batch is delivered, complete it and reconcile payout.
    batch = db.get(DeliveryBatch, delivery.batch_id)
    dispatch_service.finalize_batch_if_done(db, batch)
    dispatch_service.release_remaining_stops_after_completion(db, batch)
    pending = sum(1 for d in batch.deliveries if d.status != DeliveryStatus.delivered and d.id != delivery.id) if batch else 0

    db.commit()
    manager.publish(order.id)  # snapshot now reports tracking revoked
    if not order.is_test:
        notification_service.notify(
            order.customer_id, "Delivered",
            f"Order #{order.id} has been delivered. Enjoy!",
            {"order_id": order.id, "type": "order_status"},
        )
    summary = completion_service.build_completion_summary(delivery, order, mess, customer)
    summary["pending_stops"] = pending
    return DeliveryCompletionOut.model_validate(summary)
