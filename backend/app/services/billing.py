"""Cattle rent billing.

Owners pay the farm a daily rate for each animal it keeps. A month is not a
flat charge: an animal that arrived on the 12th is billed 20 days, one sold on
the 3rd is billed 3, and one that moved between owners is billed to each of
them for the days it was theirs. All of that comes out of `cattle_placements`
(see app/services/placements.py), which dates every arrival and departure.

Every figure is frozen onto the invoice when it is generated, so changing the
farm's rate later never rewrites an invoice that has already gone out.
"""
from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Cattle, CattlePlacement, Owner, RentInvoice, RentInvoiceLine

# Invoices are issued on this day of the month, for the month just gone.
ISSUE_DAY = 25


# ---------------------------------------------------------------------------
# Periods
# ---------------------------------------------------------------------------


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """First and last day of a calendar month, both inclusive."""
    last = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def previous_month(on: date | None = None) -> tuple[int, int]:
    """The month before `on` — what a run on the 25th bills for."""
    on = on or date.today()
    first = date(on.year, on.month, 1)
    prior = first - timedelta(days=1)
    return prior.year, prior.month


def financial_year_of(day: date) -> str:
    """Indian financial year (1 April - 31 March) as "2026-27"."""
    start = day.year if day.month >= 4 else day.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


# ---------------------------------------------------------------------------
# Proration
# ---------------------------------------------------------------------------


def overlap_days(
    start: date, end: date | None, period_start: date, period_end: date
) -> tuple[date, date, int]:
    """Days a stay covers inside the billing period.

    Both ends are inclusive, so a stay of 1-31 August billed for August is 31
    days, not 30. Returns (from, to, days); days is 0 when they do not overlap.
    """
    begin = max(start, period_start)
    finish = min(end or period_end, period_end)
    if finish < begin:
        return begin, finish, 0
    return begin, finish, (finish - begin).days + 1


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _day_month(day: date) -> str:
    """"3 Aug" — %-d isn't portable to Windows, so strip the zero by hand."""
    return f"{day.day} {day.strftime('%b')}"


def _note_for(placement: CattlePlacement, period_start: date, period_end: date) -> str | None:
    """Explain a part month so the owner can see why a line isn't the full period."""
    parts = []
    if placement.start_date > period_start:
        parts.append(f"joined {_day_month(placement.start_date)}")
    if placement.end_date is not None and placement.end_date < period_end:
        parts.append(f"{placement.end_reason or 'left'} {_day_month(placement.end_date)}")
    return " · ".join(parts) or None


def preview_owner(
    db: Session, owner_id: int, period_start: date, period_end: date, rate: Decimal
) -> tuple[list[dict], int, Decimal]:
    """What an owner would be billed for a period, without writing anything.

    Returns (lines, total cattle-days, total amount).
    """
    rows = db.execute(
        select(CattlePlacement, Cattle)
        .join(Cattle, Cattle.id == CattlePlacement.cattle_id)
        .where(
            CattlePlacement.owner_id == owner_id,
            CattlePlacement.start_date <= period_end,
            # Still here, or left on/after the period started.
            (CattlePlacement.end_date.is_(None)) | (CattlePlacement.end_date >= period_start),
        )
        .order_by(Cattle.tag_number, CattlePlacement.start_date)
    ).all()

    lines: list[dict] = []
    total_days = 0
    total = Decimal("0")

    for placement, animal in rows:
        begin, finish, days = overlap_days(
            placement.start_date, placement.end_date, period_start, period_end
        )
        if days <= 0:
            continue
        amount = _money(Decimal(days) * rate)
        lines.append(
            {
                "cattle_id": animal.id,
                "tag_number": animal.tag_number,
                "name": animal.name,
                "animal_type": animal.animal_type,
                "from_date": begin,
                "to_date": finish,
                "days": days,
                "amount": amount,
                "note": _note_for(placement, period_start, period_end),
            }
        )
        total_days += days
        total += amount

    return lines, total_days, _money(total)


# ---------------------------------------------------------------------------
# Invoice numbering
# ---------------------------------------------------------------------------


def next_invoice_no(db: Session, fy: str) -> str:
    """GKD/RENT/2026-27/0001, running within each financial year."""
    used = db.scalar(
        select(func.count(RentInvoice.id)).where(RentInvoice.financial_year == fy)
    ) or 0
    # Skip past any number already taken (a voided run, or a manual insert).
    seq = used + 1
    while db.scalar(select(RentInvoice.id).where(RentInvoice.invoice_no == _fmt(fy, seq))):
        seq += 1
    return _fmt(fy, seq)


def _fmt(fy: str, seq: int) -> str:
    return f"GKD/RENT/{fy}/{seq:04d}"


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------


def rate_per_day() -> Decimal:
    return Decimal(str(settings.rent_per_cattle_per_day))


def generate_for_month(
    db: Session,
    year: int,
    month: int,
    *,
    issued_on: date | None = None,
    rate: Decimal | None = None,
) -> list[RentInvoice]:
    """Create one invoice per owner who had cattle that month.

    Idempotent: an owner already invoiced for the period is skipped, so re-running
    after a partial failure — or on every deploy — never double-bills anyone.
    Owners with nothing to bill get no invoice at all rather than a zero one.
    """
    period_start, period_end = month_bounds(year, month)
    rate = rate or rate_per_day()
    issued = issued_on or date.today()
    fy = financial_year_of(period_start)
    due = issued + timedelta(days=settings.rent_due_days)

    already = set(
        db.scalars(
            select(RentInvoice.owner_id).where(RentInvoice.period_start == period_start)
        )
    )
    owners = list(
        db.scalars(select(Owner).where(Owner.deleted_at.is_(None)).order_by(Owner.owner_code))
    )

    created: list[RentInvoice] = []
    for owner in owners:
        if owner.id in already:
            continue
        lines, total_days, total = preview_owner(db, owner.id, period_start, period_end, rate)
        if not lines:
            continue

        invoice = RentInvoice(
            invoice_no=next_invoice_no(db, fy),
            financial_year=fy,
            owner_id=owner.id,
            period_start=period_start,
            period_end=period_end,
            issued_on=issued,
            due_date=due,
            rate_per_day=rate,
            cattle_days=total_days,
            amount=total,
            status="draft",
            email_to=owner.email,
            public_token=uuid.uuid4().hex,
        )
        invoice.lines = [RentInvoiceLine(**line) for line in lines]
        db.add(invoice)
        db.flush()
        created.append(invoice)

    return created


def run_due_billing(db: Session, *, today: date | None = None) -> list[RentInvoice]:
    """The monthly job: from the 25th onwards, bill the month just gone.

    Called on startup and from the CLI, so a free-tier instance that sleeps
    through the 25th still bills on its next wake-up. Does nothing before the
    25th, and nothing at all once the month has been invoiced.
    """
    today = today or date.today()
    if today.day < ISSUE_DAY:
        return []
    year, month = previous_month(today)
    return generate_for_month(db, year, month, issued_on=today)


def mark_sent(invoice: RentInvoice, *, ok: bool, error: str | None = None) -> None:
    if ok:
        invoice.status = "sent" if invoice.status == "draft" else invoice.status
        invoice.sent_at = datetime.now()
        invoice.email_error = None
    else:
        invoice.email_error = (error or "Send failed")[:500]


def mark_paid(invoice: RentInvoice) -> None:
    invoice.status = "paid"
    invoice.paid_at = datetime.now()
