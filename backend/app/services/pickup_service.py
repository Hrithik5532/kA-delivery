"""Pickup screen data for rider merchant collection flow."""
from __future__ import annotations

from app.models.base import utcnow
from app.models.delivery import Delivery
from app.models.mess import Mess
from app.models.order import Order
from app.models.user import User

DEFAULT_MERCHANT_NOTE = (
    "Please check that hot sambar container lid is tightly taped. Handover from counter 2."
)
GPS_NOTE = "GPS auto-validates radius within 50m of shop"


def _ticket_ref(order_id: int) -> str:
    return f"DM-{8800 + order_id}"


def _parse_verified_keys(raw: str) -> set[str]:
    if not raw:
        return set()
    return {k.strip() for k in raw.split(",") if k.strip()}


def _serialize_verified_keys(keys: set[str]) -> str:
    return ",".join(sorted(keys))


def ensure_pickup_defaults(delivery: Delivery, order: Order, mess: Mess | None) -> None:
    if delivery.pickup_eta_minutes is None:
        delivery.pickup_eta_minutes = 4
    if delivery.pickup_distance_km is None:
        delivery.pickup_distance_km = 1.2
    if not delivery.pickup_route_label:
        delivery.pickup_route_label = "Via 80 Feet Road (Fastest)"
    if not delivery.pickup_track_status:
        delivery.pickup_track_status = "on_track"
    if delivery.pickup_progress_pct <= 0:
        delivery.pickup_progress_pct = 65
    if not delivery.merchant_pickup_note:
        if mess and mess.pickup_note:
            delivery.merchant_pickup_note = mess.pickup_note
        elif order.is_test:
            delivery.merchant_pickup_note = DEFAULT_MERCHANT_NOTE
    if not delivery.pickup_counter and mess and mess.pickup_counter_label:
        delivery.pickup_counter = mess.pickup_counter_label
    if mess and order.is_test:
        if not mess.pickup_note:
            mess.pickup_note = DEFAULT_MERCHANT_NOTE


def build_pickup(
    delivery: Delivery,
    order: Order,
    mess: Mess | None,
    rider: User | None,
) -> dict:
    ensure_pickup_defaults(delivery, order, mess)
    verified = _parse_verified_keys(delivery.verified_item_keys)
    checklist = []
    for item in order.items:
        key = f"item-{item.id}"
        note = item.packaging_note or (item.name_snapshot and "")
        if order.is_test and not item.packaging_note:
            notes = {
                "Executive South Indian Thali": "Packed in 5-compartment meal tray",
                "Special Curd Rice Bowl": "With fried mor milagai & pomegranate",
                "Filter Coffee Flask": "500ml insulated heat-lock pouch",
            }
            note = notes.get(item.name_snapshot, item.name_snapshot)
        checklist.append({
            "key": key,
            "name": item.name_snapshot,
            "packaging_note": note,
            "quantity": item.quantity,
            "verified": key in verified,
        })

    track_label = {
        "on_track": "ON TRACK",
        "delayed": "DELAYED",
        "arrived": "ARRIVED",
    }.get(delivery.pickup_track_status, "ON TRACK")

    rider_lat = rider.rider_profile.last_lat if rider and rider.rider_profile else None
    rider_lng = rider.rider_profile.last_lng if rider and rider.rider_profile else None

    return {
        "delivery_id": delivery.id,
        "order_id": order.id,
        "ticket_ref": _ticket_ref(order.id),
        "phase_label": "Go to Pickup",
        "tracking": {
            "eta_minutes": delivery.pickup_eta_minutes or 4,
            "distance_km": delivery.pickup_distance_km or 1.2,
            "route_label": delivery.pickup_route_label or "Via 80 Feet Road (Fastest)",
            "track_status": delivery.pickup_track_status,
            "track_status_label": track_label,
            "progress_pct": delivery.pickup_progress_pct or 65,
        },
        "merchant": {
            "mess_id": mess.id if mess else 0,
            "name": mess.name if mess else "Kitchen",
            "address": mess.address_text if mess else "",
            "lat": mess.lat if mess else 0.0,
            "lng": mess.lng if mess else 0.0,
            "is_pure_veg": bool(mess and mess.is_pure_veg),
            "phone": (mess.contact_phone if mess else "") or "",
            "counter_label": delivery.pickup_counter or (mess.pickup_counter_label if mess else "Counter 1"),
            "packaging_verified": delivery.packaging_verified,
            "food_ready": delivery.food_ready,
            "pickup_note": delivery.merchant_pickup_note,
        },
        "merchant_pickup_note": delivery.merchant_pickup_note,
        "checklist": checklist,
        "all_verified": bool(checklist) and all(i["verified"] for i in checklist),
        "arrived_at_pickup": delivery.arrived_at_pickup_at is not None,
        "gps_validation_note": GPS_NOTE,
        "rider_lat": rider_lat,
        "rider_lng": rider_lng,
        "drop_lat": order.address_lat,
        "drop_lng": order.address_lng,
    }


def verify_items(delivery: Delivery, item_keys: list[str]) -> dict:
    keys = set(item_keys)
    delivery.verified_item_keys = _serialize_verified_keys(keys)
    return {"ok": True, "verified_keys": sorted(keys)}


def mark_arrived_at_pickup(delivery: Delivery) -> dict:
    if delivery.arrived_at_pickup_at is None:
        delivery.arrived_at_pickup_at = utcnow()
    delivery.pickup_track_status = "arrived"
    delivery.pickup_progress_pct = 100
    return {
        "ok": True,
        "arrived": True,
        "arrived_at": delivery.arrived_at_pickup_at.isoformat(),
    }
