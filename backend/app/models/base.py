"""Shared model helpers: UTC clock and a timestamp mixin.

All datetimes are stored as naive UTC to keep SQLite comparisons consistent
(mixing tz-aware and naive values raises at comparison time).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column


def utcnow() -> datetime:
    """Return the current time as a naive UTC datetime."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def sa_enum(enum_cls: type[PyEnum]) -> SAEnum:
    """A VARCHAR-backed enum column that stores ``.value`` and returns members.

    ``native_enum=False`` keeps it as a plain string column (SQLite/Postgres
    portable) while SQLAlchemy coerces to/from the Python enum on read/write,
    so ORM attributes are always real enum members — never bare strings.
    """
    return SAEnum(
        enum_cls,
        native_enum=False,
        validate_strings=True,
        values_callable=lambda ec: [m.value for m in ec],
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
