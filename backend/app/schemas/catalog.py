"""Mess, menu and address schemas."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    category: str
    price_cents: int
    is_available: bool
    image_url: str | None = None


class MessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    address_text: str
    lat: float
    lng: float
    is_open: bool
    rating: float
    delivery_fee_cents: int
    distance_km: float | None = None


class AddressIn(BaseModel):
    label: str = Field(default="Home", max_length=64)
    line1: str = Field(min_length=1, max_length=255)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    is_default: bool = False


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    line1: str
    lat: float
    lng: float
    is_default: bool
