"""Declarative base plus the audit + soft-delete mixins applied to every table
(design §3.1)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# SQLite auto-increments only INTEGER PRIMARY KEY (not BIGINT); MySQL uses BIGINT.
BigIntPK = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SoftDeleteMixin:
    # NULL = active. All queries filter `deleted_at IS NULL` (design §3.1).
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)


class PKMixin:
    id: Mapped[int] = mapped_column(BigIntPK, primary_key=True, autoincrement=True)
