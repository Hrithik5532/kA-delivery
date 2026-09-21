"""Mess discovery and menu browsing (customer-facing, read-only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.mess import Mess, MenuItem
from app.models.user import User
from app.schemas.catalog import MenuItemOut, MessOut
from app.services.eta_service import haversine_km

router = APIRouter(prefix="/messes", tags=["messes"])


@router.get("", response_model=list[MessOut])
def list_messes(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MessOut]:
    """List open messes, annotated with distance when a location is given and
    sorted nearest-first.
    """
    messes = db.execute(select(Mess).where(Mess.is_open.is_(True))).scalars().all()
    out: list[MessOut] = []
    for mess in messes:
        item = MessOut.model_validate(mess)
        if lat is not None and lng is not None:
            item.distance_km = round(haversine_km(lat, lng, mess.lat, mess.lng), 2)
        out.append(item)
    if lat is not None and lng is not None:
        out.sort(key=lambda m: m.distance_km if m.distance_km is not None else 1e9)
    return out


@router.get("/{mess_id}/menu", response_model=list[MenuItemOut])
def mess_menu(
    mess_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MenuItemOut]:
    mess = db.get(Mess, mess_id)
    if mess is None:
        raise HTTPException(status_code=404, detail="Mess not found")
    items = db.execute(
        select(MenuItem).where(MenuItem.mess_id == mess_id)
    ).scalars().all()
    return [MenuItemOut.model_validate(i) for i in items]
