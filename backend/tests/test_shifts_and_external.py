"""Shift slots, manually-entered external courier details, and OTP attempt limits."""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from tests.conftest import _auth, login
from tests.helpers import now_iso, register_external_order

KEY = "secret-key"
H = {"X-API-Key": KEY}


@pytest.fixture
def partner_key():
    from app.config import settings

    settings.integration_api_key = KEY
    yield KEY
    settings.integration_api_key = ""


def _admin(client) -> str:
    return login(client, "admin", "admin@kadelivery.app")


def _utc_for_local(hour: int, minute: int = 0) -> datetime:
    """Naive UTC instant for today's HH:MM in the business timezone."""
    from datetime import timezone

    from app.services import shift_service

    local = shift_service.local_now().replace(hour=hour, minute=minute, second=0, microsecond=0)
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def _create_slot(client, atok, name, start, end, **extra) -> dict:
    resp = client.post(
        "/api/v1/admin/shift-slots",
        headers=_auth(atok),
        json={"name": name, "start_time": start, "end_time": end, **extra},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- Window maths -----------------------------------------------------------

def test_window_math_including_overnight():
    from app.models.shift import ShiftSlot
    from app.services import shift_service

    lunch = ShiftSlot(id=1, name="Lunch", start_time="11:00", end_time="14:00")
    late = ShiftSlot(id=2, name="Late", start_time="22:00", end_time="02:00")
    tz = shift_service.tz()
    noon = datetime(2026, 11, 26, 12, 0, tzinfo=tz)
    assert shift_service.current_window(lunch, noon) is not None
    assert shift_service.current_window(lunch, noon.replace(hour=15)) is None
    nxt = shift_service.next_window(lunch, noon.replace(hour=15))
    assert nxt.start.day == 27 and nxt.start.hour == 11

    one_am = datetime(2026, 11, 27, 1, 0, tzinfo=tz)
    w = shift_service.current_window(late, one_am)
    assert w is not None and w.start.day == 26 and w.end.day == 27
    assert shift_service.format_label(lunch) == "11 AM – 2 PM"


# --- Rider slots + enforcement --------------------------------------------

def test_no_slots_means_no_enforcement(client, rider_token):
    resp = client.get("/api/v1/rider/slots", headers=_auth(rider_token))
    assert resp.status_code == 200
    assert resp.json()["enforced"] is False
    assert client.post("/api/v1/rider/online", headers=_auth(rider_token)).status_code == 204


def test_rider_must_choose_slot_and_be_inside_it(client, rider_token, monkeypatch):
    from app.services import shift_service

    atok = _admin(client)
    lunch = _create_slot(client, atok, "Lunch", "11:00", "14:00")
    dinner = _create_slot(client, atok, "Dinner", "19:00", "22:00")

    # No slot chosen -> cannot go online.
    resp = client.post("/api/v1/rider/online", headers=_auth(rider_token))
    assert resp.status_code == 409
    assert "Choose a working slot" in resp.json()["detail"]

    resp = client.put(
        "/api/v1/rider/slots", headers=_auth(rider_token), json={"slot_ids": [lunch["id"]]}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["enforced"] is True
    assert [s["selected"] for s in body["slots"]] == [True, False]

    # Outside the slot (4 PM local) -> blocked with the next slot's time.
    at_four, at_noon = _utc_for_local(16), _utc_for_local(12)
    monkeypatch.setattr(shift_service, "utcnow", lambda: at_four)
    resp = client.post("/api/v1/rider/online", headers=_auth(rider_token))
    assert resp.status_code == 409
    assert "Lunch" in resp.json()["detail"]

    # Inside the slot (noon local) -> allowed.
    monkeypatch.setattr(shift_service, "utcnow", lambda: at_noon)
    assert client.post("/api/v1/rider/online", headers=_auth(rider_token)).status_code == 204

    # Admin can see and change the partner's slots; counts are reported.
    slots = client.get("/api/v1/admin/shift-slots", headers=_auth(atok)).json()
    assert {s["name"]: s["rider_count"] for s in slots} == {"Lunch": 1, "Dinner": 0}
    assert dinner["label"] == "7 PM – 10 PM"


def test_scheduler_switches_online_at_start_and_offline_at_end(client, rider_token, monkeypatch):
    from app.database import SessionLocal
    from app.models.user import RiderProfile, User
    from app.services import shift_service

    atok = _admin(client)
    lunch = _create_slot(client, atok, "Lunch", "11:00", "14:00")
    client.put("/api/v1/rider/slots", headers=_auth(rider_token), json={"slot_ids": [lunch["id"]]})

    with SessionLocal() as db:
        rider = db.query(User).filter(User.email == "rider@digimess.app").one()
        rid = rider.id

    def profile(db):
        return db.query(RiderProfile).filter(RiderProfile.user_id == rid).one()

    t = {k: _utc_for_local(*k) for k in [(10, 30), (11, 1), (12, 0), (12, 5), (14, 1)]}
    monkeypatch.setattr(shift_service, "utcnow", lambda: t[(10, 30)])
    with SessionLocal() as db:
        shift_service.tick(db, t[(10, 30)])
        assert profile(db).is_online is False

    with SessionLocal() as db:
        shift_service.tick(db, t[(11, 1)])
        assert profile(db).is_online is True

    # Rider deliberately goes offline mid-slot: not forced back on.
    monkeypatch.setattr(shift_service, "utcnow", lambda: t[(12, 0)])
    assert client.post("/api/v1/rider/offline", headers=_auth(rider_token)).status_code == 204
    with SessionLocal() as db:
        shift_service.tick(db, t[(12, 5)])
        assert profile(db).is_online is False

    # Back online, then the slot ends -> offline.
    assert client.post("/api/v1/rider/online", headers=_auth(rider_token)).status_code == 204
    with SessionLocal() as db:
        shift_service.tick(db, t[(14, 1)])
        assert profile(db).is_online is False


def test_slot_capacity_and_validation(client, rider_token):
    atok = _admin(client)
    bad = client.post(
        "/api/v1/admin/shift-slots",
        headers=_auth(atok),
        json={"name": "Bad", "start_time": "25:00", "end_time": "14:00"},
    )
    assert bad.status_code == 422
    full = _create_slot(client, atok, "Tiny", "9:00", "10:00", max_riders=1)
    assert full["start_time"] == "09:00"

    first = client.put("/api/v1/rider/slots", headers=_auth(rider_token), json={"slot_ids": [full["id"]]})
    assert first.status_code == 200

    from fastapi import HTTPException

    from app.database import SessionLocal
    from app.models.user import User
    from app.services import shift_service

    with SessionLocal() as db:
        other = db.query(User).filter(User.email == "applicant@digimess.app").one()
        with pytest.raises(HTTPException) as exc:
            shift_service.set_rider_slots(db, other.id, [full["id"]])
        assert exc.value.status_code == 409 and "full" in exc.value.detail

    # Deactivating the only slot lifts enforcement.
    resp = client.patch(
        f"/api/v1/admin/shift-slots/{full['id']}", headers=_auth(atok), json={"is_active": False}
    )
    assert resp.status_code == 200 and resp.json()["is_active"] is False
    assert client.get("/api/v1/rider/slots", headers=_auth(rider_token)).json()["enforced"] is False


# --- External courier details ---------------------------------------------

def test_external_rider_details_flow_to_partner_tracking(client, partner_key):
    ref = register_external_order()
    out = client.post("/api/v1/partner/orders", json={"order_id": ref}, headers=H).json()
    order_id = out["internal_id"]
    atok = _admin(client)

    resp = client.post(
        f"/api/v1/admin/orders/{order_id}/assign",
        headers=_auth(atok),
        json={
            "mode": "external",
            "provider": "porter",
            "reference": "PTR-55",
            "rider_name": "Suresh Kumar",
            "rider_phone": "+91 98765 43210",
            "vehicle_type": "bike",
            "vehicle_number": "mh12ab1234",
            "tracking_url": "https://porter.in/track/PTR-55",
        },
    )
    assert resp.status_code == 200, resp.text
    detail = resp.json()
    assert detail["status"] == "assigned"
    assert detail["external_rider"]["vehicle_number"] == "MH12AB1234"

    track = client.post("/api/v1/partner/tracking", json={"order_id": ref}, headers=H).json()
    assert track["status"] == "assigned"
    assert track["delivery_status"] == "assigned"
    assert track["delivery_partner"] == {
        "name": "Suresh Kumar",
        "phone": "+91 98765 43210",
        "vehicle_type": "bike",
        "vehicle_number": "MH12AB1234",
        "rating": None,
        "source": "external",
        "provider": "porter",
        "tracking_url": "https://porter.in/track/PTR-55",
    }
    assert track["fulfillment"]["type"] == "external"

    # Picked up -> consumer sees out_for_delivery; updating details keeps progress.
    client.post(
        f"/api/v1/admin/orders/{order_id}/external-status",
        headers=_auth(atok),
        json={"status": "picked_up"},
    )
    upd = client.post(
        f"/api/v1/admin/orders/{order_id}/assign",
        headers=_auth(atok),
        json={"mode": "external", "provider": "porter", "rider_name": "Ramesh", "rider_phone": "9000000000"},
    ).json()
    assert upd["external_status"] == "picked_up"
    assert upd["status"] == "out_for_delivery"
    track = client.post("/api/v1/partner/tracking", json={"order_id": ref}, headers=H).json()
    assert track["delivery_partner"]["name"] == "Ramesh"
    assert track["status"] == "out_for_delivery"

    status = client.post("/api/v1/partner/status", json={"order_id": ref}, headers=H).json()
    current = [s["status"] for s in status["timeline"] if s["state"] == "current"]
    assert current == ["out_for_delivery"]

    # Cannot re-route to KA once the external courier picked it up.
    reroute = client.post(
        f"/api/v1/admin/orders/{order_id}/assign",
        headers=_auth(atok),
        json={"mode": "internal", "rider_id": 1},
    )
    assert reroute.status_code in (400, 409)


def test_external_rider_input_validation(client, partner_key):
    ref = register_external_order()
    out = client.post("/api/v1/partner/orders", json={"order_id": ref}, headers=H).json()
    atok = _admin(client)
    bad = client.post(
        f"/api/v1/admin/orders/{out['internal_id']}/assign",
        headers=_auth(atok),
        json={"mode": "external", "provider": "porter", "tracking_url": "javascript:alert(1)"},
    )
    assert bad.status_code == 422


def test_reroute_external_back_to_ka_creates_live_offer(client, partner_key):
    from app.database import SessionLocal
    from app.models.delivery import DeliveryBatch, DeliveryOffer
    from app.models.enums import BatchStatus, OfferStatus

    ref = register_external_order()
    out = client.post("/api/v1/partner/orders", json={"order_id": ref}, headers=H).json()
    order_id = out["internal_id"]
    atok = _admin(client)
    rtok = login(client, "rider", "rider@digimess.app")
    client.post("/api/v1/rider/online", headers=_auth(rtok))
    client.post(
        "/api/v1/rider/location",
        headers=_auth(rtok),
        json={"lat": 18.5210, "lng": 73.8560, "client_timestamp": now_iso()},
    )
    cands = client.get(f"/api/v1/admin/orders/{order_id}/candidate-riders", headers=_auth(atok)).json()
    rid = next(c["rider_id"] for c in cands if c["full_name"] == "Rahul Sharma")

    # KA offer -> external -> back to KA.
    assert client.post(f"/api/v1/admin/orders/{order_id}/assign", headers=_auth(atok),
                       json={"mode": "internal", "rider_id": rid}).status_code == 200
    assert client.post(f"/api/v1/admin/orders/{order_id}/assign", headers=_auth(atok),
                       json={"mode": "external", "provider": "porter"}).status_code == 200
    resp = client.post(f"/api/v1/admin/orders/{order_id}/assign", headers=_auth(atok),
                       json={"mode": "internal", "rider_id": rid})
    assert resp.status_code == 200, resp.text
    assert resp.json()["assignment"]["offer_pending"] is True
    with SessionLocal() as db:
        live = db.query(DeliveryOffer).filter(DeliveryOffer.status == OfferStatus.sent).all()
        assert len(live) == 1
        assert db.get(DeliveryBatch, live[0].batch_id).status != BatchStatus.cancelled

    offers = client.get("/api/v1/rider/offers", headers=_auth(rtok)).json()
    assert len(offers) == 1
    acc = client.post(f"/api/v1/deliveries/offers/{offers[0]['id']}/accept", headers=_auth(rtok))
    assert acc.status_code == 200, acc.text


# --- Login OTP brute force ------------------------------------------------

def test_login_otp_locks_after_max_attempts(client, monkeypatch):
    from app.config import settings
    from app.services import auth_service

    monkeypatch.setattr(settings, "default_otp", "")
    monkeypatch.setattr(auth_service, "generate_otp", lambda: "4321")
    phone = "+919811112222"
    assert client.post("/api/v1/auth/customer/otp/request", json={"phone": phone}).status_code == 200
    for _ in range(settings.login_otp_max_attempts - 1):
        r = client.post("/api/v1/auth/customer/otp/verify", json={"phone": phone, "code": "0000"})
        assert r.status_code in (400, 401)
    r = client.post("/api/v1/auth/customer/otp/verify", json={"phone": phone, "code": "0000"})
    assert "Too many" in r.json()["detail"]
    # The code is burned — even the right one no longer works.
    r = client.post("/api/v1/auth/customer/otp/verify", json={"phone": phone, "code": "4321"})
    assert r.status_code in (400, 401)
