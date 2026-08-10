"""Pydantic request/response contracts (design §5)."""
from __future__ import annotations

from datetime import date, datetime

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


class DonationCreate(BaseModel):
    donor_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    donation_type: str = Field(pattern="^(green_fodder|dry_grass|hay|feed|mineral|other)$")
    item: str | None = Field(default=None, max_length=160)
    quantity: str | None = Field(default=None, max_length=80)
    message: str | None = Field(default=None, max_length=500)


class DonationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    donor_name: str
    phone: str | None = None
    email: str | None = None
    donation_type: str
    item: str | None = None
    quantity: str | None = None
    message: str | None = None
    status: str
    created_at: datetime


class DonationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|acknowledged|received)$")
