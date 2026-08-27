"""Cattle rent — monthly invoices to owners.

Staff generate, review and send from `/admin/rent` (`rent.read` / `rent.manage`).
Owners see their own invoices in their login through `/rent/invoices/mine`,
which needs no extra permission: it is scoped to the caller's own owner record
and refuses to serve anyone else's.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.core.config import settings
from app.core.rates import rupees_in_words
from app.db.session import get_db
from app.models import Owner, RentInvoice, User
from app.schemas import (
    ReceiptFarm,
    RentInvoiceDetail,
    RentInvoiceOut,
    RentInvoiceUpdate,
    RentPreview,
    RentPreviewOwner,
    RentRunRequest,
    RentRunResult,
    RentSettingsOut,
)
from app.core.mailer import is_configured as mail_configured
from app.services import billing
from app.services.placements import BILLABLE_STATUSES
from app.services.rent_email import send_invoice

router = APIRouter(prefix="/rent", tags=["rent"])


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@router.get("/settings", response_model=RentSettingsOut)
def rent_settings(
    _: User = Depends(require_permission("rent.read")),
) -> RentSettingsOut:
    return RentSettingsOut(
        rate_per_cattle_per_day=billing.rate_per_day(),
        issue_day=billing.ISSUE_DAY,
        due_days=settings.rent_due_days,
        auto_run=settings.rent_auto_run,
        auto_send=settings.rent_auto_send,
        mail_configured=mail_configured(),
        billable_statuses=sorted(BILLABLE_STATUSES),
    )


# ---------------------------------------------------------------------------
# Preview & run
# ---------------------------------------------------------------------------


@router.get("/preview", response_model=RentPreview)
def preview(
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("rent.read")),
) -> RentPreview:
    """What the run would bill, without writing anything — so staff can check
    the numbers before invoices go to owners."""
    if year is None or month is None:
        year, month = billing.previous_month()
    period_start, period_end = billing.month_bounds(year, month)
    rate = billing.rate_per_day()

    invoiced = set(
        db.scalars(
            select(RentInvoice.owner_id).where(RentInvoice.period_start == period_start)
        )
    )
    owners = list(
        db.scalars(select(Owner).where(Owner.deleted_at.is_(None)).order_by(Owner.owner_code))
    )

    rows: list[RentPreviewOwner] = []
    for owner in owners:
        lines, days, amount = billing.preview_owner(db, owner.id, period_start, period_end, rate)
        if not lines:
            continue
        rows.append(
            RentPreviewOwner(
                owner_id=owner.id,
                owner_code=owner.owner_code,
                owner_name=owner.name,
                email=owner.email,
                cattle_days=days,
                amount=amount,
                already_invoiced=owner.id in invoiced,
                lines=lines,  # type: ignore[arg-type]
            )
        )

    return RentPreview(
        period_start=period_start,
        period_end=period_end,
        rate_per_day=rate,
        owners=rows,
        total_amount=sum((r.amount for r in rows), start=Decimal("0")),
        total_cattle_days=sum(r.cattle_days for r in rows),
    )


@router.post("/run", response_model=RentRunResult)
def run(
    body: RentRunRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("rent.manage")),
) -> RentRunResult:
    """Generate the month's invoices and, unless told otherwise, email them.

    Owners already invoiced for the period are skipped, so running twice never
    double-bills. A failed email leaves the invoice in place with the error
    recorded — it can be retried from the admin screen.
    """
    year, month = body.year, body.month
    if year is None or month is None:
        year, month = billing.previous_month()

    period_start, period_end = billing.month_bounds(year, month)
    existing_count = db.scalar(
        select(func.count(RentInvoice.id)).where(RentInvoice.period_start == period_start)
    ) or 0

    created = billing.generate_for_month(db, year, month)

    emailed = failed = 0
    if body.send_email:
        for invoice in created:
            result = send_invoice(db, invoice)
            if result.ok:
                emailed += 1
            elif not result.skipped:
                failed += 1

    db.commit()
    for invoice in created:
        db.refresh(invoice)

    return RentRunResult(
        period_start=period_start,
        period_end=period_end,
        created=len(created),
        skipped_existing=existing_count,
        emailed=emailed,
        email_failed=failed,
        mail_configured=mail_configured(),
        invoices=created,  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# Owner-facing
# ---------------------------------------------------------------------------


@router.get("/invoices/mine", response_model=list[RentInvoiceOut])
def my_invoices(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RentInvoice]:
    """The signed-in owner's own invoices — the login reminder reads this."""
    if not user.owner_id:
        return []
    return list(
        db.scalars(
            select(RentInvoice)
            .where(RentInvoice.owner_id == user.owner_id, RentInvoice.status != "void")
            .order_by(RentInvoice.period_start.desc())
        )
    )


@router.get("/invoices/token/{public_token}", response_model=RentInvoiceDetail)
def invoice_by_token(public_token: str, db: Session = Depends(get_db)) -> RentInvoiceDetail:
    """The link in the invoice email. Keyed on an unguessable token rather than
    the sequential invoice number, so one owner's link reveals only their own."""
    invoice = db.scalar(select(RentInvoice).where(RentInvoice.public_token == public_token))
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return _detail(invoice)


# ---------------------------------------------------------------------------
# Admin listing
# ---------------------------------------------------------------------------


@router.get("/invoices", response_model=list[RentInvoiceOut])
def list_invoices(
    owner_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    period: date | None = Query(default=None, description="period_start to match"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("rent.read")),
) -> list[RentInvoice]:
    stmt = select(RentInvoice)
    if owner_id:
        stmt = stmt.where(RentInvoice.owner_id == owner_id)
    if status_filter:
        stmt = stmt.where(RentInvoice.status == status_filter)
    if period:
        stmt = stmt.where(RentInvoice.period_start == period)
    return list(
        db.scalars(stmt.order_by(RentInvoice.period_start.desc(), RentInvoice.invoice_no))
    )


@router.get("/invoices/{invoice_id}", response_model=RentInvoiceDetail)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RentInvoiceDetail:
    """Readable by staff with `rent.read`, or by the owner it belongs to."""
    invoice = db.get(RentInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if "rent.read" not in user.permission_codes and user.owner_id != invoice.owner_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your invoice")
    return _detail(invoice)


@router.post("/invoices/{invoice_id}/send", response_model=RentInvoiceOut)
def resend(
    invoice_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("rent.manage")),
) -> RentInvoice:
    invoice = db.get(RentInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    result = send_invoice(db, invoice)
    db.commit()
    db.refresh(invoice)
    if not result.ok:
        # The invoice is saved either way; tell the caller why nothing was sent.
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY if not result.skipped else status.HTTP_409_CONFLICT,
            result.error or "Could not send the invoice",
        )
    return invoice


@router.patch("/invoices/{invoice_id}", response_model=RentInvoiceOut)
def update_invoice(
    invoice_id: int,
    body: RentInvoiceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("rent.manage")),
) -> RentInvoice:
    """Mark an invoice paid or void, or correct the address it goes to."""
    invoice = db.get(RentInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    fields = body.model_dump(exclude_unset=True)
    if fields.get("status") == "paid":
        billing.mark_paid(invoice)
    elif "status" in fields and fields["status"]:
        invoice.status = fields["status"]
    if "email_to" in fields:
        invoice.email_to = fields["email_to"]

    db.commit()
    db.refresh(invoice)
    return invoice


def _detail(invoice: RentInvoice) -> RentInvoiceDetail:
    return RentInvoiceDetail(
        **{
            c: getattr(invoice, c)
            for c in (
                "id", "invoice_no", "financial_year", "owner_id", "period_start",
                "period_end", "issued_on", "due_date", "rate_per_day", "cattle_days",
                "amount", "status", "sent_at", "paid_at", "email_to", "email_error",
                "public_token", "created_at",
            )
        },
        owner_name=invoice.owner.name if invoice.owner else "",
        lines=invoice.lines,  # type: ignore[arg-type]
        amount_in_words=rupees_in_words(invoice.amount),
        farm=ReceiptFarm(
            name=settings.farm_name,
            address=settings.farm_address,
            phone=settings.farm_phone,
            email=settings.farm_email,
        ),
    )
