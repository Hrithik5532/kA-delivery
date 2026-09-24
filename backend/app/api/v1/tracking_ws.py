"""Authenticated, order-scoped WebSocket for live tracking.

Auth is via a ``token`` query parameter (WebSocket clients cannot set an
Authorization header portably). The socket pushes a fresh snapshot on connect,
whenever a location/state change is published for the order, and on a periodic
timer so staleness and status changes always surface. When the order reaches a
terminal state the socket sends a final snapshot (tracking revoked) and closes.
"""
from __future__ import annotations

import asyncio

import jwt
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.database import SessionLocal
from app.models.enums import TERMINAL_ORDER_STATUSES
from app.models.order import Order
from app.models.user import User
from app.config import settings
from app.services import tracking_service
from app.services.ws_manager import manager

router = APIRouter(tags=["tracking"])

# Custom close codes.
_CLOSE_UNAUTHORIZED = 4401
_CLOSE_FORBIDDEN = 4403
_CLOSE_NOT_FOUND = 4404


def _load_user(token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    role = payload.get("role")
    if sub is None or role is None:
        return None
    with SessionLocal() as db:
        user = db.get(User, int(sub))
        if user is None or not user.is_active or role not in user.role_list:
            return None
        return user


def _build_snapshot_dict(order_id: int) -> dict | None:
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if order is None:
            return None
        return tracking_service.build_snapshot(db, order).model_dump(mode="json")


def _authorize(order_id: int, user_id: int) -> str:
    """Return 'ok', 'not_found', or 'forbidden'."""
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        if order is None:
            return "not_found"
        return "ok" if order.customer_id == user_id else "forbidden"


@router.websocket("/orders/{order_id}/tracking/ws")
async def tracking_ws(
    websocket: WebSocket,
    order_id: int,
    token: str | None = Query(default=None),
) -> None:
    user = await asyncio.to_thread(_load_user, token)
    if user is None:
        await websocket.close(code=_CLOSE_UNAUTHORIZED)
        return

    authz = await asyncio.to_thread(_authorize, order_id, user.id)
    if authz == "not_found":
        await websocket.close(code=_CLOSE_NOT_FOUND)
        return
    if authz != "ok":
        await websocket.close(code=_CLOSE_FORBIDDEN)
        return

    await websocket.accept()
    event = manager.subscribe(order_id)
    try:
        while True:
            snapshot = await asyncio.to_thread(_build_snapshot_dict, order_id)
            if snapshot is None:
                break
            await websocket.send_json({"type": "snapshot", "data": snapshot})

            # Stop tracking once the order is terminal (access revoked).
            if snapshot["status"] in {s.value for s in TERMINAL_ORDER_STATUSES}:
                break

            try:
                await asyncio.wait_for(
                    event.wait(), timeout=settings.location_update_interval_seconds
                )
            except (asyncio.TimeoutError, TimeoutError):
                pass
            event.clear()
    except WebSocketDisconnect:
        pass
    except Exception:
        # Any send failure (client vanished) ends the stream cleanly.
        pass
    finally:
        manager.unsubscribe(order_id, event)
        try:
            await websocket.close()
        except Exception:
            pass
