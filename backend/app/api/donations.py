"""Donations — public feed-donation pledges + admin triage.

`POST /donations` is intentionally public (no auth): visitors on the marketing
website offer to donate green fodder, grass, hay or other food for the cattle.
Listing and status updates require the `donations.read` / `donations.update`
permissions.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db.session import get_db
from app.models import Donation, User
from app.schemas import DonationCreate, DonationOut, DonationStatusUpdate

router = APIRouter(prefix="/donations", tags=["donations"])


@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def create_donation(body: DonationCreate, db: Session = Depends(get_db)) -> Donation:
    donation = Donation(**body.model_dump(), status="new")
    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation


@router.get("", response_model=list[DonationOut])
def list_donations(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("donations.read")),
) -> list[Donation]:
    stmt = select(Donation)
    if status_filter:
        stmt = stmt.where(Donation.status == status_filter)
    return list(db.scalars(stmt.order_by(Donation.created_at.desc())))


@router.patch("/{donation_id}", response_model=DonationOut)
def update_status(
    donation_id: int,
    body: DonationStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("donations.update")),
) -> Donation:
    donation = db.get(Donation, donation_id)
    if not donation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Donation not found")
    donation.status = body.status
    db.commit()
    db.refresh(donation)
    return donation
