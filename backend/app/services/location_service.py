"""Rider location ingestion, validation and freshness checks."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import utcnow
from app.models.tracking import RiderLocation
from app.models.user import RiderProfile
from app.services.eta_service import haversine_m


@dataclass
class IngestResult:
    accepted: bool
    reason: str | None
    server_timestamp: datetime
    location: RiderLocation | None


# Allowable clock skew between device and server before a timestamp is suspect.
_FUTURE_SKEW = timedelta(seconds=60)
_MAX_AGE = timedelta(minutes=5)


def latest_location(db: Session, rider_id: int) -> RiderLocation | None:
    return db.execute(
        select(RiderLocation)
        .where(RiderLocation.rider_id == rider_id)
        .order_by(desc(RiderLocation.server_timestamp))
        .limit(1)
    ).scalar_one_or_none()


def is_stale(location: RiderLocation, now: datetime | None = None) -> bool:
    now = now or utcnow()
    age = (now - location.server_timestamp).total_seconds()
    return age > settings.location_stale_seconds


def age_seconds(location: RiderLocation, now: datetime | None = None) -> float:
    now = now or utcnow()
    return max(0.0, (now - location.server_timestamp).total_seconds())


def validate_and_store(
    db: Session,
    rider_id: int,
    order_id: int | None,
    *,
    lat: float,
    lng: float,
    client_timestamp: datetime,
    accuracy: float | None = None,
    heading: float | None = None,
    speed: float | None = None,
) -> IngestResult:
    """Validate a reported position and, if plausible, persist it.

    Coordinate ranges are validated by the schema. Here we guard timestamps,
    ownership-driven context (order_id is passed by the caller after an
    ownership check) and physically implausible jumps.
    """
    now = utcnow()
    client_ts = _naive(client_timestamp)

    if client_ts > now + _FUTURE_SKEW:
        return IngestResult(False, "timestamp_in_future", now, None)
    if now - client_ts > _MAX_AGE:
        return IngestResult(False, "timestamp_too_old", now, None)

    prev = latest_location(db, rider_id)
    if prev is not None:
        dist_m = haversine_m(prev.lat, prev.lng, lat, lng)
        dt = (client_ts - prev.client_timestamp).total_seconds()
        if dt > 0 and dist_m / dt > settings.location_max_speed_mps:
            return IngestResult(False, "implausible_speed", now, None)
        if dist_m > settings.location_max_jump_meters and 0 <= dt < 5:
            return IngestResult(False, "implausible_jump", now, None)

    loc = RiderLocation(
        rider_id=rider_id,
        order_id=order_id,
        lat=lat,
        lng=lng,
        accuracy=accuracy,
        heading=heading,
        speed=speed,
        client_timestamp=client_ts,
        server_timestamp=now,
    )
    db.add(loc)

    # Denormalise last position for dispatch eligibility.
    profile = db.execute(
        select(RiderProfile).where(RiderProfile.user_id == rider_id)
    ).scalar_one_or_none()
    if profile is not None:
        profile.last_lat = lat
        profile.last_lng = lng

    _prune_history(db, rider_id)
    return IngestResult(True, None, now, loc)


def _prune_history(db: Session, rider_id: int) -> None:
    """Keep only the most recent ``MAX_LOCATION_HISTORY`` rows per rider."""
    keep = settings.max_location_history
    ids = db.execute(
        select(RiderLocation.id)
        .where(RiderLocation.rider_id == rider_id)
        .order_by(desc(RiderLocation.server_timestamp))
        .offset(keep)
    ).scalars().all()
    if ids:
        for old in db.execute(
            select(RiderLocation).where(RiderLocation.id.in_(ids))
        ).scalars():
            db.delete(old)


def _naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt
