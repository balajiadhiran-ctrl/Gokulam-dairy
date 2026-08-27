"""Donations — public feed-donation pledges + admin triage.

`POST /donations` and `GET /donations/receipt/{token}` are intentionally public
(no auth): visitors on the marketing website offer green fodder, grass, hay or
other food for the cattle, and get back a receipt thanking them and showing
what their contribution is worth. Listing and updates require the
`donations.read` / `donations.update` permissions.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.rates import RATE_PER_KG, UNIT_KG
from app.db.session import get_db
from app.models import Donation, User
from app.schemas import DonationCreate, DonationOut, DonationStatusUpdate, ReceiptOut
from app.services.donations import (
    apply_valuation,
    build_receipt,
    financial_year,
    find_or_create_donor,
    new_public_token,
    next_receipt_no,
    quantity_label,
)

router = APIRouter(prefix="/donations", tags=["donations"])


@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def create_donation(body: DonationCreate, db: Session = Depends(get_db)) -> Donation:
    """Record a pledge, attach it to the donor registry and issue its receipt
    number. The response carries everything the thank-you receipt renders."""
    donor = find_or_create_donor(
        db, name=body.donor_name, phone=body.phone, email=body.email
    )
    # Consent is additive: a tick opts in, an untick never silently removes a
    # name the donor already agreed to. Staff unlist on request.
    if body.show_publicly:
        donor.show_publicly = True

    fy = financial_year()
    donation = Donation(
        donor_id=donor.id,
        donor_name=body.donor_name,
        phone=body.phone,
        email=body.email,
        donation_type=body.donation_type,
        item=body.item,
        quantity_value=body.quantity_value,
        unit=body.unit,
        # Prefer the structured quantity; fall back to whatever text was sent.
        quantity=quantity_label(body.quantity_value, body.unit) or body.quantity,
        message=body.message,
        status="new",
        financial_year=fy,
        receipt_no=next_receipt_no(db, fy),
        public_token=new_public_token(),
    )
    apply_valuation(donation)

    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation


@router.get("/rate-card")
def get_rate_card() -> dict[str, dict[str, str | None]]:
    """The farm's indicative valuation table, so the public form can show a
    donor what their contribution is worth as they type it. Public: it's the
    same information printed on every receipt."""
    return {
        "rate_per_kg": {k: str(v) for k, v in RATE_PER_KG.items()},
        "unit_kg": {k: (str(v) if v is not None else None) for k, v in UNIT_KG.items()},
    }


@router.get("/receipt/{public_token}", response_model=ReceiptOut)
def get_receipt(public_token: str, db: Session = Depends(get_db)) -> ReceiptOut:
    """Public receipt lookup. Keyed on an unguessable token rather than the
    sequential receipt number, so one donor's link can't be walked to another's."""
    donation = db.scalar(select(Donation).where(Donation.public_token == public_token))
    if not donation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Receipt not found")
    return build_receipt(donation)


@router.get("", response_model=list[DonationOut])
def list_donations(
    status_filter: str | None = Query(default=None, alias="status"),
    donor_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("donations.read")),
) -> list[Donation]:
    stmt = select(Donation)
    if status_filter:
        stmt = stmt.where(Donation.status == status_filter)
    if donor_id:
        stmt = stmt.where(Donation.donor_id == donor_id)
    return list(db.scalars(stmt.order_by(Donation.created_at.desc())))


@router.patch("/{donation_id}", response_model=DonationOut)
def update_donation(
    donation_id: int,
    body: DonationStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("donations.update")),
) -> Donation:
    """Triage a donation: move its status on, and/or price goods the rate card
    could not value. Any valuation change recomputes the receipt total."""
    donation = db.get(Donation, donation_id)
    if not donation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Donation not found")

    fields = body.model_dump(exclude_unset=True)
    if "status" in fields and fields["status"]:
        donation.status = fields["status"]
    if "item" in fields:
        donation.item = fields["item"]

    revalue = False
    for key in ("quantity_value", "unit", "unit_rate"):
        if key in fields:
            setattr(donation, key, fields[key])
            revalue = True

    if revalue:
        label = quantity_label(
            Decimal(donation.quantity_value) if donation.quantity_value is not None else None,
            donation.unit,
        )
        # Only overwrite the display string when the quantity itself was
        # touched — otherwise a legacy free-text quantity survives a rate edit.
        if "quantity_value" in fields or label:
            donation.quantity = label
        apply_valuation(donation)

    # Late-arriving rows (created before receipts existed) get one on first edit.
    if not donation.receipt_no:
        donation.financial_year = donation.financial_year or financial_year()
        donation.receipt_no = next_receipt_no(db, donation.financial_year)
    if not donation.public_token:
        donation.public_token = new_public_token()

    db.commit()
    db.refresh(donation)
    return donation
