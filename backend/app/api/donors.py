"""Donors — the registry of everyone who has given feed to the farm.

Rows are created automatically when a pledge comes in from the public site
(see app/services/donations.py); this module is the admin-side view of that
registry, with lifetime totals so staff can see who gives, how often and how
much their contributions are worth, plus the public thank-you wall.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db.session import get_db
from app.models import Donation, Donor, FeedItem, User
from app.schemas import (
    DonorDetail,
    DonorSummary,
    DonorUpdate,
    DonorWall,
    WallDonation,
    WallDonor,
)
from app.services.donations import normalise_email, normalise_name, normalise_phone

router = APIRouter(prefix="/donors", tags=["donors"])


@router.get("/wall", response_model=DonorWall)
def donor_wall(db: Session = Depends(get_db)) -> DonorWall:
    """Public thank-you wall for the marketing site.

    The two totals cover every donor on the register — a count names nobody, so
    it can be honest. `listed` contains only donors who consented, each with
    what they gave and when. Contact details and rupee amounts never appear
    here, whatever the donor consented to.
    """
    donors = list(db.scalars(select(Donor).where(Donor.deleted_at.is_(None))))
    consenting = {d.id: d for d in donors if d.show_publicly and d.status == "active"}

    counts: dict[int, int] = {}
    gifts: dict[int, list[WallDonation]] = {}
    # Left join: free-text donations have no catalogue row to translate from.
    rows = db.execute(
        select(Donation, FeedItem)
        .outerjoin(FeedItem, Donation.feed_item_id == FeedItem.id)
        .where(Donation.donor_id.isnot(None))
        .order_by(Donation.created_at.desc())
    ).all()

    for donation, item in rows:
        counts[donation.donor_id] = counts.get(donation.donor_id, 0) + 1
        if donation.donor_id not in consenting:
            continue
        gifts.setdefault(donation.donor_id, []).append(
            WallDonation(
                item=donation.item,
                # Taken from the catalogue row as it stands now; the English
                # name on the donation is the snapshot it was given under.
                item_hi=item.name_hi if item else None,
                item_ta=item.name_ta if item else None,
                donation_type=donation.donation_type,
                quantity=donation.quantity,
                donated_at=donation.created_at,
            )
        )

    listed = sorted(
        (
            WallDonor(
                name=d.name,
                donation_count=counts.get(d.id, 0),
                donations=gifts.get(d.id, []),
            )
            for d in consenting.values()
        ),
        key=lambda w: (-w.donation_count, w.name.lower()),
    )
    return DonorWall(
        total_donors=len(donors),
        total_donations=sum(counts.values()),
        listed=listed,
    )


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
                "address", "notes", "status", "show_publicly", "created_at",
            )
        },
        donation_count=len(rows),
        total_amount=total,
        received_amount=received,
        last_donation_at=max((d.created_at for d in rows), default=None),
    )
