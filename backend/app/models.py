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
    Integer,
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
    # Set when staff hand out a generated password; the portal makes the owner
    # choose their own before they can use the rest of their login.
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
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


class FeedItem(Base, PKMixin, TimestampMixin, SoftDeleteMixin):
    """The farm's feed catalogue — what the cattle eat and what it costs.

    Staff maintain it in the admin ERP; the public donate form lists the active
    items so a donor picks real feed at the farm's own rate instead of typing
    free text. Rates are copied onto a donation when it is made, so editing an
    item here never rewrites a receipt that was already issued."""

    __tablename__ = "feed_items"
    feed_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))              # English / default
    name_hi: Mapped[str | None] = mapped_column(String(120), nullable=True)  # हिन्दी
    name_ta: Mapped[str | None] = mapped_column(String(120), nullable=True)  # தமிழ்
    # Matches the donation types, so a donation inherits its item's category.
    category: Mapped[str] = mapped_column(String(32), index=True)
    unit: Mapped[str] = mapped_column(String(16))               # kg/quintal/bag/bundle/piece
    rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0)  # ₹ per unit
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Inactive items stay for history but drop off the public donate form.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Donor(Base, PKMixin, TimestampMixin, SoftDeleteMixin):
    """The donor registry — one row per person who has given feed, however many
    times. Public pledges are matched onto an existing donor by phone, then
    email, then name, so a repeat giver accumulates against a single record
    instead of creating a new one each time."""

    __tablename__ = "donors"
    donor_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    # Consent to be named on the public donors wall. Off unless the donor ticks
    # the box on the pledge form — nobody is published by default, and donors
    # already on file stay unlisted until they say otherwise.
    show_publicly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Normalised match keys — `phone`/`email` keep whatever the donor typed for
    # display, these are what repeat-donor lookup compares against.
    phone_key: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    email_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    name_key: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    donations: Mapped[list["Donation"]] = relationship(back_populates="donor")


class ReceiptCounter(Base):
    """Per-financial-year receipt sequence, so numbers run 0001, 0002, ...
    within each year. Allocated inside the donation's own transaction."""

    __tablename__ = "receipt_counters"
    financial_year: Mapped[str] = mapped_column(String(9), primary_key=True)  # "2026-27"
    last_number: Mapped[int] = mapped_column(Integer, default=0)


class Donation(Base, PKMixin, TimestampMixin):
    """Public in-kind feed donations — donors pledge green fodder, grass, hay or
    other food items for the cattle. Submitted from the public website; triaged
    by staff in the admin ERP.

    No money changes hands: `amount` is the *indicative* value of the goods
    given, derived from the farm rate card (app/core/rates.py) so the donor can
    be thanked with a receipt showing what their contribution was worth."""

    __tablename__ = "donations"
    donor_id: Mapped[int | None] = mapped_column(ForeignKey("donors.id"), nullable=True, index=True)
    # Which catalogue item was given, when the donor picked one. The item's name
    # and rate are still copied onto the row below so the receipt is immutable.
    feed_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("feed_items.id"), nullable=True, index=True
    )
    donor_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # green_fodder / dry_grass / hay / feed / mineral / other
    donation_type: Mapped[str] = mapped_column(String(32))
    item: Mapped[str | None] = mapped_column(String(160), nullable=True)
    quantity: Mapped[str | None] = mapped_column(String(80), nullable=True)  # display, e.g. "50 kg"
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new/acknowledged/received

    # ---- Receipt / valuation ----
    receipt_no: Mapped[str | None] = mapped_column(String(32), unique=True, index=True, nullable=True)
    financial_year: Mapped[str | None] = mapped_column(String(9), nullable=True, index=True)
    # Unguessable id for the donor's public receipt link (receipt_no is sequential).
    public_token: Mapped[str | None] = mapped_column(String(32), unique=True, index=True, nullable=True)
    quantity_value: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(16), nullable=True)  # kg/quintal/bag/bundle/piece
    unit_rate: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)  # ₹ per entered unit
    amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    donor: Mapped[Donor | None] = relationship(back_populates="donations")


class CattlePlacement(Base, PKMixin, TimestampMixin):
    """One continuous stay of an animal with an owner — the billing history.

    Rent is charged per cattle per day, so an invoice cannot be built from the
    cattle table alone: it has to know *which days* each animal was on the farm
    and whose it was. A row opens when an animal arrives (or comes back into a
    billable status), and closes the day it leaves, is sold, dies, or moves to
    another owner. `end_date` is the last billable day, inclusive; NULL means
    the animal is still here.
    """

    __tablename__ = "cattle_placements"
    __table_args__ = (
        Index("ix_placement_owner_dates", "owner_id", "start_date", "end_date"),
    )

    cattle_id: Mapped[int] = mapped_column(ForeignKey("cattle.id"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Why the stay ended, for the audit trail: sold / deceased / transferred /
    # removed / dry (left billable status).
    end_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)


class RentInvoice(Base, PKMixin, TimestampMixin):
    """A month's cattle rent for one owner.

    `rate_per_day` and every line are frozen at generation time, so a later
    change to the farm's rate never rewrites an invoice already sent.
    """

    __tablename__ = "rent_invoices"
    __table_args__ = (
        UniqueConstraint("owner_id", "period_start", name="uq_rent_owner_period"),
        Index("ix_rent_period", "period_start", "period_end"),
    )

    invoice_no: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    financial_year: Mapped[str] = mapped_column(String(9), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)          # inclusive
    issued_on: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    rate_per_day: Mapped[float] = mapped_column(Numeric(10, 2))
    cattle_days: Mapped[int] = mapped_column(Integer, default=0)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    # draft -> sent -> paid, or void
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    email_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Unguessable id for the owner's emailed invoice link.
    public_token: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    owner: Mapped[Owner] = relationship()
    lines: Mapped[list["RentInvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", lazy="selectin"
    )


class RentInvoiceLine(Base, PKMixin):
    """One animal's share of an invoice. Tag and name are snapshotted so the
    invoice still reads correctly after the animal is sold or renamed."""

    __tablename__ = "rent_invoice_lines"
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("rent_invoices.id", ondelete="CASCADE"), index=True
    )
    cattle_id: Mapped[int | None] = mapped_column(ForeignKey("cattle.id"), nullable=True)
    tag_number: Mapped[str] = mapped_column(String(32))
    name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    animal_type: Mapped[str] = mapped_column(String(16))
    from_date: Mapped[date] = mapped_column(Date)
    to_date: Mapped[date] = mapped_column(Date)
    days: Mapped[int] = mapped_column(Integer)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    # "joined 12 Aug" / "sold 3 Aug" — why a line is a part month.
    note: Mapped[str | None] = mapped_column(String(80), nullable=True)

    invoice: Mapped[RentInvoice] = relationship(back_populates="lines")


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
