"""Donation domain logic shared by the public and admin endpoints:
donor matching, receipt numbering and rate-card valuation.
"""
from __future__ import annotations

import re
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rates import rupees_in_words, value_donation
from app.models import Donation, Donor, ReceiptCounter
from app.schemas import ReceiptFarm, ReceiptOut

# ---------------------------------------------------------------------------
# Donor matching
# ---------------------------------------------------------------------------


def normalise_phone(phone: str | None) -> str | None:
    """Last 10 digits, so "+91 98765 43210" and "9876543210" are one donor."""
    digits = re.sub(r"\D", "", phone or "")
    return digits[-10:] if len(digits) >= 10 else (digits or None)


def normalise_email(email: str | None) -> str | None:
    return email.strip().lower() or None if email else None


def normalise_name(name: str | None) -> str | None:
    return re.sub(r"\s+", " ", (name or "").strip()).lower() or None


def find_or_create_donor(
    db: Session,
    *,
    name: str,
    phone: str | None,
    email: str | None,
) -> Donor:
    """Resolve a submission onto the donor registry.

    Matched by phone, then email. Name alone is only trusted when neither side
    has any contact detail to contradict it — two different people called
    "Ramesh" who both left a phone number must not be merged.
    """
    phone_key = normalise_phone(phone)
    email_key = normalise_email(email)
    name_key = normalise_name(name)

    donor: Donor | None = None
    if phone_key:
        donor = db.scalar(
            select(Donor).where(Donor.phone_key == phone_key, Donor.deleted_at.is_(None))
        )
    if donor is None and email_key:
        donor = db.scalar(
            select(Donor).where(Donor.email_key == email_key, Donor.deleted_at.is_(None))
        )
    if donor is None and not phone_key and not email_key and name_key:
        donor = db.scalar(
            select(Donor).where(
                Donor.name_key == name_key,
                Donor.phone_key.is_(None),
                Donor.email_key.is_(None),
                Donor.deleted_at.is_(None),
            )
        )

    if donor is None:
        donor = Donor(
            donor_code="",  # filled from the id once flushed
            name=name,
            phone=phone,
            email=email,
            phone_key=phone_key,
            email_key=email_key,
            name_key=name_key,
        )
        db.add(donor)
        db.flush()
        donor.donor_code = f"GKD-D{donor.id:04d}"
        return donor

    # Repeat donor: fill in any detail we didn't have before, without
    # overwriting what's already on file.
    if phone and not donor.phone:
        donor.phone, donor.phone_key = phone, phone_key
    if email and not donor.email:
        donor.email, donor.email_key = email, email_key
    return donor


# ---------------------------------------------------------------------------
# Receipt numbering — GKD/2026-27/0001, restarting each financial year
# ---------------------------------------------------------------------------


def financial_year(on: date | None = None) -> str:
    """Indian financial year (1 April - 31 March) as "2026-27"."""
    on = on or date.today()
    start = on.year if on.month >= 4 else on.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def next_receipt_no(db: Session, fy: str) -> str:
    """Allocate the next number in `fy`. Runs inside the caller's transaction,
    and locks the counter row where the database supports it."""
    counter = db.get(ReceiptCounter, fy, with_for_update=True)
    if counter is None:
        counter = ReceiptCounter(financial_year=fy, last_number=0)
        db.add(counter)
        db.flush()
    counter.last_number += 1
    return f"GKD/{fy}/{counter.last_number:04d}"


# ---------------------------------------------------------------------------
# Valuation
# ---------------------------------------------------------------------------


def quantity_label(value: Decimal | None, unit: str | None) -> str | None:
    """"100" + "kg" -> "100 kg"; trailing .00 dropped."""
    if value is None or not unit:
        return None
    text = f"{Decimal(value).normalize():f}"
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return f"{text} {unit}"


def apply_valuation(donation: Donation) -> None:
    """Recompute unit_rate/amount from the rate card, honouring an explicit
    unit_rate already set on the row (a staff override)."""
    rate, amount = value_donation(
        donation.donation_type,
        Decimal(donation.quantity_value) if donation.quantity_value is not None else None,
        donation.unit,
        Decimal(donation.unit_rate) if donation.unit_rate is not None else None,
    )
    donation.unit_rate = rate
    donation.amount = amount


def new_public_token() -> str:
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Receipt assembly
# ---------------------------------------------------------------------------


def build_receipt(donation: Donation) -> ReceiptOut:
    return ReceiptOut(
        donation=donation,  # type: ignore[arg-type]  # pydantic from_attributes
        donor_code=donation.donor.donor_code if donation.donor else None,
        amount_in_words=rupees_in_words(donation.amount) if donation.amount else "",
        farm=ReceiptFarm(
            name=settings.farm_name,
            address=settings.farm_address,
            phone=settings.farm_phone,
            email=settings.farm_email,
        ),
        confirmed=donation.status == "received",
    )
