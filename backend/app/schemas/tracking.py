"""Rider location ingestion and tracking snapshot schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import OrderStatus


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    heading: float | None = Field(default=None, ge=0, le=360)
    speed: float | None = Field(default=None, ge=0)
    client_timestamp: datetime


class LocationAccepted(BaseModel):
    accepted: bool
    server_timestamp: datetime
    reason: str | None = None


class RiderMarker(BaseModel):
    lat: float
    lng: float
    heading: float | None = None
    speed: float | None = None
    server_timestamp: datetime
    is_stale: bool
    age_seconds: float


class TrackingSnapshot(BaseModel):
    """Everything the customer tracking screen needs for initial render and
    REST-based recovery after a WebSocket drop.
    """

    order_id: int
    status: OrderStatus
    is_trackable: bool
    updated_at: datetime

    mess_name: str
    mess_lat: float
    mess_lng: float
    dropoff_lat: float
    dropoff_lng: float
    dropoff_text: str

    rider_name: str | None = None
    rider_phone: str | None = None
    rider_location: RiderMarker | None = None

    eta_minutes: float | None = None
    distance_km: float | None = None

    # Ordered lifecycle for the progress timeline.
    timeline: list[dict] = []
