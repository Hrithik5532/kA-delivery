"""Cart, checkout and order schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrderStatus, PaymentStatus


class CartItemIn(BaseModel):
    menu_item_id: int
    quantity: int = Field(ge=1, le=50)


class CheckoutRequest(BaseModel):
    mess_id: int
    items: list[CartItemIn] = Field(min_length=1)


class CheckoutLine(BaseModel):
    menu_item_id: int
    name: str
    unit_price_cents: int
    quantity: int
    line_total_cents: int


class CheckoutResponse(BaseModel):
    """Server-computed price breakdown. Clients must not compute totals."""

    mess_id: int
    lines: list[CheckoutLine]
    subtotal_cents: int
    delivery_fee_cents: int
    tax_cents: int
    total_cents: int


class PlaceOrderRequest(BaseModel):
    mess_id: int
    items: list[CartItemIn] = Field(min_length=1)
    address_id: int | None = None
    # Inline address (used when the customer has no saved address).
    address_text: str | None = None
    address_lat: float | None = Field(default=None, ge=-90, le=90)
    address_lng: float | None = Field(default=None, ge=-180, le=180)
    payment_method: str = "cod"


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name_snapshot: str
    unit_price_cents: int
    quantity: int
    line_total_cents: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mess_id: int
    status: OrderStatus
    is_test: bool = False
    test_note: str | None = None
    address_text: str
    address_lat: float
    address_lng: float
    subtotal_cents: int
    delivery_fee_cents: int
    tax_cents: int
    total_cents: int
    payment_status: PaymentStatus
    payment_method: str
    created_at: datetime
    delivered_at: datetime | None = None
    items: list[OrderItemOut] = []
    # OTP is only surfaced to the owning customer (populated by the endpoint).
    otp_code: str | None = None
