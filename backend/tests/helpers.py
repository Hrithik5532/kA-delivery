"""Shared flow helpers for driving orders through their lifecycle in tests."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from tests.conftest import _auth

CUST_LAT, CUST_LNG = 18.5310, 73.8446


def now_iso(offset_seconds: int = 0) -> str:
    return (
        datetime.now(timezone.utc).replace(microsecond=0)
        + timedelta(seconds=offset_seconds)
    ).isoformat()


def _db_session():
    from app.database import SessionLocal

    return SessionLocal()


def place_order() -> dict:
    """Create a placed order via internal services (no customer HTTP API)."""
    from app.models.mess import MenuItem, Mess
    from app.models.user import User
    from app.schemas.order import CartItemIn, PlaceOrderRequest
    from app.services.order_service import create_order

    db = _db_session()
    try:
        customer = db.execute(
            select(User).where(User.email == "customer@digimess.app")
        ).scalar_one()
        mess = db.execute(select(Mess)).scalars().first()
        menu_item = db.execute(
            select(MenuItem).where(MenuItem.mess_id == mess.id)
        ).scalars().first()
        req = PlaceOrderRequest(
            mess_id=mess.id,
            items=[CartItemIn(menu_item_id=menu_item.id, quantity=2)],
            address_text="Flat 4B, Shivaji Nagar",
            address_lat=CUST_LAT,
            address_lng=CUST_LNG,
            payment_method="cod",
        )
        order = create_order(db, customer, req)
        db.commit()
        db.refresh(order)
        return {"id": order.id, "otp_code": order.otp_code}
    finally:
        db.close()


def mess_advance(order_id: int, action: str) -> None:
    """Advance mess workflow via internal services."""
    from app.models.enums import OrderStatus
    from app.models.order import Order
    from app.services import dispatch_service, state_machine

    status_map = {
        "accept": OrderStatus.accepted,
        "prepare": OrderStatus.preparing,
        "ready": OrderStatus.ready,
    }
    db = _db_session()
    try:
        order = db.get(Order, order_id)
        state_machine.transition_order(db, order, status_map[action], actor_user_id=order.mess_id)
        if action == "accept":
            dispatch_service.allocate_on_mess_accept(db, order)
            dispatch_service.repair_assigned_batches(db)
        elif action == "prepare":
            dispatch_service.ensure_missing_deliveries(db)
        elif action == "ready":
            batch = dispatch_service.ensure_batch_for_ready_order(db, order)
            if batch.rider_id is None:
                dispatch_service.offer_batch_to_next_rider(db, batch)
            else:
                dispatch_service.assign_order_if_rider_ready(db, order, batch)
        db.commit()
    finally:
        db.close()


def rider_online(client: TestClient, rtok: str) -> None:
    resp = client.post("/api/v1/rider/online", headers=_auth(rtok))
    assert resp.status_code == 204, resp.text


def accept_first_offer(client: TestClient, rtok: str) -> int:
    offers = client.get("/api/v1/rider/offers", headers=_auth(rtok)).json()
    assert offers, "expected at least one offer"
    offer_id = offers[0]["id"]
    resp = client.post(
        f"/api/v1/deliveries/offers/{offer_id}/accept", headers=_auth(rtok)
    )
    assert resp.status_code == 200, resp.text
    return offer_id


def active_batch(client: TestClient, rtok: str) -> dict:
    resp = client.get("/api/v1/rider/active", headers=_auth(rtok))
    assert resp.status_code == 200, resp.text
    return resp.json()


def drive_to_out_for_delivery(
    client: TestClient, rtok: str
) -> dict:
    """Full path up to (and including) pickup. Returns useful ids."""
    order = place_order()
    order_id = order["id"]
    otp = order["otp_code"]

    rider_online(client, rtok)
    mess_advance(order_id, "accept")
    mess_advance(order_id, "prepare")
    mess_advance(order_id, "ready")

    batch = active_batch(client, rtok)
    if batch is None:
        accept_first_offer(client, rtok)
        batch = active_batch(client, rtok)
    delivery_id = batch["stops"][0]["delivery_id"]

    loc = client.post(
        "/api/v1/rider/location",
        headers=_auth(rtok),
        json={
            "lat": 18.5220,
            "lng": 73.8550,
            "client_timestamp": now_iso(),
        },
    )
    assert loc.status_code == 200, loc.text

    pick = client.post(
        f"/api/v1/deliveries/{delivery_id}/pickup", headers=_auth(rtok)
    )
    assert pick.status_code == 200, pick.text

    return {"order_id": order_id, "delivery_id": delivery_id, "otp": otp}
