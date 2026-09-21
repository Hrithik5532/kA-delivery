"""Shared OTP generation and validation (dev-friendly fixed code)."""
from __future__ import annotations

from datetime import datetime

from app.config import settings
from app.models.base import utcnow


def generate_otp() -> str:
    return settings.default_otp


def otp_matches(provided: str, expected: str | None) -> bool:
    code = provided.strip()
    if code == settings.default_otp:
        return True
    return expected is not None and code == expected.strip()


def otp_is_expired(provided: str, expires_at: datetime | None) -> bool:
    """Return True when the OTP is past expiry (default dev OTP never expires)."""
    if provided.strip() == settings.default_otp:
        return False
    if expires_at is None:
        return False
    return expires_at < utcnow()
