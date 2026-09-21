"""Doorstep handover screen data, OTP verification and delivery photos."""
from __future__ import annotations

import os
import uuid

from fastapi import HTTPException, UploadFile

from app.config import settings
from app.models.base import utcnow
from app.models.delivery import Delivery
from app.models.mess import Mess
from app.models.order import Order
from app.models.user import User
from app.services.otp_service import otp_is_expired, otp_matches

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
_EXT = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".heic": "image/heic"}
DEFAULT_INSTRUCTIONS = (
    "Contactless handover requested: Hand over package at doorstep, ask customer for delivery OTP."
)
OTP_VERIFY_TTL_SECONDS = 1800


def _ticket_ref(order_id: int) -> str:
    return f"#DM-{8800 + order_id}"


def _handover_type_label(handover_type: str) -> str:
    return {
        "doorstep": "Doorstep Handover",
        "direct": "Direct Handover",
        "reception": "Reception Handover",
    }.get(handover_type, "Doorstep Handover")


def ensure_handover_defaults(delivery: Delivery, order: Order) -> None:
    if not delivery.handover_type:
        delivery.handover_type = "doorstep"
    if not delivery.handover_instructions:
        if order.is_test:
            delivery.handover_instructions = DEFAULT_INSTRUCTIONS
        else:
            delivery.handover_instructions = DEFAULT_INSTRUCTIONS
    if not delivery.priority_note:
        delivery.priority_note = "Priority Note"


def build_handover(
    delivery: Delivery,
    order: Order,
    mess: Mess | None,
    customer: User | None,
) -> dict:
    ensure_handover_defaults(delivery, order)
    return {
        "delivery_id": delivery.id,
        "order_id": order.id,
        "ticket_ref": _ticket_ref(order.id),
        "phase_label": "HANDOVER",
        "handover_type": delivery.handover_type,
        "handover_type_label": _handover_type_label(delivery.handover_type),
        "priority_note": delivery.priority_note,
        "instructions": delivery.handover_instructions,
        "customer_name": customer.full_name if customer else "Customer",
        "address_text": order.address_text,
        "mess_name": mess.name if mess else "Kitchen",
        "otp_verified": _is_otp_verified(delivery),
        "has_photo": bool(delivery.delivery_photo_path),
        "photo_name": delivery.delivery_photo_name,
    }


def _is_otp_verified(delivery: Delivery) -> bool:
    if not delivery.otp_verified_at:
        return False
    elapsed = (utcnow() - delivery.otp_verified_at).total_seconds()
    return elapsed < OTP_VERIFY_TTL_SECONDS


def verify_otp(delivery: Delivery, order: Order, otp: str) -> dict:
    if not otp_matches(otp, order.otp_code):
        raise HTTPException(status_code=400, detail="Incorrect delivery OTP")
    if otp_is_expired(otp, order.otp_expires_at):
        raise HTTPException(status_code=400, detail="Delivery OTP has expired")
    delivery.otp_verified_at = utcnow()
    return {"verified": True, "message": "OTP verified successfully"}


def _photo_dir(delivery_id: int) -> str:
    path = os.path.join(settings.upload_dir, "delivery_photos", str(delivery_id))
    os.makedirs(path, exist_ok=True)
    return path


def save_delivery_photo(delivery: Delivery, upload: UploadFile) -> dict:
    content_type = upload.content_type or "application/octet-stream"
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, WEBP or HEIC image")
    data = upload.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File exceeds upload limit")
    ext = ".jpg"
    for e in _EXT:
        if content_type == _EXT[e]:
            ext = e
            break
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(_photo_dir(delivery.id), filename)
    with open(dest, "wb") as fh:
        fh.write(data)
    delivery.delivery_photo_path = dest
    delivery.delivery_photo_name = (upload.filename or filename)[:255]
    return {
        "has_photo": True,
        "photo_name": delivery.delivery_photo_name,
    }


def assert_otp_ready(delivery: Delivery, order: Order, otp: str | None) -> None:
    if _is_otp_verified(delivery):
        return
    if not otp:
        raise HTTPException(status_code=400, detail="Verify OTP first")
    if not otp_matches(otp, order.otp_code):
        raise HTTPException(status_code=400, detail="Incorrect delivery OTP")
    if otp_is_expired(otp, order.otp_expires_at):
        raise HTTPException(status_code=400, detail="Delivery OTP has expired")
    delivery.otp_verified_at = utcnow()
