"""Shift slot schemas (rider selection + admin management)."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

_HHMM = r"^\d{1,2}:\d{2}$"


class RiderSlotOut(BaseModel):
    id: int
    name: str
    start_time: str
    end_time: str
    label: str
    selected: bool
    is_running: bool
    # Naive UTC (same convention as every other timestamp in the API).
    next_start_at: datetime
    next_end_at: datetime
    is_full: bool = False


class RiderSlotsOut(BaseModel):
    enforced: bool
    timezone: str
    slots: list[RiderSlotOut]
    current_slot_id: int | None = None
    current_slot_ends_at: datetime | None = None
    next_slot_id: int | None = None
    next_slot_starts_at: datetime | None = None
    can_go_online_now: bool


class RiderSlotsUpdate(BaseModel):
    slot_ids: list[int] = Field(default_factory=list, max_length=24)


class ShiftSlotOut(BaseModel):
    id: int
    name: str
    start_time: str
    end_time: str
    label: str
    is_active: bool
    max_riders: int | None = None
    sort_order: int = 0
    rider_count: int = 0


class ShiftSlotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    start_time: str = Field(pattern=_HHMM)
    end_time: str = Field(pattern=_HHMM)
    is_active: bool = True
    max_riders: int | None = Field(default=None, ge=1)
    sort_order: int = 0


class ShiftSlotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    start_time: str | None = Field(default=None, pattern=_HHMM)
    end_time: str | None = Field(default=None, pattern=_HHMM)
    is_active: bool | None = None
    max_riders: int | None = Field(default=None, ge=1)
    sort_order: int | None = None
