"""Customer saved-address management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_customer
from app.database import get_db
from app.models.user import Address, User
from app.schemas.catalog import AddressIn, AddressOut

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.get("", response_model=list[AddressOut])
def list_addresses(
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> list[AddressOut]:
    rows = db.execute(
        select(Address).where(Address.user_id == user.id)
    ).scalars().all()
    return [AddressOut.model_validate(a) for a in rows]


@router.post("", response_model=AddressOut, status_code=201)
def create_address(
    data: AddressIn,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> AddressOut:
    if data.is_default:
        for existing in db.execute(
            select(Address).where(Address.user_id == user.id)
        ).scalars():
            existing.is_default = False
    address = Address(user_id=user.id, **data.model_dump())
    db.add(address)
    db.commit()
    db.refresh(address)
    return AddressOut.model_validate(address)


@router.delete("/{address_id}", status_code=204)
def delete_address(
    address_id: int,
    user: User = Depends(require_customer),
    db: Session = Depends(get_db),
) -> None:
    address = db.get(Address, address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(status_code=404, detail="Address not found")
    db.delete(address)
    db.commit()
