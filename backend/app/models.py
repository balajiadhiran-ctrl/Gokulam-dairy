"""SQLAlchemy ORM models for the core slice: Identity/RBAC + Owners + Cattle +
Milk Production. Mirrors the tables in design §3.3. Additional domains
(veterinary, finance, ledger, inventory...) follow the same conventions and can
be added as further modules are built out.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Table,
    Column,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, PKMixin, SoftDeleteMixin, TimestampMixin

# ---------------------------------------------------------------------------
# Identity & Access (design §3.3)
# ---------------------------------------------------------------------------

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id"), primary_key=True),
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)


class Permission(Base, PKMixin):
    __tablename__ = "permissions"
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # e.g. milk.create
    module: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(String(255), default="")


class Role(Base, PKMixin):
    __tablename__ = "roles"
    name: Mapped[str] = mapped_column(String(64), unique=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions, lazy="selectin"
    )


class User(Base, PKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("owners.id"), nullable=True
    )  # set for owner-portal logins
    roles: Mapped[list[Role]] = relationship(secondary=user_roles, lazy="selectin")

    @property
    def permission_codes(self) -> list[str]:
        codes: set[str] = set()
        for role in self.roles:
            for perm in role.permissions:
                codes.add(perm.code)
        return sorted(codes)


# ---------------------------------------------------------------------------
# Farm Operations (design §3.3)
# ---------------------------------------------------------------------------


class Owner(Base, PKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "owners"
    owner_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))  # English / default
    name_hi: Mapped[str | None] = mapped_column(String(120), nullable=True)  # हिन्दी
    name_ta: Mapped[str | None] = mapped_column(String(120), nullable=True)  # தமிழ்
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    village: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    cattle: Mapped[list["Cattle"]] = relationship(back_populates="owner")


class Cattle(Base, PKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "cattle"
    tag_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    animal_type: Mapped[str] = mapped_column(String(16))  # cow / buffalo
    breed: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gender: Mapped[str] = mapped_column(String(10), default="female")
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active/dry/sold/deceased
    photo_path: Mapped[str | None] = mapped_column(String(255), nullable=True)  # relative to /media
    owner: Mapped[Owner] = relationship(back_populates="cattle")

    @property
    def photo_url(self) -> str | None:
        return f"/media/{self.photo_path}" if self.photo_path else None


class Donation(Base, PKMixin, TimestampMixin):
    """Public in-kind feed donations — donors pledge green fodder, grass, hay or
    other food items for the cattle. Submitted from the public website; triaged
    by staff in the admin ERP."""

    __tablename__ = "donations"
    donor_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # green_fodder / dry_grass / hay / feed / mineral / other
    donation_type: Mapped[str] = mapped_column(String(32))
    item: Mapped[str | None] = mapped_column(String(160), nullable=True)
    quantity: Mapped[str | None] = mapped_column(String(80), nullable=True)  # e.g. "50 kg"
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new/acknowledged/received


class MilkProduction(Base, PKMixin, TimestampMixin, SoftDeleteMixin):
    """Twice-daily yield capture. UNIQUE(cattle_id, prod_date) prevents double
    entry (design §3.4). total_litres is computed in the service layer for
    SQLite portability (MySQL would use a STORED generated column)."""

    __tablename__ = "milk_production"
    __table_args__ = (
        UniqueConstraint("cattle_id", "prod_date", name="uq_milk_cattle_date"),
        Index("ix_milk_owner_date", "owner_id", "prod_date"),
        Index("ix_milk_date", "prod_date"),
    )

    cattle_id: Mapped[int] = mapped_column(ForeignKey("cattle.id"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"), index=True)
    prod_date: Mapped[date] = mapped_column(Date)
    morning_litres: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    evening_litres: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    total_litres: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
