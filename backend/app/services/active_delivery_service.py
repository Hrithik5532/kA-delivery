"""Active delivery screen enrichment for rider map + drop-off UI."""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.delivery import Delivery, DeliveryBatch
from app.models.enums import BatchStatus
from app.models.order import Order
from app.models.user import User

DEFAULT_CUSTOMER_NOTE = "Leave at security gate if intercom doesn't answer."


def _split_address(address_text: str) -> tuple[str, str]:
    parts = [p.strip() for p in address_text.split(",", 1)]
    if len(parts) == 2 and parts[1]:
        return parts[0], parts[1]
    return address_text, ""


def ensure_order_address(order: Order) -> None:
    if order.address_title:
        return
    title, subtitle = _split_address(order.address_text)
    order.address_title = title
    order.address_subtitle = subtitle
    if not order.address_tag and any(k in order.address_text.lower() for k in ("tower", "flat", "society", "prestige")):
        order.address_tag = "Gated Society"
    if not order.customer_note and order.is_test:
        order.customer_note = DEFAULT_CUSTOMER_NOTE
        order.customer_verified = True


def ensure_delivery_tracking(delivery: Delivery, order: Order) -> None:
    if delivery.eta_minutes is None:
        delivery.eta_minutes = delivery.estimated_minutes or 14
    if delivery.distance_remaining_km is None:
        delivery.distance_remaining_km = round(delivery.distance_km or 3.2, 1)
    if not delivery.route_label:
        delivery.route_label = "FAST ROUTE"
    if delivery.deliver_by_at is None:
        delivery.deliver_by_at = utcnow() + timedelta(minutes=delivery.eta_minutes or 14)
    if not order.customer_note and delivery.handover_instructions:
        order.customer_note = delivery.handover_instructions


def enrich_stop(order: Order, delivery: Delivery, customer: User | None) -> dict:
    ensure_order_address(order)
    ensure_delivery_tracking(delivery, order)
    deliver_by = delivery.deliver_by_at
    deliver_label = (
        deliver_by.strftime("%I:%M %p").lstrip("0").upper() if deliver_by else "SOON"
    )
    return {
        "address_title": order.address_title or order.address_text,
        "address_subtitle": order.address_subtitle,
        "address_tag": order.address_tag,
        "customer_note": order.customer_note,
        "customer_phone": (customer.phone or "") if customer else "",
        "customer_verified": order.customer_verified,
        "eta_minutes": delivery.eta_minutes or 14,
        "distance_remaining_km": delivery.distance_remaining_km or 3.2,
        "route_label": delivery.route_label or "FAST ROUTE",
        "deliver_by_label": f"BY {deliver_label}",
        "arrived_at_drop": delivery.arrived_at_drop_at is not None,
        "helper_text": f"Tap upon parking at {(order.address_title or order.address_text).split(',')[0]} gate or tower",
    }


def build_active_meta(
    db: Session,
    batch: DeliveryBatch,
    rider_id: int,
    delivery: Delivery,
    order: Order,
) -> dict:
    rider = db.get(User, rider_id)
    profile = rider.rider_profile if rider else None
    ensure_delivery_tracking(delivery, order)
    phase = "delivering" if batch.status == BatchStatus.picked_up else "pickup"
    status_label = (
        "On the way to customer" if phase == "delivering" else "Heading to kitchen"
    )
    deliver_by = delivery.deliver_by_at
    deliver_label = (
        deliver_by.strftime("%I:%M %p").lstrip("0").upper() if deliver_by else "SOON"
    )
    return {
        "phase": phase,
        "status_label": status_label,
        "eta_minutes": delivery.eta_minutes or 14,
        "distance_remaining_km": delivery.distance_remaining_km or 3.2,
        "route_label": delivery.route_label or "FAST ROUTE",
        "deliver_by_label": f"BY {deliver_label}",
        "rider_lat": profile.last_lat if profile else None,
        "rider_lng": profile.last_lng if profile else None,
        "arrived_at_drop": delivery.arrived_at_drop_at is not None,
        "helper_text": f"Tap upon parking at {(order.address_title or order.address_text).split(',')[0]} gate or tower",
    }


def mark_arrived_at_drop(delivery: Delivery) -> dict:
    if delivery.arrived_at_drop_at is None:
        delivery.arrived_at_drop_at = utcnow()
    return {"ok": True, "arrived": True, "arrived_at": delivery.arrived_at_drop_at.isoformat()}


DEMO_ACTIVE_NOTE = "demo-active-delivery"
DEMO_DROP_LAT = 18.5335
DEMO_DROP_LNG = 73.8420




DEMO_PICKUP_NOTE = "demo-pickup-delivery"

DEMO_PICKUP_ITEMS = [
    ("Executive South Indian Thali", 2, 14000, "Packed in 5-compartment meal tray"),
    ("Special Curd Rice Bowl", 1, 9500, "With fried mor milagai & pomegranate"),
    ("Filter Coffee Flask", 1, 6500, "500ml insulated heat-lock pouch"),
]
DEMO_MERCHANT_NOTE = (
    "Please check that hot sambar container lid is tightly taped. Handover from counter 2."
)



def _clear_demo_live_order(db: Session, rider_id: int, test_note: str) -> None:
    """Remove an undelivered demo order so a fresh demo state can be seeded."""
    from sqlalchemy import select

    from app.models.delivery import Delivery, DeliveryBatch
    from app.models.enums import BatchStatus, DeliveryStatus, OrderStatus
    from app.models.order import Order

    rows = db.execute(
        select(Delivery, Order, DeliveryBatch)
        .join(Order, Delivery.order_id == Order.id)
        .join(DeliveryBatch, Delivery.batch_id == DeliveryBatch.id)
        .where(
            Order.test_note == test_note,
            Delivery.rider_id == rider_id,
            Delivery.status.not_in([DeliveryStatus.delivered, DeliveryStatus.cancelled]),
        )
    ).all()
    for delivery, order, batch in rows:
        delivery.status = DeliveryStatus.cancelled
        order.status = OrderStatus.cancelled
        batch.status = BatchStatus.cancelled
    db.flush()


def _rider_has_live_batch(db: Session, rider_id: int) -> bool:
    from sqlalchemy import select

    from app.models.delivery import DeliveryBatch
    from app.models.enums import BatchStatus

    return (
        db.execute(
            select(DeliveryBatch).where(
                DeliveryBatch.rider_id == rider_id,
                DeliveryBatch.status.in_([BatchStatus.assigned, BatchStatus.picked_up]),
            )
        ).scalars().first()
        is not None
    )




def _apply_demo_pickup_mess(mess) -> None:
    mess.name = "Annapoorna Tiffin & Sweets"
    mess.address_text = "Shop #12, 14th Main Rd, Koramangala 4th Block, Bengaluru"
    mess.is_pure_veg = True
    mess.pickup_counter_label = "Counter 2 Pickup"
    mess.contact_phone = "+91 98765 43210"
    mess.pickup_note = DEMO_MERCHANT_NOTE


def _apply_demo_pickup_delivery(delivery) -> None:
    delivery.pickup_eta_minutes = 4
    delivery.pickup_distance_km = 1.2
    delivery.pickup_route_label = "Via 80 Feet Road (Fastest)"
    delivery.pickup_track_status = "on_track"
    delivery.pickup_progress_pct = 65
    delivery.merchant_pickup_note = DEMO_MERCHANT_NOTE
    delivery.pickup_counter = "Counter 2 Pickup"
    delivery.packaging_verified = True
    delivery.food_ready = True


def _ensure_demo_pickup_items(db, order) -> None:
    from app.models.order import OrderItem

    if order.items:
        for item, (name, qty, price, note) in zip(order.items, DEMO_PICKUP_ITEMS):
            item.name_snapshot = name
            item.quantity = qty
            item.unit_price_cents = price
            item.line_total_cents = price * qty
            item.packaging_note = note
        return
    for name, qty, price, note in DEMO_PICKUP_ITEMS:
        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=None,
                name_snapshot=name,
                unit_price_cents=price,
                quantity=qty,
                line_total_cents=price * qty,
                packaging_note=note,
            )
        )


def seed_demo_pickup_delivery(
    db: Session,
    rider_id: int,
    customer_id: int,
    mess_id: int,
) -> None:
    """Seed a newly assigned pickup order (batch assigned, head to kitchen)."""
    from sqlalchemy import select

    from app.models.delivery import Delivery, DeliveryBatch
    from app.models.enums import (
        BatchStatus,
        DeliveryStatus,
        OrderStatus,
        PaymentStatus,
        PayoutStatus,
    )
    from app.models.mess import Mess
    from app.models.order import Order, OrderItem

    existing = db.execute(
        select(Delivery)
        .join(Order, Delivery.order_id == Order.id)
        .where(
            Order.test_note == DEMO_PICKUP_NOTE,
            Delivery.rider_id == rider_id,
            Delivery.status.in_(
                [
                    DeliveryStatus.accepted,
                    DeliveryStatus.en_route_to_mess,
                    DeliveryStatus.picked_up,
                    DeliveryStatus.delivering,
                ]
            ),
        )
    ).scalar_one_or_none()
    if existing is not None:
        mess = db.get(Mess, mess_id)
        if mess is not None:
            _apply_demo_pickup_mess(mess)
        order = db.get(Order, existing.order_id)
        if order is not None:
            _ensure_demo_pickup_items(db, order)
        _apply_demo_pickup_delivery(existing)
        return

    _clear_demo_live_order(db, rider_id, DEMO_ACTIVE_NOTE)
    if _rider_has_live_batch(db, rider_id):
        return

    now = utcnow()
    subtotal = sum(price * qty for _, qty, price, _ in DEMO_PICKUP_ITEMS)

    order = Order(
        customer_id=customer_id,
        mess_id=mess_id,
        status=OrderStatus.assigned,
        is_test=True,
        test_note=DEMO_PICKUP_NOTE,
        address_text=(
            "Flat 402, Tower B, Prestige Tech Vista, "
            "Green Glen Layout, Bellandur, Bengaluru"
        ),
        address_lat=DEMO_DROP_LAT,
        address_lng=DEMO_DROP_LNG,
        address_title="Flat 402, Tower B, Prestige Tech Vista",
        address_subtitle="Green Glen Layout, Bellandur, Bengaluru",
        address_tag="Gated Society",
        customer_note=DEFAULT_CUSTOMER_NOTE,
        customer_verified=True,
        subtotal_cents=subtotal,
        delivery_fee_cents=2000,
        tax_cents=round(subtotal * 0.05),
        total_cents=subtotal + 2000 + round(subtotal * 0.05),
        payment_status=PaymentStatus.pending,
        payment_method="cod",
        otp_code="1212",
        otp_expires_at=now + timedelta(hours=2),
        placed_at=now - timedelta(minutes=8),
    )
    db.add(order)
    db.flush()

    mess_row = db.get(Mess, mess_id)
    if mess_row is not None:
        _apply_demo_pickup_mess(mess_row)
    _ensure_demo_pickup_items(db, order)

    batch = DeliveryBatch(
        mess_id=mess_id,
        rider_id=rider_id,
        status=BatchStatus.assigned,
        total_earning_cents=17200,
    )
    db.add(batch)
    db.flush()

    delivery = Delivery(
        order_id=order.id,
        batch_id=batch.id,
        rider_id=rider_id,
        status=DeliveryStatus.accepted,
        sequence=0,
        earning_cents=17200,
        tip_cents=0,
        surge_multiplier=1.0,
        distance_km=2.8,
        estimated_minutes=12,
        base_fare_cents=9000,
        distance_pay_cents=4200,
        surge_bonus_cents=0,
        payout_status=PayoutStatus.pending,
        handover_type="doorstep",
        handover_instructions=DEFAULT_CUSTOMER_NOTE,
        priority_note="New pickup",
    )
    db.add(delivery)
    ensure_order_address(order)


def seed_demo_active_delivery(
    db: Session,
    rider_id: int,
    customer_id: int,
    mess_id: int,
) -> None:
    """Seed one in-progress delivery (picked up, en route) for the demo rider."""
    from sqlalchemy import select

    from app.models.delivery import Delivery, DeliveryBatch
    from app.models.enums import (
        BatchStatus,
        DeliveryStatus,
        OrderStatus,
        PaymentStatus,
        PayoutStatus,
    )
    from app.models.mess import MenuItem
    from app.models.order import Order, OrderItem

    undelivered = db.execute(
        select(Delivery)
        .join(Order, Delivery.order_id == Order.id)
        .where(
            Order.test_note == DEMO_ACTIVE_NOTE,
            Delivery.rider_id == rider_id,
            Delivery.status.in_(
                [
                    DeliveryStatus.accepted,
                    DeliveryStatus.en_route_to_mess,
                    DeliveryStatus.picked_up,
                    DeliveryStatus.delivering,
                ]
            ),
        )
    ).scalar_one_or_none()
    if undelivered is not None:
        return

    _clear_demo_live_order(db, rider_id, DEMO_PICKUP_NOTE)
    if _rider_has_live_batch(db, rider_id):
        return

    now = utcnow()
    subtotal = (menu_item.price_cents * 2) if menu_item else 24000

    order = Order(
        customer_id=customer_id,
        mess_id=mess_id,
        status=OrderStatus.out_for_delivery,
        is_test=True,
        test_note=DEMO_ACTIVE_NOTE,
        address_text=(
            "Flat 402, Tower B, Prestige Tech Vista, "
            "Green Glen Layout, Bellandur, Bengaluru"
        ),
        address_lat=DEMO_DROP_LAT,
        address_lng=DEMO_DROP_LNG,
        address_title="Flat 402, Tower B, Prestige Tech Vista",
        address_subtitle="Green Glen Layout, Bellandur, Bengaluru",
        address_tag="Gated Society",
        customer_note=DEFAULT_CUSTOMER_NOTE,
        customer_verified=True,
        subtotal_cents=subtotal,
        delivery_fee_cents=2000,
        tax_cents=round(subtotal * 0.05),
        total_cents=subtotal + 2000 + round(subtotal * 0.05),
        payment_status=PaymentStatus.pending,
        payment_method="cod",
        otp_code="1212",
        otp_expires_at=now + timedelta(hours=2),
        placed_at=now - timedelta(minutes=35),
    )
    db.add(order)
    db.flush()

    mess_row = db.get(Mess, mess_id)
    if mess_row is not None:
        _apply_demo_pickup_mess(mess_row)
    _ensure_demo_pickup_items(db, order)

    batch = DeliveryBatch(
        mess_id=mess_id,
        rider_id=rider_id,
        status=BatchStatus.picked_up,
        picked_up_at=now - timedelta(minutes=12),
        total_earning_cents=18500,
    )
    db.add(batch)
    db.flush()

    delivery = Delivery(
        order_id=order.id,
        batch_id=batch.id,
        rider_id=rider_id,
        status=DeliveryStatus.delivering,
        sequence=0,
        picked_up_at=now - timedelta(minutes=12),
        earning_cents=18500,
        tip_cents=0,
        surge_multiplier=1.0,
        distance_km=3.2,
        estimated_minutes=14,
        eta_minutes=14,
        distance_remaining_km=3.2,
        route_label="FAST ROUTE",
        deliver_by_at=now + timedelta(minutes=14),
        handover_type="doorstep",
        handover_instructions=DEFAULT_CUSTOMER_NOTE,
        priority_note="Priority Note",
        base_fare_cents=9000,
        distance_pay_cents=4500,
        surge_bonus_cents=0,
        payout_status=PayoutStatus.pending,
    )
    db.add(delivery)
    ensure_delivery_tracking(delivery, order)
