"""Verification-document storage (local disk in dev).

Files are written under ``settings.upload_dir/<rider_id>/`` with a random name.
Only the ``RiderDocument`` row (metadata) is exposed via the API; the raw bytes
are served through an authenticated admin endpoint, never by public URL.
"""
from __future__ import annotations

import os
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import utcnow
from app.models.enums import DocumentStatus
from app.models.rider_document import RiderDocument

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
}
_EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "application/pdf": ".pdf",
}
_ALLOWED_DOC_TYPES = {"license", "id_proof", "vehicle_rc", "insurance", "bank_passbook", "photo", "other"}


def _rider_dir(rider_id: int) -> str:
    path = os.path.join(settings.upload_dir, str(rider_id))
    os.makedirs(path, exist_ok=True)
    return path


def save_upload(
    db: Session, rider_id: int, doc_type: str, upload: UploadFile
) -> RiderDocument:
    doc_type = (doc_type or "other").strip().lower()
    if doc_type not in _ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown document type '{doc_type}'")
    content_type = upload.content_type or "application/octet-stream"
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type; upload a JPG, PNG, WEBP, HEIC or PDF",
        )

    data = upload.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_bytes // (1024 * 1024)}MB limit",
        )

    ext = _EXT_BY_TYPE.get(content_type, "")
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(_rider_dir(rider_id), filename)
    with open(dest, "wb") as fh:
        fh.write(data)

    doc = RiderDocument(
        rider_id=rider_id,
        doc_type=doc_type,
        file_path=dest,
        original_name=(upload.filename or filename)[:255],
        content_type=content_type,
        size_bytes=len(data),
        status=DocumentStatus.submitted,
        uploaded_at=utcnow(),
    )
    db.add(doc)
    db.flush()
    return doc


def list_for_rider(db: Session, rider_id: int) -> list[RiderDocument]:
    return list(
        db.execute(
            select(RiderDocument)
            .where(RiderDocument.rider_id == rider_id)
            .order_by(RiderDocument.id.desc())
        ).scalars()
    )


def get(db: Session, doc_id: int) -> RiderDocument | None:
    return db.get(RiderDocument, doc_id)
