"""Admin management of rider shift slots (operations tier)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_admin_permission
from app.database import get_db
from app.models.enums import AdminRole
from app.models.shift import ShiftSlot
from app.models.user import User
from app.schemas.shift import (
    RiderSlotsOut,
    RiderSlotsUpdate,
    ShiftSlotCreate,
    ShiftSlotOut,
    ShiftSlotUpdate,
)
from app.services import audit_service, shift_service

router = APIRouter(prefix="/admin", tags=["admin-shifts"])

_ops = require_admin_permission(AdminRole.operations)
_any_admin = require_admin_permission(
    AdminRole.partner_verification, AdminRole.operations, AdminRole.support
)


def _out(db: Session, slot: ShiftSlot) -> ShiftSlotOut:
    return ShiftSlotOut(**shift_service.slot_out(slot, shift_service.slot_rider_counts(db)))


@router.get("/shift-slots", response_model=list[ShiftSlotOut])
def list_slots(_: User = Depends(_any_admin), db: Session = Depends(get_db)) -> list[ShiftSlotOut]:
    counts = shift_service.slot_rider_counts(db)
    return [ShiftSlotOut(**shift_service.slot_out(s, counts)) for s in shift_service.all_slots(db)]


@router.post("/shift-slots", response_model=ShiftSlotOut, status_code=201)
def create_slot(
    data: ShiftSlotCreate, admin: User = Depends(_ops), db: Session = Depends(get_db)
) -> ShiftSlotOut:
    start, end = shift_service.validate_slot_fields(data.name, data.start_time, data.end_time)
    slot = ShiftSlot(
        name=data.name.strip(),
        start_time=start,
        end_time=end,
        is_active=data.is_active,
        max_riders=data.max_riders,
        sort_order=data.sort_order,
    )
    db.add(slot)
    db.flush()
    audit_service.record(
        db, actor_user_id=admin.id, action="shift_slot_created", target_type="shift_slot",
        target_id=slot.id, detail=f"{slot.name} {start}-{end}",
    )
    db.commit()
    db.refresh(slot)
    return _out(db, slot)


@router.patch("/shift-slots/{slot_id}", response_model=ShiftSlotOut)
def update_slot(
    slot_id: int, data: ShiftSlotUpdate, admin: User = Depends(_ops), db: Session = Depends(get_db)
) -> ShiftSlotOut:
    slot = db.get(ShiftSlot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot not found")
    fields = data.model_dump(exclude_unset=True)
    name = fields.get("name", slot.name)
    start, end = shift_service.validate_slot_fields(
        name, fields.get("start_time", slot.start_time), fields.get("end_time", slot.end_time)
    )
    slot.name = name.strip()
    slot.start_time, slot.end_time = start, end
    if "is_active" in fields:
        slot.is_active = bool(fields["is_active"])
    if "max_riders" in fields:
        slot.max_riders = fields["max_riders"]
    if "sort_order" in fields and fields["sort_order"] is not None:
        slot.sort_order = fields["sort_order"]
    audit_service.record(
        db, actor_user_id=admin.id, action="shift_slot_updated", target_type="shift_slot",
        target_id=slot.id, detail=f"{slot.name} {start}-{end} active={slot.is_active}",
    )
    db.commit()
    db.refresh(slot)
    return _out(db, slot)


@router.delete("/shift-slots/{slot_id}", status_code=204)
def delete_slot(slot_id: int, admin: User = Depends(_ops), db: Session = Depends(get_db)) -> None:
    slot = db.get(ShiftSlot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot not found")
    audit_service.record(
        db, actor_user_id=admin.id, action="shift_slot_deleted", target_type="shift_slot",
        target_id=slot.id, detail=slot.name,
    )
    db.delete(slot)
    db.commit()


@router.get("/partners/{rider_id}/slots", response_model=RiderSlotsOut)
def partner_slots(
    rider_id: int, _: User = Depends(_any_admin), db: Session = Depends(get_db)
) -> RiderSlotsOut:
    user = db.get(User, rider_id)
    if user is None or user.rider_profile is None:
        raise HTTPException(status_code=404, detail="Partner not found")
    return RiderSlotsOut(**shift_service.rider_slots_view(db, rider_id))


@router.put("/partners/{rider_id}/slots", response_model=RiderSlotsOut)
def set_partner_slots(
    rider_id: int,
    data: RiderSlotsUpdate,
    admin: User = Depends(_ops),
    db: Session = Depends(get_db),
) -> RiderSlotsOut:
    user = db.get(User, rider_id)
    if user is None or user.rider_profile is None:
        raise HTTPException(status_code=404, detail="Partner not found")
    shift_service.set_rider_slots(db, rider_id, data.slot_ids)
    audit_service.record(
        db, actor_user_id=admin.id, action="partner_slots_updated", target_type="rider",
        target_id=rider_id, detail=f"slots={sorted(data.slot_ids)}",
    )
    db.commit()
    return RiderSlotsOut(**shift_service.rider_slots_view(db, rider_id))
