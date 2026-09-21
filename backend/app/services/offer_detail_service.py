"""Rich offer detail for the delivery offer screen."""
from __future__ import annotations

from app.models.delivery import DeliveryBatch, DeliveryOffer
from app.models.mess import Mess
from app.models.order import Order
from app.services.eta_service import haversine_km, estimate_eta_minutes
from app.services.pricing_service import offer_earnings, surge_cents_for_order, base_earning_cents, batch_incentive_cents


def _handover_label(handover_type: str, order: Order) -> str:
    if handover_type == "doorstep" or order.customer_note:
        return "Contactless"
    return "Direct handover"


def _item_tags(order: Order) -> list[str]:
    tags = []
    for item in order.items:
        qty = item.quantity
        name = item.name_snapshot
        tags.append(f"{qty}× {name}")
    return tags[:4]


def build_offer_detail(
    offer: DeliveryOffer,
    batch: DeliveryBatch,
    mess: Mess | None,
    orders: list[Order],
    stops: list,
    earnings: dict,
) -> dict:
    first = orders[0] if orders else None
    mess_lat = mess.lat if mess else 0.0
    mess_lng = mess.lng if mess else 0.0
    drop_lat = first.address_lat if first else 0.0
    drop_lng = first.address_lng if first else 0.0
    pickup_km = round(haversine_km(mess_lat, mess_lng, drop_lat, drop_lng) * 0.25, 1) if first and mess else 1.2
    total_km = round(haversine_km(mess_lat, mess_lng, drop_lat, drop_lng) * 1.2, 1) if first and mess else 4.8
    drop_km = round(max(total_km - pickup_km, 0.5), 1)
    est_mins = max(18, int(estimate_eta_minutes(total_km)))

    handover_type = "doorstep"
    if stops:
        d = stops[0]
        handover_type = getattr(d, "handover_type", None) or handover_type

    item_count = sum(i.quantity for o in orders for i in o.items) or len(orders)
    bag_count = max(1, min(3, (item_count + 1) // 2))
    is_prepaid = first.payment_method in ("prepaid", "upi", "card") if first else False
    surge = earnings.get("surge_cents", 0)
    base = earnings.get("base_earning_cents", 0)
    distance_pay = max(0, int(total_km * 833))
    multiplier = round(1 + surge / base, 1) if base > 0 and surge > 0 else None

    return {
        "id": offer.id,
        "batch_id": offer.batch_id,
        "status": offer.status,
        "sent_at": offer.sent_at,
        "expires_at": offer.expires_at,
        "mess_name": mess.name if mess else None,
        "mess_lat": mess_lat,
        "mess_lng": mess_lng,
        "mess_address": mess.address_text if mess else "",
        "order_count": len(orders),
        "base_earning_cents": earnings["base_earning_cents"],
        "surge_cents": earnings["surge_cents"],
        "incentive_cents": earnings["incentive_cents"],
        "estimated_earning_cents": earnings["estimated_earning_cents"],
        "is_high_demand": len(orders) >= 2 or earnings["surge_cents"] > 0,
        "stops": stops,
        "total_distance_km": total_km,
        "estimated_minutes": est_mins,
        "route_label": "Optimized traffic route active",
        "pickup_distance_km": pickup_km,
        "drop_distance_km": drop_km,
        "handover_type": handover_type,
        "handover_label": _handover_label(handover_type, first) if first else "Contactless",
        "bag_count": bag_count,
        "bag_size_label": "Medium size" if bag_count <= 2 else "Large",
        "is_express": len(orders) == 1 and item_count <= 3,
        "payout": {
            "base_fare_cents": base,
            "base_fare_label": "Base fare",
            "distance_pay_cents": distance_pay,
            "distance_label": f"{total_km} km total",
            "surge_bonus_cents": surge,
            "surge_multiplier": multiplier,
            "surge_label": f"+₹{surge // 100} Surge" if surge else None,
            "surge_zone": None,
            "tip_cents": 0,
            "tip_customer": "",
            "total_cents": earnings["estimated_earning_cents"],
        },
        "order_summary": {
            "item_count": item_count,
            "item_tags": _item_tags(first) if first else [],
            "payment_label": "Prepaid" if is_prepaid else "COD",
            "is_prepaid": is_prepaid,
            "no_cash_collection": is_prepaid,
        },
    }
