"""Milk production endpoints — the core slice, built for offline-first sync.

The bulk endpoint is idempotent per (cattle_id, prod_date): re-sending a record
that already exists is reported as a duplicate rather than erroring, so the PWA
can safely replay its offline queue (design §5.1 idempotency, §3.4 unique key).
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models import Cattle, MilkProduction, Owner, User
from app.schemas import (
    MilkAnalyticsRow,
    MilkBulkCreate,
    MilkBulkResult,
    MilkCreate,
    MilkOut,
    Page,
)

router = APIRouter(prefix="/milk", tags=["milk"])


def _resolve_cattle(db: Session, cattle_id: int) -> Cattle:
    cattle = db.get(Cattle, cattle_id)
    if not cattle or cattle.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Cattle {cattle_id} not found")
    if cattle.status != "active":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Cattle {cattle.tag_number} is not active",
        )
    return cattle


def _create_one(db: Session, body: MilkCreate, user: User) -> MilkProduction:
    cattle = _resolve_cattle(db, body.cattle_id)
    if body.prod_date > date.today():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "prod_date is in the future")
    existing = db.scalar(
        select(MilkProduction).where(
            MilkProduction.cattle_id == body.cattle_id,
            MilkProduction.prod_date == body.prod_date,
            MilkProduction.deleted_at.is_(None),
        )
    )
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Milk already recorded for {cattle.tag_number} on {body.prod_date}",
        )
    row = MilkProduction(
        cattle_id=cattle.id,
        owner_id=cattle.owner_id,
        prod_date=body.prod_date,
        morning_litres=body.morning_litres,
        evening_litres=body.evening_litres,
        total_litres=round(body.morning_litres + body.evening_litres, 2),
        recorded_by=user.id,
    )
    db.add(row)
    return row


@router.post("", response_model=MilkOut, status_code=status.HTTP_201_CREATED)
def create_milk(
    body: MilkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("milk.create")),
) -> MilkProduction:
    row = _create_one(db, body, user)
    db.commit()
    db.refresh(row)
    return row


@router.post("/bulk", response_model=MilkBulkResult)
def create_milk_bulk(
    body: MilkBulkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("milk.create")),
) -> MilkBulkResult:
    """Replay the offline queue. Each record is handled independently so one bad
    row never blocks the rest."""
    created: list[MilkProduction] = []
    duplicates: list[str] = []
    errors: list[str] = []
    for rec in body.records:
        try:
            row = _create_one(db, rec, user)
            db.flush()  # assign id without ending the transaction
            created.append(row)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_409_CONFLICT:
                duplicates.append(str(exc.detail))
            else:
                errors.append(str(exc.detail))
    db.commit()
    return MilkBulkResult(
        created=[MilkOut.model_validate(r) for r in created],
        duplicates=duplicates,
        errors=errors,
    )


@router.get("", response_model=Page)
def list_milk(
    owner_id: int | None = Query(default=None),
    cattle_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("milk.read")),
) -> Page:
    stmt = select(MilkProduction).where(MilkProduction.deleted_at.is_(None))
    if user.owner_id is not None:  # owner-portal row scoping
        stmt = stmt.where(MilkProduction.owner_id == user.owner_id)
    elif owner_id is not None:
        stmt = stmt.where(MilkProduction.owner_id == owner_id)
    if cattle_id is not None:
        stmt = stmt.where(MilkProduction.cattle_id == cattle_id)
    if date_from:
        stmt = stmt.where(MilkProduction.prod_date >= date_from)
    if date_to:
        stmt = stmt.where(MilkProduction.prod_date <= date_to)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(MilkProduction.prod_date.desc(), MilkProduction.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    pages = (total + page_size - 1) // page_size
    return Page(
        items=[MilkOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/analytics", response_model=list[MilkAnalyticsRow])
def milk_analytics(
    group: str = Query(default="owner", pattern="^(owner|animal)$"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("milk.read")),
) -> list[MilkAnalyticsRow]:
    if group == "owner":
        label = Owner.name
        join_target, join_cond = Owner, Owner.id == MilkProduction.owner_id
    else:
        label = Cattle.tag_number
        join_target, join_cond = Cattle, Cattle.id == MilkProduction.cattle_id

    stmt = (
        select(
            label.label("key"),
            func.coalesce(func.sum(MilkProduction.total_litres), 0).label("total"),
            func.count(func.distinct(MilkProduction.prod_date)).label("days"),
        )
        .join(join_target, join_cond)
        .where(MilkProduction.deleted_at.is_(None))
        .group_by(label)
        .order_by(func.sum(MilkProduction.total_litres).desc())
    )
    if user.owner_id is not None:
        stmt = stmt.where(MilkProduction.owner_id == user.owner_id)
    if date_from:
        stmt = stmt.where(MilkProduction.prod_date >= date_from)
    if date_to:
        stmt = stmt.where(MilkProduction.prod_date <= date_to)

    return [
        MilkAnalyticsRow(key=r.key, total_litres=float(r.total), days=r.days)
        for r in db.execute(stmt).all()
    ]
