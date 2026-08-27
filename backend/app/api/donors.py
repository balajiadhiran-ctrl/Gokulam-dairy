"""Donors — the registry of everyone who has given feed to the farm.

Rows are created automatically when a pledge comes in from the public site
(see app/services/donations.py); this module is the admin-side view of that
registry, with lifetime totals so staff can see who gives, how often and how
much their contributions are worth.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db.session import get_db
from app.models import Donation, Donor, User
from app.schemas import DonorDetail, DonorSummary, DonorUpdate
from app.services.donations import normalise_email, normalise_name, normalise_phone

router = APIRouter(prefix="/donors", tags=["donors"])


@router.get("", response_model=list[DonorSummary])
def list_donors(
    q: str | None = Query(default=None, description="Search name, phone, email or donor code"),
    sort: str = Query(default="recent", pattern="^(recent|total|name|count)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("donors.read")),
) -> list[DonorSummary]:
    stmt = select(Donor).where(Donor.deleted_at.is_(None))

    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Donor.name).like(like),
                func.lower(func.coalesce(Donor.email, "")).like(like),
                func.coalesce(Donor.phone, "").like(f"%{q.strip()}%"),
                func.lower(Donor.donor_code).like(like),
            )
        )

    donors = list(db.scalars(stmt))
    if not donors:
        return []

    summaries = [_summarise(db, d) for d in donors]

    key = {
        "recent": lambda s: (s.last_donation_at is not None, s.last_donation_at or s.created_at),
        "total": lambda s: s.total_amount,
        "count": lambda s: s.donation_count,
        "name": lambda s: s.name.lower(),
    }[sort]
    return sorted(summaries, key=key, reverse=sort != "name")


@router.get("/{donor_id}", response_model=DonorDetail)
def get_donor(
    donor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("donors.read")),
) -> DonorDetail:
    donor = db.get(Donor, donor_id)
    if not donor or donor.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Donor not found")

    donations = list(
        db.scalars(
            select(Donation)
            .where(Donation.donor_id == donor_id)
            .order_by(Donation.created_at.desc())
        )
    )
    summary = _summarise(db, donor, donations)
    return DonorDetail(**summary.model_dump(), donations=donations)  # type: ignore[arg-type]


@router.patch("/{donor_id}", response_model=DonorSummary)
def update_donor(
    donor_id: int,
    body: DonorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("donors.update")),
) -> DonorSummary:
    """Correct a donor's details — staff often learn the full name or address
    when they collect the feed."""
    donor = db.get(Donor, donor_id)
    if not donor or donor.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Donor not found")

    fields = body.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(donor, key, value)

    # Keep the match keys in step so future pledges still find this donor.
    if "phone" in fields:
        donor.phone_key = normalise_phone(donor.phone)
    if "email" in fields:
        donor.email_key = normalise_email(donor.email)
    if "name" in fields:
        donor.name_key = normalise_name(donor.name)

    db.commit()
    db.refresh(donor)
    return _summarise(db, donor)


def _summarise(
    db: Session, donor: Donor, donations: list[Donation] | None = None
) -> DonorSummary:
    """Lifetime totals for one donor. Amounts are summed in Python from the
    donation rows — a farm's donor list is small, and it keeps the received
    vs pledged split readable."""
    rows = (
        donations
        if donations is not None
        else list(db.scalars(select(Donation).where(Donation.donor_id == donor.id)))
    )
    total = sum((Decimal(d.amount) for d in rows if d.amount is not None), Decimal("0"))
    received = sum(
        (Decimal(d.amount) for d in rows if d.amount is not None and d.status == "received"),
        Decimal("0"),
    )
    return DonorSummary(
        **{
            c: getattr(donor, c)
            for c in (
                "id", "donor_code", "name", "phone", "email",
                "address", "notes", "status", "created_at",
            )
        },
        donation_count=len(rows),
        total_amount=total,
        received_amount=received,
        last_donation_at=max((d.created_at for d in rows), default=None),
    )
