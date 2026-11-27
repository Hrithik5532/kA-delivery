"""Monthly salary + salary invoices (generate -> approve -> paid)."""
from __future__ import annotations

from tests.conftest import _auth, login


def _admin(client) -> str:
    return login(client, "admin", "admin@kadelivery.app")


def _rider_id(email="rider@digimess.app") -> int:
    from app.database import SessionLocal
    from app.models.user import User

    with SessionLocal() as db:
        return db.query(User).filter(User.email == email).one().id


def test_salary_invoice_lifecycle(client, rider_token):
    atok = _admin(client)
    rid = _rider_id()
    h = _auth(atok)

    # Set salary from the partner profile.
    resp = client.patch(f"/api/v1/admin/partners/{rid}", headers=h, json={"monthly_salary_cents": 1800000})
    assert resp.status_code == 200, resp.text
    assert resp.json()["monthly_salary_cents"] == 1800000

    gen = client.post("/api/v1/admin/salary/invoices/generate", headers=h, json={"period": "2026-11"})
    assert gen.status_code == 201, gen.text
    body = gen.json()
    mine = [i for i in body["created"] if i["rider_id"] == rid]
    assert len(mine) == 1
    inv = mine[0]
    assert inv["status"] == "draft" and inv["net_cents"] == 1800000
    assert inv["invoice_number"].startswith("SAL-202611-")
    # Riders without a salary are reported, not invoiced.
    assert any(s["reason"] == "Monthly salary not set" for s in body["skipped"])

    # Regenerating does not duplicate.
    again = client.post("/api/v1/admin/salary/invoices/generate", headers=h, json={"period": "2026-11"}).json()
    assert not [i for i in again["created"] if i["rider_id"] == rid]

    # Draft is invisible to the rider.
    assert client.get("/api/v1/rider/salary", headers=_auth(rider_token)).json()["invoices"] == []

    upd = client.patch(f"/api/v1/admin/salary/invoices/{inv['id']}", headers=h,
                       json={"additions_cents": 50000, "deductions_cents": 20000, "notes": "Festival bonus; uniform"})
    assert upd.json()["net_cents"] == 1830000

    # Cannot pay before approval.
    assert client.post(f"/api/v1/admin/salary/invoices/{inv['id']}/paid", headers=h,
                       json={"payment_reference": "UTR123"}).status_code == 409
    assert client.post(f"/api/v1/admin/salary/invoices/{inv['id']}/approve", headers=h).json()["status"] == "approved"
    # Approved invoices are locked.
    assert client.patch(f"/api/v1/admin/salary/invoices/{inv['id']}", headers=h,
                        json={"additions_cents": 1}).status_code == 409

    rider_view = client.get("/api/v1/rider/salary", headers=_auth(rider_token)).json()
    assert rider_view["monthly_salary_cents"] == 1800000
    assert [i["status"] for i in rider_view["invoices"]] == ["approved"]
    one = client.get(f"/api/v1/rider/salary/invoices/{inv['id']}", headers=_auth(rider_token))
    assert one.status_code == 200 and one.json()["net_cents"] == 1830000

    paid = client.post(f"/api/v1/admin/salary/invoices/{inv['id']}/paid", headers=h,
                       json={"payment_reference": "UTR123"}).json()
    assert paid["status"] == "paid" and paid["payment_reference"] == "UTR123"
    assert client.get("/api/v1/rider/salary", headers=_auth(rider_token)).json()["total_paid_cents"] == 1830000

    listing = client.get("/api/v1/admin/salary/invoices?period=2026-11", headers=h).json()
    assert listing["totals"]["paid"]["net_cents"] == 1830000


def test_rider_cannot_see_other_riders_invoice(client):
    atok = _admin(client)
    h = _auth(atok)
    rid2 = _rider_id("rider2@digimess.app")
    client.patch(f"/api/v1/admin/partners/{rid2}", headers=h, json={"monthly_salary_cents": 1500000})
    inv = client.post("/api/v1/admin/salary/invoices/generate", headers=h,
                      json={"period": "2026-10", "rider_id": rid2}).json()["created"][0]
    client.post(f"/api/v1/admin/salary/invoices/{inv['id']}/approve", headers=h)
    rtok = login(client, "rider", "rider@digimess.app")
    assert client.get(f"/api/v1/rider/salary/invoices/{inv['id']}", headers=_auth(rtok)).status_code == 404


def test_removed_wallet_and_self_slot_endpoints(client, rider_token):
    h = _auth(rider_token)
    assert client.get("/api/v1/rider/wallet", headers=h).status_code == 404
    assert client.post("/api/v1/rider/wallet/withdraw", headers=h, json={"amount_cents": 1}).status_code == 404
    assert client.put("/api/v1/rider/slots", headers=h, json={"slot_ids": []}).status_code == 405
    assert client.post("/api/v1/auth/rider/otp/request", json={"phone": "+919876543210"}).status_code == 404
