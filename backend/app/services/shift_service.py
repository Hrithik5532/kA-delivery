"""Rider shift slots: windows, selection, go-online enforcement and scheduling.

Rules (when ``settings.shift_slots_enforced`` and at least one active slot exists):

* A rider can go online only while one of their selected slots is running.
* When a selected slot starts the scheduler switches the rider online (once per
  window, so a rider who deliberately goes offline mid-slot stays offline).
* When the slot ends the rider is switched offline — unless they are in the
  middle of a delivery, in which case they go offline once it is finished.

Slot times are wall-clock ``HH:MM`` in ``settings.business_timezone`` while the
DB stores naive UTC, so all comparisons happen on tz-aware local datetimes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import utcnow
from app.models.delivery import Delivery
from app.models.enums import DeliveryStatus, UserRole
from app.models.shift import RiderShiftSlot, ShiftSlot
from app.models.user import RiderProfile, User

logger = logging.getLogger(__name__)

_BUSY_DELIVERY_STATUSES = (
    DeliveryStatus.accepted,
    DeliveryStatus.en_route_to_mess,
    DeliveryStatus.picked_up,
    DeliveryStatus.delivering,
)


@dataclass(frozen=True)
class Window:
    slot: ShiftSlot
    start: datetime  # tz-aware, business timezone
    end: datetime

    @property
    def key(self) -> str:
        return f"{self.start.date().isoformat()}:{self.slot.id}"


# --- Time helpers ---------------------------------------------------------

# Fixed offsets for zones without daylight saving, used when the host has no
# IANA timezone database (slim images / missing ``tzdata`` package).
_FIXED_OFFSETS = {
    "Asia/Kolkata": timedelta(hours=5, minutes=30),
    "Asia/Calcutta": timedelta(hours=5, minutes=30),
    "UTC": timedelta(0),
}
_tz_cache: dict[str, object] = {}


def tz():
    name = settings.business_timezone
    cached = _tz_cache.get(name)
    if cached is not None:
        return cached
    try:
        zone = ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        offset = _FIXED_OFFSETS.get(name, timedelta(0))
        logger.warning(
            "Timezone %r not found (install the 'tzdata' package); using fixed UTC%+.1fh",
            name, offset.total_seconds() / 3600,
        )
        zone = timezone(offset, name)
    _tz_cache[name] = zone
    return zone


def local_now(now_utc: datetime | None = None) -> datetime:
    """Business-local tz-aware now. ``now_utc`` is naive UTC (DB convention)."""
    base = (now_utc or utcnow()).replace(tzinfo=timezone.utc)
    return base.astimezone(tz())


def parse_hhmm(value: str) -> tuple[int, int]:
    try:
        h_str, m_str = value.strip().split(":")
        h, m = int(h_str), int(m_str)
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Invalid time '{value}', expected HH:MM") from exc
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError(f"Invalid time '{value}', expected HH:MM")
    return h, m


def _at(day: datetime, hhmm: str) -> datetime:
    h, m = parse_hhmm(hhmm)
    return day.replace(hour=h, minute=m, second=0, microsecond=0)


def _windows_around(slot: ShiftSlot, now: datetime) -> list[Window]:
    """The slot's windows starting yesterday, today and tomorrow (local)."""
    out = []
    for offset in (-1, 0, 1):
        day = (now + timedelta(days=offset)).replace(hour=0, minute=0, second=0, microsecond=0)
        start = _at(day, slot.start_time)
        end = _at(day, slot.end_time)
        if end <= start:  # crosses midnight
            end += timedelta(days=1)
        out.append(Window(slot, start, end))
    return out


def current_window(slot: ShiftSlot, now: datetime) -> Window | None:
    for w in _windows_around(slot, now):
        if w.start <= now < w.end:
            return w
    return None


def next_window(slot: ShiftSlot, now: datetime) -> Window:
    cur = current_window(slot, now)
    if cur is not None:
        return cur
    return min((w for w in _windows_around(slot, now) if w.start > now), key=lambda w: w.start)


def format_label(slot: ShiftSlot) -> str:
    def fmt(hhmm: str) -> str:
        h, m = parse_hhmm(hhmm)
        suffix = "AM" if h < 12 else "PM"
        h12 = h % 12 or 12
        return f"{h12}:{m:02d} {suffix}" if m else f"{h12} {suffix}"

    return f"{fmt(slot.start_time)} – {fmt(slot.end_time)}"


# --- Queries --------------------------------------------------------------

def active_slots(db: Session) -> list[ShiftSlot]:
    return list(
        db.execute(
            select(ShiftSlot)
            .where(ShiftSlot.is_active.is_(True))
            .order_by(ShiftSlot.sort_order, ShiftSlot.start_time, ShiftSlot.id)
        ).scalars()
    )


def all_slots(db: Session) -> list[ShiftSlot]:
    return list(
        db.execute(
            select(ShiftSlot).order_by(ShiftSlot.sort_order, ShiftSlot.start_time, ShiftSlot.id)
        ).scalars()
    )


def enforcement_active(db: Session) -> bool:
    if not settings.shift_slots_enforced:
        return False
    return db.execute(
        select(func.count(ShiftSlot.id)).where(ShiftSlot.is_active.is_(True))
    ).scalar_one() > 0


def selected_slot_ids(db: Session, rider_id: int) -> set[int]:
    return set(
        db.execute(
            select(RiderShiftSlot.slot_id).where(RiderShiftSlot.rider_id == rider_id)
        ).scalars()
    )


def selected_active_slots(db: Session, rider_id: int) -> list[ShiftSlot]:
    return list(
        db.execute(
            select(ShiftSlot)
            .join(RiderShiftSlot, RiderShiftSlot.slot_id == ShiftSlot.id)
            .where(RiderShiftSlot.rider_id == rider_id, ShiftSlot.is_active.is_(True))
            .order_by(ShiftSlot.sort_order, ShiftSlot.start_time)
        ).scalars()
    )


def slot_rider_counts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(RiderShiftSlot.slot_id, func.count(RiderShiftSlot.id)).group_by(RiderShiftSlot.slot_id)
    ).all()
    return {slot_id: count for slot_id, count in rows}


def rider_current_window(
    db: Session, rider_id: int, now_utc: datetime | None = None
) -> Window | None:
    now = local_now(now_utc)
    for slot in selected_active_slots(db, rider_id):
        w = current_window(slot, now)
        if w is not None:
            return w
    return None


def rider_next_window(db: Session, rider_id: int, now_utc: datetime | None = None) -> Window | None:
    now = local_now(now_utc)
    windows = [next_window(s, now) for s in selected_active_slots(db, rider_id)]
    return min(windows, key=lambda w: w.start) if windows else None


def rider_is_busy(db: Session, rider_id: int) -> bool:
    return db.execute(
        select(func.count(Delivery.id)).where(
            Delivery.rider_id == rider_id, Delivery.status.in_(_BUSY_DELIVERY_STATUSES)
        )
    ).scalar_one() > 0


def may_be_online(db: Session, rider_id: int, now_utc: datetime | None = None) -> bool:
    if not enforcement_active(db):
        return True
    return rider_current_window(db, rider_id, now_utc) is not None


def ensure_can_go_online(db: Session, rider_id: int) -> None:
    """Raise 409 with an actionable message when the rider is outside their slots."""
    if may_be_online(db, rider_id):
        return
    slots = selected_active_slots(db, rider_id)
    if not slots:
        raise HTTPException(
            status_code=409,
            detail="Choose a working slot first. You can go online only during your selected slots.",
        )
    nxt = rider_next_window(db, rider_id)
    when = nxt.start.strftime("%I:%M %p").lstrip("0") if nxt else ""
    day = ""
    if nxt is not None and nxt.start.date() != local_now().date():
        day = " tomorrow"
    raise HTTPException(
        status_code=409,
        detail=(
            f"You can go online only during your selected slots. "
            f"Your next slot ({nxt.slot.name}) starts at {when}{day}."
            if nxt
            else "You can go online only during your selected slots."
        ),
    )


# --- Selection --------------------------------------------------------------

def set_rider_slots(db: Session, rider_id: int, slot_ids: list[int]) -> None:
    wanted = set(slot_ids)
    slots = {s.id: s for s in active_slots(db)}
    unknown = wanted - set(slots)
    if unknown:
        raise HTTPException(status_code=400, detail="One or more slots are not available")

    current = selected_slot_ids(db, rider_id)
    counts = slot_rider_counts(db)
    for sid in wanted - current:
        cap = slots[sid].max_riders
        if cap is not None and counts.get(sid, 0) >= cap:
            raise HTTPException(status_code=409, detail=f"Slot '{slots[sid].name}' is full")

    removed = current - wanted
    if removed:
        db.execute(
            delete(RiderShiftSlot).where(
                RiderShiftSlot.rider_id == rider_id, RiderShiftSlot.slot_id.in_(removed)
            )
        )
    for sid in wanted - current:
        db.add(RiderShiftSlot(rider_id=rider_id, slot_id=sid))
    db.flush()

    # If the slot that is running right now was just selected, let the
    # scheduler treat it as a fresh window (auto-online) — but if the running
    # slot was removed, the rider is taken offline on the next reconcile.
    profile = db.execute(
        select(RiderProfile).where(RiderProfile.user_id == rider_id)
    ).scalar_one_or_none()
    if profile is not None:
        reconcile_rider(db, profile)


def rider_slots_view(db: Session, rider_id: int) -> dict:
    now = local_now()
    selected = selected_slot_ids(db, rider_id)
    counts = slot_rider_counts(db)
    items = []
    for slot in active_slots(db):
        cur = current_window(slot, now)
        nxt = next_window(slot, now)
        full = (
            slot.max_riders is not None
            and counts.get(slot.id, 0) >= slot.max_riders
            and slot.id not in selected
        )
        items.append(
            {
                "id": slot.id,
                "name": slot.name,
                "start_time": slot.start_time,
                "end_time": slot.end_time,
                "label": format_label(slot),
                "selected": slot.id in selected,
                "is_running": cur is not None,
                "next_start_at": nxt.start.astimezone(timezone.utc).replace(tzinfo=None),
                "next_end_at": nxt.end.astimezone(timezone.utc).replace(tzinfo=None),
                "is_full": full,
            }
        )
    cur_w = rider_current_window(db, rider_id)
    nxt_w = rider_next_window(db, rider_id)
    enforced = enforcement_active(db)
    return {
        "enforced": enforced,
        "timezone": settings.business_timezone,
        "slots": items,
        "current_slot_id": cur_w.slot.id if cur_w else None,
        "current_slot_ends_at": (
            cur_w.end.astimezone(timezone.utc).replace(tzinfo=None) if cur_w else None
        ),
        "next_slot_id": nxt_w.slot.id if nxt_w else None,
        "next_slot_starts_at": (
            nxt_w.start.astimezone(timezone.utc).replace(tzinfo=None) if nxt_w else None
        ),
        "can_go_online_now": (not enforced) or cur_w is not None,
    }


# --- Scheduling -----------------------------------------------------------

def reconcile_rider(db: Session, profile: RiderProfile, now_utc: datetime | None = None) -> str | None:
    """Apply slot rules to one rider. Returns "online"/"offline" when changed."""
    if not enforcement_active(db) or not profile.is_approved:
        return None
    user = db.get(User, profile.user_id)
    if user is None or not user.is_active or not user.has_role(UserRole.rider):
        if profile.is_online:
            profile.is_online = False
            return "offline"
        return None

    window = rider_current_window(db, profile.user_id, now_utc)
    if window is not None:
        if not profile.is_online and profile.shift_auto_online_key != window.key:
            profile.is_online = True
            profile.last_online_at = now_utc or utcnow()
            profile.shift_auto_online_key = window.key
            return "online"
        if profile.is_online and profile.shift_auto_online_key != window.key:
            # Already online when the window began: mark it handled so a later
            # manual offline is respected.
            profile.shift_auto_online_key = window.key
        return None

    if profile.is_online and not rider_is_busy(db, profile.user_id):
        profile.is_online = False
        return "offline"
    return None


def tick(db: Session, now_utc: datetime | None = None) -> dict[str, int]:
    """Reconcile all approved riders against their slots. Commits if changed."""
    stats = {"online": 0, "offline": 0}
    if not enforcement_active(db):
        return stats
    profiles = db.execute(select(RiderProfile)).scalars().all()
    for profile in profiles:
        changed = reconcile_rider(db, profile, now_utc)
        if changed:
            stats[changed] += 1
    if stats["online"] or stats["offline"]:
        db.commit()
        logger.info("Shift scheduler: %s online, %s offline", stats["online"], stats["offline"])
    return stats


async def run_scheduler() -> None:  # pragma: no cover - background loop
    import asyncio

    from app.database import SessionLocal

    interval = max(15, settings.shift_scheduler_interval_seconds)
    while True:
        try:
            with SessionLocal() as db:
                tick(db)
                # Shift auto-online may have unlocked pending dispatches.
                from app.services import dispatch_service

                dispatch_service.retry_pending_dispatches(db)
                db.commit()
        except Exception:
            logger.exception("Shift scheduler tick failed")
        await asyncio.sleep(interval)


# --- Admin CRUD -----------------------------------------------------------

def normalize_hhmm(value: str) -> str:
    h, m = parse_hhmm(value)
    return f"{h:02d}:{m:02d}"


def validate_slot_fields(name: str, start_time: str, end_time: str) -> tuple[str, str]:
    """Validate and return zero-padded ``(start, end)``."""
    if not name.strip():
        raise HTTPException(status_code=422, detail="Slot name is required")
    try:
        start, end = normalize_hhmm(start_time), normalize_hhmm(end_time)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if start == end:
        raise HTTPException(status_code=422, detail="Start and end time must differ")
    return start, end


def slot_out(slot: ShiftSlot, counts: dict[int, int]) -> dict:
    return {
        "id": slot.id,
        "name": slot.name,
        "start_time": slot.start_time,
        "end_time": slot.end_time,
        "label": format_label(slot),
        "is_active": slot.is_active,
        "max_riders": slot.max_riders,
        "sort_order": slot.sort_order,
        "rider_count": counts.get(slot.id, 0),
    }
