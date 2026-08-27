"""Pydantic request/response contracts (design §5)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth ----------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    owner_id: int | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    permissions: list[str]
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


# ---- Owners --------------------------------------------------------------
class OwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_code: str
    name: str
    name_hi: str | None = None
    name_ta: str | None = None
    mobile: str | None = None
    email: str | None = None
    village: str | None = None
    status: str


class BreedCount(BaseModel):
    breed: str
    count: int


class OwnerSummary(OwnerOut):
    """Owner plus aggregated herd stats for the owners overview cards."""
    cattle_count: int = 0
    cow_count: int = 0
    buffalo_count: int = 0
    breeds: list[BreedCount] = []


class OwnerCreate(BaseModel):
    owner_code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    name_hi: str | None = Field(default=None, max_length=120)
    name_ta: str | None = Field(default=None, max_length=120)
    mobile: str | None = Field(default=None, max_length=20)
    email: str | None = None
    village: str | None = Field(default=None, max_length=120)
    status: str = "active"


class OwnerUpdate(BaseModel):
    # All optional — PATCH semantics; only provided fields are changed.
    name: str | None = Field(default=None, min_length=1, max_length=120)
    name_hi: str | None = Field(default=None, max_length=120)
    name_ta: str | None = Field(default=None, max_length=120)
    mobile: str | None = Field(default=None, max_length=20)
    email: str | None = None
    village: str | None = Field(default=None, max_length=120)
    status: str | None = None


# ---- Cattle --------------------------------------------------------------
class CattleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tag_number: str
    name: str | None = None
    animal_type: str
    breed: str | None = None
    gender: str
    dob: date | None = None
    owner_id: int
    status: str
    photo_url: str | None = None


class CattleCreate(BaseModel):
    tag_number: str = Field(min_length=1, max_length=32)
    name: str | None = Field(default=None, max_length=80)
    animal_type: str = Field(pattern="^(cow|buffalo)$")
    breed: str | None = Field(default=None, max_length=64)
    gender: str = Field(default="female", pattern="^(female|male)$")
    dob: date | None = None
    owner_id: int
    status: str = "active"


class CattleUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    animal_type: str | None = Field(default=None, pattern="^(cow|buffalo)$")
    breed: str | None = Field(default=None, max_length=64)
    gender: str | None = Field(default=None, pattern="^(female|male)$")
    dob: date | None = None
    owner_id: int | None = None
    status: str | None = Field(default=None, pattern="^(active|dry|sold|deceased)$")


# ---- Milk Production -----------------------------------------------------
class MilkCreate(BaseModel):
    cattle_id: int
    prod_date: date
    morning_litres: float = Field(ge=0, le=60)
    evening_litres: float = Field(ge=0, le=60)
    # Optional client-generated id for idempotent offline sync (design §5.1)
    client_uuid: str | None = None


class MilkBulkCreate(BaseModel):
    records: list[MilkCreate]


class MilkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cattle_id: int
    owner_id: int
    prod_date: date
    morning_litres: float
    evening_litres: float
    total_litres: float
    recorded_by: int | None = None
    created_at: datetime


class MilkBulkResult(BaseModel):
    created: list[MilkOut]
    duplicates: list[str]  # human-readable messages for skipped duplicates
    errors: list[str]


class Page(BaseModel):
    items: list[MilkOut]
    total: int
    page: int
    page_size: int
    pages: int


class MilkAnalyticsRow(BaseModel):
    key: str            # owner name or animal tag
    total_litres: float
    days: int


class ApiError(BaseModel):
    type: str
    title: str
    status: int
    detail: str


# ---- Donations (public in-kind feed donations) ---------------------------
DONATION_TYPES = ("green_fodder", "dry_grass", "hay", "feed", "mineral", "other")
DONATION_TYPE_RE = "^(green_fodder|dry_grass|hay|feed|mineral|other)$"
UNIT_RE = "^(kg|quintal|bag|bundle|piece)$"


# ---- Feed catalogue (what the cattle eat and what it costs) --------------
class FeedItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    name_hi: str | None = Field(default=None, max_length=120)
    name_ta: str | None = Field(default=None, max_length=120)
    category: str = Field(pattern=DONATION_TYPE_RE)
    unit: str = Field(pattern=UNIT_RE)
    rate: Decimal = Field(ge=0, le=Decimal("1000000"))  # ₹ per unit
    notes: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class FeedItemCreate(FeedItemBase):
    """`feed_code` is generated from the row id unless one is supplied."""
    feed_code: str | None = Field(default=None, max_length=32)


class FeedItemUpdate(BaseModel):
    # PATCH semantics — only the fields sent are changed.
    name: str | None = Field(default=None, min_length=1, max_length=120)
    name_hi: str | None = Field(default=None, max_length=120)
    name_ta: str | None = Field(default=None, max_length=120)
    category: str | None = Field(default=None, pattern=DONATION_TYPE_RE)
    unit: str | None = Field(default=None, pattern=UNIT_RE)
    rate: Decimal | None = Field(default=None, ge=0, le=Decimal("1000000"))
    notes: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class FeedItemOut(FeedItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    feed_code: str
    created_at: datetime


# ---- Donations -----------------------------------------------------------
class DonationCreate(BaseModel):
    donor_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    # Either pick a catalogue item, or describe it yourself with a type + item
    # name. A catalogue item supplies the category, unit and rate.
    feed_item_id: int | None = None
    donation_type: str = Field(pattern=DONATION_TYPE_RE)
    item: str | None = Field(default=None, max_length=160)
    # Structured quantity drives the receipt total; `quantity` is the display
    # string and is composed server-side when value + unit are supplied.
    quantity_value: Decimal | None = Field(default=None, gt=0, le=Decimal("100000"))
    unit: str | None = Field(default=None, pattern=UNIT_RE)
    quantity: str | None = Field(default=None, max_length=80)
    message: str | None = Field(default=None, max_length=500)
    # Ticking this asks to be named on the public donors wall. It can only turn
    # listing on; removing a name is done by the farm, so a donor who consented
    # once is never silently unlisted by a later pledge.
    show_publicly: bool = False


class DonationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    donor_id: int | None = None
    feed_item_id: int | None = None
    donor_name: str
    phone: str | None = None
    email: str | None = None
    donation_type: str
    item: str | None = None
    quantity: str | None = None
    quantity_value: Decimal | None = None
    unit: str | None = None
    unit_rate: Decimal | None = None
    amount: Decimal | None = None
    receipt_no: str | None = None
    financial_year: str | None = None
    public_token: str | None = None
    message: str | None = None
    status: str
    created_at: datetime


class DonationStatusUpdate(BaseModel):
    """Admin triage. Status alone is the common case; the valuation fields let
    staff price a donation the rate card could not (e.g. `other`, or `piece`)
    or correct one it got wrong. Any field left out is untouched."""

    status: str | None = Field(default=None, pattern="^(new|acknowledged|received)$")
    item: str | None = Field(default=None, max_length=160)
    feed_item_id: int | None = None
    quantity_value: Decimal | None = Field(default=None, gt=0, le=Decimal("100000"))
    unit: str | None = Field(default=None, pattern=UNIT_RE)
    unit_rate: Decimal | None = Field(default=None, ge=0, le=Decimal("1000000"))


class ReceiptFarm(BaseModel):
    """Farm identity printed in the receipt header."""
    name: str
    address: str
    phone: str
    email: str


class ReceiptOut(BaseModel):
    """Everything the printable donation receipt renders, in one payload."""
    donation: DonationOut
    donor_code: str | None = None
    amount_in_words: str
    farm: ReceiptFarm
    # "pledged" until staff confirm the goods arrived, then "received".
    confirmed: bool


# ---- Public donors wall --------------------------------------------------
class WallDonation(BaseModel):
    """A single gift as it appears publicly: what it was and when it came.
    No rupee figure — the wall thanks people, it doesn't rank them."""
    item: str | None = None
    # Hindi/Tamil names resolved from the catalogue item when the donation
    # references one, so the wall reads correctly in every language.
    item_hi: str | None = None
    item_ta: str | None = None
    donation_type: str
    quantity: str | None = None
    donated_at: datetime


class WallDonor(BaseModel):
    """One name on the public wall. Deliberately carries no contact details and
    no rupee figures — just who gave, what, and when."""
    name: str
    donation_count: int
    donations: list[WallDonation] = []


class DonorWall(BaseModel):
    """Totals count everyone on the register; `listed` holds only the donors
    who asked to be named, so the figures stay true without publishing anyone."""
    total_donors: int
    total_donations: int
    listed: list[WallDonor]


# ---- Donors (the registry behind the donations) --------------------------
class DonorBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=500)


class DonorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    donor_code: str
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    notes: str | None = None
    status: str
    show_publicly: bool = False
    created_at: datetime


class DonorSummary(DonorOut):
    """Donor plus lifetime totals for the donors list."""
    donation_count: int = 0
    total_amount: Decimal = Decimal("0")
    received_amount: Decimal = Decimal("0")
    last_donation_at: datetime | None = None


class DonorDetail(DonorSummary):
    donations: list[DonationOut] = []


class DonorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, pattern="^(active|inactive)$")
    show_publicly: bool | None = None


# ---- Cattle rent invoices ------------------------------------------------
class RentInvoiceLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cattle_id: int | None = None
    tag_number: str
    name: str | None = None
    animal_type: str
    from_date: date
    to_date: date
    days: int
    amount: Decimal
    note: str | None = None


class RentInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    invoice_no: str
    financial_year: str
    owner_id: int
    period_start: date
    period_end: date
    issued_on: date
    due_date: date
    rate_per_day: Decimal
    cattle_days: int
    amount: Decimal
    status: str
    sent_at: datetime | None = None
    paid_at: datetime | None = None
    email_to: str | None = None
    email_error: str | None = None
    public_token: str
    created_at: datetime


class RentInvoiceDetail(RentInvoiceOut):
    owner_name: str = ""
    lines: list[RentInvoiceLineOut] = []
    amount_in_words: str = ""
    farm: ReceiptFarm | None = None


class RentPreviewLine(BaseModel):
    """A line the run *would* create — nothing is written."""
    cattle_id: int
    tag_number: str
    name: str | None = None
    animal_type: str
    from_date: date
    to_date: date
    days: int
    amount: Decimal
    note: str | None = None


class RentPreviewOwner(BaseModel):
    owner_id: int
    owner_code: str
    owner_name: str
    email: str | None = None
    cattle_days: int
    amount: Decimal
    already_invoiced: bool = False
    lines: list[RentPreviewLine] = []


class RentPreview(BaseModel):
    period_start: date
    period_end: date
    rate_per_day: Decimal
    owners: list[RentPreviewOwner]
    total_amount: Decimal
    total_cattle_days: int


class RentRunRequest(BaseModel):
    """Which month to bill. Defaults to the month just gone, which is what the
    25th-of-the-month job uses."""
    year: int | None = Field(default=None, ge=2000, le=2100)
    month: int | None = Field(default=None, ge=1, le=12)
    send_email: bool = True


class RentRunResult(BaseModel):
    period_start: date
    period_end: date
    created: int
    skipped_existing: int
    emailed: int
    email_failed: int
    mail_configured: bool
    invoices: list[RentInvoiceOut] = []


class RentInvoiceUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(draft|sent|paid|void)$")
    email_to: str | None = Field(default=None, max_length=255)


class RentSettingsOut(BaseModel):
    """What the admin screen shows about how billing is configured."""
    rate_per_cattle_per_day: Decimal
    issue_day: int
    due_days: int
    auto_run: bool
    auto_send: bool
    mail_configured: bool
    billable_statuses: list[str]
