"""Keeps the cattle billing history (`cattle_placements`) in step with the
cattle table.

Rent is charged per animal per day, so every arrival, departure, sale, death
and owner transfer has to be dated. The cattle row only holds the *current*
state, so these helpers open and close placement rows as it changes. Call them
from the cattle endpoints — nothing else writes to that table.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Cattle, CattlePlacement

# An animal that is here costs the farm space and feed whether or not it is
# milking, so a dry cow is still billable. Sold and deceased animals are not.
BILLABLE_STATUSES = frozenset({"active", "dry"})


def is_billable(cattle: Cattle) -> bool:
    return cattle.deleted_at is None and cattle.status in BILLABLE_STATUSES


def open_placement(
    db: Session, cattle: Cattle, *, on: date | None = None
) -> CattlePlacement | None:
    """Start a stay, unless one is already open for this animal and owner."""
    current = current_placement(db, cattle.id)
    if current is not None and current.owner_id == cattle.owner_id:
        return current

    if current is not None:
        close_placement(db, cattle.id, reason="transferred", on=on)

    placement = CattlePlacement(
        cattle_id=cattle.id,
        owner_id=cattle.owner_id,
        start_date=on or date.today(),
    )
    db.add(placement)
    return placement


def close_placement(
    db: Session, cattle_id: int, *, reason: str, on: date | None = None
) -> CattlePlacement | None:
    """End the open stay. `end_date` is the last billable day, inclusive."""
    placement = current_placement(db, cattle_id)
    if placement is None:
        return None
    end = on or date.today()
    # Never end before it began — a same-day arrival and departure bills one day.
    placement.end_date = max(end, placement.start_date)
    placement.end_reason = reason
    return placement


def current_placement(db: Session, cattle_id: int) -> CattlePlacement | None:
    return db.scalar(
        select(CattlePlacement)
        .where(CattlePlacement.cattle_id == cattle_id, CattlePlacement.end_date.is_(None))
        .order_by(CattlePlacement.start_date.desc())
    )


def sync_placement(
    db: Session,
    cattle: Cattle,
    *,
    reason: str | None = None,
    on: date | None = None,
) -> None:
    """Reconcile the history with the animal's current state.

    Safe to call after any change to a cattle row: it opens a stay when the
    animal became billable, closes one when it stopped being, and moves it when
    the owner changed.
    """
    open_stay = current_placement(db, cattle.id)

    if not is_billable(cattle):
        if open_stay is not None:
            close_placement(db, cattle.id, reason=reason or _reason_for(cattle), on=on)
        return

    if open_stay is None:
        open_placement(db, cattle, on=on)
    elif open_stay.owner_id != cattle.owner_id:
        close_placement(db, cattle.id, reason="transferred", on=on)
        open_placement(db, cattle, on=on)


def _reason_for(cattle: Cattle) -> str:
    if cattle.deleted_at is not None:
        return "removed"
    if cattle.status in {"sold", "deceased"}:
        return cattle.status
    return "dry"


def backfill(db: Session) -> int:
    """Give every billable animal without a history an open stay, starting the
    day its record was created. Lets rent run on a farm whose cattle predate
    this table. Idempotent."""
    opened = 0
    cattle = list(db.scalars(select(Cattle).where(Cattle.deleted_at.is_(None))))
    for animal in cattle:
        if not is_billable(animal):
            continue
        if current_placement(db, animal.id) is not None:
            continue
        started = animal.created_at.date() if animal.created_at else date.today()
        db.add(
            CattlePlacement(
                cattle_id=animal.id, owner_id=animal.owner_id, start_date=started
            )
        )
        opened += 1
    if opened:
        db.flush()
    return opened
