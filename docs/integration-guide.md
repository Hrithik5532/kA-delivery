# Digi Mess — Customer-App Integration Guide

This guide is for the **separate customer-app team**. It documents the stable
backend contract for creating orders and tracking deliveries. You do **not**
need the admin dashboard or the delivery-partner app to integrate.

- **Base URL:** `${API_BASE_URL}` (e.g. `http://localhost:8000`)
- **API prefix:** all REST endpoints live under `/api/v1`
- **Interactive docs:** `GET /docs` (Swagger UI) and `GET /openapi.json` (machine-readable OpenAPI 3)
- **Auth:** JWT Bearer tokens. Send `Authorization: Bearer <access_token>`.
- **Errors:** standard FastAPI shape — `{"detail": "<message>"}` (or a list of
  field errors for 422). HTTP status codes carry the meaning (400/401/403/404/409/422).

> **Core principle.** The customer app and the admin test-order tool call the
> **same order-creation service**. The only differences are authorization and an
> internal `is_test` flag. You never see or set `is_test` — real customer orders
> are always `is_test=false`.

---

## 1. Authentication

Customers sign in by **phone + OTP**:

```
POST /api/v1/auth/customer/otp/request
{ "phone": "+919000000001" }
→ 200 { "sent": true, "dev_code": "123456" }   # dev_code only present in dev
```
```
POST /api/v1/auth/customer/otp/verify
{ "phone": "+919000000001", "code": "123456", "full_name": "Priya" }
→ 200 { "access_token": "<jwt>", "token_type": "bearer", "role": "customer", "roles": ["customer"] }
```

Use the `access_token` as `Authorization: Bearer <token>` on all subsequent calls.
`GET /api/v1/auth/me` returns the current user.

---

## 2. Creating an order

Order totals are **always computed server-side**. Preview a price with `checkout`,
then place the order.

```
POST /api/v1/orders/checkout            (auth: customer)
{ "mess_id": 1, "items": [ { "menu_item_id": 10, "quantity": 2 } ] }
→ 200 {
  "mess_id": 1,
  "lines": [ { "menu_item_id": 10, "name": "Veg Thali", "unit_price_cents": 12000, "quantity": 2, "line_total_cents": 24000 } ],
  "subtotal_cents": 24000, "delivery_fee_cents": 2000, "tax_cents": 1200, "total_cents": 27200
}
```
```
POST /api/v1/orders                     (auth: customer)
{
  "mess_id": 1,
  "items": [ { "menu_item_id": 10, "quantity": 2 } ],
  "address_id": 5,               // OR inline address_text + address_lat + address_lng
  "payment_method": "cod"
}
→ 201 {
  "id": 42, "mess_id": 1, "status": "placed", "is_test": false,
  "address_text": "Flat 4B", "address_lat": 18.53, "address_lng": 73.84,
  "subtotal_cents": 24000, "delivery_fee_cents": 2000, "tax_cents": 1200, "total_cents": 27200,
  "payment_status": "pending", "payment_method": "cod",
  "items": [ ... ], "otp_code": "1234", "created_at": "..."
}
```

- `otp_code` is the **delivery proof**: show it to the customer; the partner
  enters it to complete delivery. It is only returned to the owning customer.
- **Idempotency:** to make order creation safe to retry, send a unique
  `Idempotency-Key` header; a repeated key returns the original order rather than
  creating a duplicate. *(Planned — send the header now; today, dedupe on `id`.)*

---

## 3. Order & delivery status

```
GET /api/v1/orders                      (auth: customer) → your orders, newest first
GET /api/v1/orders/{order_id}           (auth: customer) → one order (owner only)
```

Order lifecycle (server-authoritative; the client never sets status):

```
placed → accepted → preparing → ready → assigned → picked_up → out_for_delivery → delivered
                                                                              ↘ cancelled
```

## 4. Cancelling

Cancellation is permitted only while the order is not yet terminal and is subject
to business rules; a cancelled order stops tracking. *(Customer-initiated cancel
endpoint is on the roadmap; admins can cancel via the operations console today.)*

## 5. Delivery-partner assignment

Assignment is **automatic**: when the kitchen marks an order `ready`, the dispatch
engine batches it and assigns/offers it to an eligible online partner. You do not
call an assignment endpoint — poll order status or open the tracking socket.

## 6. Pickup & delivery updates

These transitions are driven by the delivery partner and validated server-side:
`assigned → picked_up → out_for_delivery → delivered` (delivery completes only
after the partner submits the correct `otp_code`). You observe them via status or
tracking; you never post them.

---

## 7. Tracking

### REST snapshot (initial render + recovery)

```
GET /api/v1/orders/{order_id}/tracking  (auth: owning customer)
→ 200 {
  "order_id": 42, "status": "out_for_delivery", "is_trackable": true, "updated_at": "...",
  "mess_name": "Digi Mess Kitchen", "mess_lat": 18.5204, "mess_lng": 73.8567,
  "dropoff_lat": 18.531, "dropoff_lng": 73.8446, "dropoff_text": "Flat 4B",
  "rider_name": "Ravi", "rider_phone": "+91...",
  "rider_location": { "lat": 18.525, "lng": 73.85, "heading": 90, "speed": 4.1,
                       "server_timestamp": "...", "is_stale": false, "age_seconds": 3.2 },
  "eta_minutes": 8, "distance_km": 1.9,
  "timeline": [ { "status": "placed", "label": "Order placed", "state": "done" }, ... ]
}
```

`rider_location.is_stale` / `age_seconds` let you show a "last updated" indicator.
Once the order is terminal the snapshot reports `is_trackable: false` (access revoked).

### WebSocket (live push)

```
WS /api/v1/orders/{order_id}/tracking/ws?token=<JWT>
```
- Auth is via the `token` query parameter (WS clients can't set headers portably).
- **Messages:** `{ "type": "snapshot", "data": <TrackingSnapshot> }` — the same
  object as the REST snapshot.
- The server pushes on connect, on each rider location update, and on a periodic
  timer. It sends a final snapshot and closes when the order is terminal.
- **Close codes:** `4401` unauthorized, `4403` forbidden (not your order),
  `4404` order not found.
- **Reliability:** seed from the REST snapshot, open the socket, and reconnect
  with backoff (hints in `GET /api/v1/config`), falling back to REST polling
  while the socket is down.

---

## 8. Field stability

- Money is always integer **cents**; compute nothing client-side — read the
  server totals.
- Coordinates are decimal degrees (`lat` −90..90, `lng` −180..180).
- Timestamps are ISO-8601 UTC.
- Treat `id`/`order_id` as opaque. Do not depend on internal tables or the
  `is_test` flag; it is managed by the backend and is always `false` for you.

For anything not covered here, the authoritative contract is the live OpenAPI
schema at `/openapi.json`.
