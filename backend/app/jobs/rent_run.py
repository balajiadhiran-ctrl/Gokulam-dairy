"""Standalone monthly rent run — point a real scheduler at this.

    python -m app.jobs.rent_run                # bill the month just gone
    python -m app.jobs.rent_run --month 2026-08
    python -m app.jobs.rent_run --no-email     # generate only
    python -m app.jobs.rent_run --dry-run      # show what would be billed

Safe to run any number of times: an owner already invoiced for the period is
skipped, so a scheduler that fires twice never double-bills.
"""
from __future__ import annotations

import argparse
import sys

from app.db.session import SessionLocal
from app.services import billing
from app.services.rent_email import send_invoice


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate and email cattle rent invoices")
    parser.add_argument("--month", help="YYYY-MM to bill (default: the previous month)")
    parser.add_argument("--no-email", action="store_true", help="generate without sending")
    parser.add_argument("--dry-run", action="store_true", help="print totals, write nothing")
    args = parser.parse_args(argv)

    if args.month:
        try:
            year, month = (int(part) for part in args.month.split("-", 1))
        except ValueError:
            print(f"Bad --month {args.month!r}; expected YYYY-MM", file=sys.stderr)
            return 2
    else:
        year, month = billing.previous_month()

    period_start, period_end = billing.month_bounds(year, month)
    rate = billing.rate_per_day()
    print(f"Cattle rent · {period_start} to {period_end} · Rs{rate}/animal/day")

    db = SessionLocal()
    try:
        if args.dry_run:
            from sqlalchemy import select

            from app.models import Owner

            owners = db.scalars(select(Owner).where(Owner.deleted_at.is_(None)))
            total = 0
            for owner in owners:
                lines, days, amount = billing.preview_owner(
                    db, owner.id, period_start, period_end, rate
                )
                if not lines:
                    continue
                total += 1
                print(f"  {owner.owner_code:<10} {owner.name:<22} "
                      f"{len(lines):>3} animals {days:>5} days  Rs{amount}")
            print(f"{total} owner(s) would be invoiced. Nothing was written.")
            return 0

        invoices = billing.generate_for_month(db, year, month)
        sent = failed = 0
        if not args.no_email:
            for invoice in invoices:
                result = send_invoice(db, invoice)
                if result.ok:
                    sent += 1
                elif not result.skipped:
                    failed += 1
        db.commit()

        for invoice in invoices:
            print(f"  {invoice.invoice_no}  owner {invoice.owner_id:<4} "
                  f"{invoice.cattle_days:>5} days  Rs{invoice.amount}")
        print(f"{len(invoices)} invoice(s) created, {sent} emailed, {failed} failed.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
