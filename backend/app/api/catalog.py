"""Owner & Cattle management — full CRUD (design §6 Owner/Cattle Management).

Follows the shared conventions: soft delete (never physically removed),
unique public codes, and permission-gated routes.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import deny_other_owner, own_scope, require_permission
from app.db.session import get_db
from app.models import Cattle, Owner, User
from app.services.placements import sync_placement
from app.services.owner_logins import find_login, login_email_for, provision
from app.schemas import (
    BreedCount,
    CattleCreate,
    CattleOut,
    CattleUpdate,
    OwnerCreate,
    OwnerLoginBulkResult,
    OwnerLoginOut,
    OwnerOut,
    OwnerSummary,
    OwnerUpdate,
)

router = APIRouter(tags=["catalog"])

# Local object storage stand-in for S3/MinIO (design §2.3). Files served at /media.
MEDIA_ROOT = Path(__file__).resolve().parents[2] / "media"
CATTLE_PHOTO_DIR = MEDIA_ROOT / "cattle"
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _soft_delete(entity) -> None:
    entity.deleted_at = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Owners
# ---------------------------------------------------------------------------


@router.get("/owners", response_model=list[OwnerSummary])
def list_owners(
    q: str | None = Query(default=None, description="search name or code"),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("owners.read")),
) -> list[OwnerSummary]:
    stmt = select(Owner).where(Owner.deleted_at.is_(None))
    scope = own_scope(user)
    if scope is not None:
        # A cattle owner's login only ever sees their own record.
        stmt = stmt.where(Owner.id == scope)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Owner.name.ilike(like) | Owner.owner_code.ilike(like))
    if status_filter:
        stmt = stmt.where(Owner.status == status_filter)
    owners = list(db.scalars(stmt.order_by(Owner.name)))

    # One grouped query for herd stats across all owners (avoids N+1).
    agg = db.execute(
        select(
            Cattle.owner_id,
            Cattle.animal_type,
            Cattle.breed,
            func.count().label("n"),
        )
        .where(Cattle.deleted_at.is_(None))
        .group_by(Cattle.owner_id, Cattle.animal_type, Cattle.breed)
    ).all()

    breeds: dict[int, dict[str, int]] = {}
    cows: dict[int, int] = {}
    buffaloes: dict[int, int] = {}
    for owner_id, atype, breed, n in agg:
        if atype == "cow":
            cows[owner_id] = cows.get(owner_id, 0) + n
        elif atype == "buffalo":
            buffaloes[owner_id] = buffaloes.get(owner_id, 0) + n
        key = breed or "Unknown"
        breeds.setdefault(owner_id, {})[key] = breeds.get(owner_id, {}).get(key, 0) + n

    # One query for every owner's login, rather than one per row.
    logins = {
        u.owner_id: u
        for u in db.scalars(
            select(User).where(User.owner_id.isnot(None), User.deleted_at.is_(None))
        )
    }

    result: list[OwnerSummary] = []
    for o in owners:
        cow_n = cows.get(o.id, 0)
        buf_n = buffaloes.get(o.id, 0)
        breed_list = [
            BreedCount(breed=b, count=c)
            for b, c in sorted(breeds.get(o.id, {}).items(), key=lambda kv: -kv[1])
        ]
        summary = OwnerSummary.model_validate(o)
        summary.cattle_count = cow_n + buf_n
        summary.cow_count = cow_n
        summary.buffalo_count = buf_n
        summary.breeds = breed_list
        login = logins.get(o.id)
        summary.has_login = login is not None
        summary.login_email = login.email if login else None
        result.append(summary)
    return result


# ---------------------------------------------------------------------------
# Owner portal logins
# ---------------------------------------------------------------------------


@router.post("/owners/{owner_id}/login", response_model=OwnerLoginOut)
def create_owner_login(
    owner_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("owners.update")),
) -> OwnerLoginOut:
    """Give this owner a portal account, or reset the password on the one they
    have. The generated password comes back once and is never retrievable —
    write it down before closing the dialog."""
    owner = db.get(Owner, owner_id)
    if not owner or owner.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Owner not found")

    user, password, created = provision(db, owner)
    db.commit()
    return OwnerLoginOut(
        owner_id=owner.id,
        owner_code=owner.owner_code,
        owner_name=owner.name,
        email=user.email,
        password=password,
        created=created,
        note=None if owner.email else "Login id only — this owner has no email address on file.",
    )


@router.post("/owners/logins", response_model=OwnerLoginBulkResult)
def create_missing_owner_logins(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("owners.update")),
) -> OwnerLoginBulkResult:
    """Create accounts for every owner who does not have one. Owners who
    already have a login are left alone — this never resets a password
    somebody is already using."""
    owners = list(
        db.scalars(select(Owner).where(Owner.deleted_at.is_(None)).order_by(Owner.owner_code))
    )
    result = OwnerLoginBulkResult()
    for owner in owners:
        if find_login(db, owner) is not None:
            result.already_had_login += 1
            continue
        try:
            user, password, _created = provision(db, owner)
        except Exception as exc:  # noqa: BLE001 - one bad row must not stop the rest
            db.rollback()
            result.failed.append(f"{owner.owner_code}: {exc}")
            continue
        result.created.append(
            OwnerLoginOut(
                owner_id=owner.id,
                owner_code=owner.owner_code,
                owner_name=owner.name,
                email=user.email,
                password=password,
                created=True,
                note=None if owner.email else "Login id only — no email address on file.",
            )
        )
    db.commit()
    return result


@router.get("/owners/{owner_id}/login", response_model=OwnerLoginOut)
def get_owner_login(
    owner_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("owners.read")),
) -> OwnerLoginOut:
    """Who the owner signs in as. Never returns a password — passwords are
    stored hashed, so a forgotten one is reset, not looked up."""
    owner = db.get(Owner, owner_id)
    if not owner or owner.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Owner not found")
    user = find_login(db, owner)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This owner has no login yet")
    return OwnerLoginOut(
        owner_id=owner.id,
        owner_code=owner.owner_code,
        owner_name=owner.name,
        email=user.email,
        password=None,
        created=False,
        note="Reset the password to issue a new one.",
    )


@router.get("/owners/{owner_id}", response_model=OwnerOut)
def get_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("owners.read")),
) -> Owner:
    deny_other_owner(user, owner_id)
    owner = db.get(Owner, owner_id)
    if not owner or owner.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Owner not found")
    return owner


@router.post("/owners", response_model=OwnerOut, status_code=status.HTTP_201_CREATED)
def create_owner(
    body: OwnerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("owners.create")),
) -> Owner:
    exists = db.scalar(
        select(Owner).where(Owner.owner_code == body.owner_code, Owner.deleted_at.is_(None))
    )
    if exists:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Owner code '{body.owner_code}' already exists"
        )
    owner = Owner(**body.model_dump())
    db.add(owner)
    db.commit()
    db.refresh(owner)
    return owner


@router.patch("/owners/{owner_id}", response_model=OwnerOut)
def update_owner(
    owner_id: int,
    body: OwnerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("owners.update")),
) -> Owner:
    owner = db.get(Owner, owner_id)
    if not owner or owner.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Owner not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(owner, field, value)
    db.commit()
    db.refresh(owner)
    return owner


@router.delete("/owners/{owner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("owners.delete")),
) -> None:
    owner = db.get(Owner, owner_id)
    if not owner or owner.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Owner not found")
    # Integrity guard: don't orphan animals.
    active_cattle = db.scalar(
        select(func.count())
        .select_from(Cattle)
        .where(Cattle.owner_id == owner_id, Cattle.deleted_at.is_(None))
    )
    if active_cattle:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Owner still has {active_cattle} active animal(s); reassign or remove them first",
        )
    _soft_delete(owner)
    db.commit()


# ---------------------------------------------------------------------------
# Cattle
# ---------------------------------------------------------------------------


@router.get("/cattle", response_model=list[CattleOut])
def list_cattle(
    owner_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    animal_type: str | None = Query(default=None),
    q: str | None = Query(default=None, description="search tag or name"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("cattle.read")),
) -> list[Cattle]:
    stmt = select(Cattle).where(Cattle.deleted_at.is_(None))
    # Owner-portal users are row-scoped to their own animals (design §4.2).
    if user.owner_id is not None:
        stmt = stmt.where(Cattle.owner_id == user.owner_id)
    elif owner_id is not None:
        stmt = stmt.where(Cattle.owner_id == owner_id)
    if status_filter:
        stmt = stmt.where(Cattle.status == status_filter)
    if animal_type:
        stmt = stmt.where(Cattle.animal_type == animal_type)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Cattle.tag_number.ilike(like) | Cattle.name.ilike(like))
    return list(db.scalars(stmt.order_by(Cattle.tag_number)))


@router.get("/cattle/{cattle_id}", response_model=CattleOut)
def get_cattle(
    cattle_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("cattle.read")),
) -> Cattle:
    cattle = db.get(Cattle, cattle_id)
    if not cattle or cattle.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cattle not found")
    if user.owner_id is not None and cattle.owner_id != user.owner_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cattle not found")
    return cattle


def _require_owner(db: Session, owner_id: int) -> Owner:
    owner = db.get(Owner, owner_id)
    if not owner or owner.deleted_at is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Owner {owner_id} not found")
    return owner


@router.post("/cattle", response_model=CattleOut, status_code=status.HTTP_201_CREATED)
def create_cattle(
    body: CattleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("cattle.create")),
) -> Cattle:
    _require_owner(db, body.owner_id)
    exists = db.scalar(
        select(Cattle).where(Cattle.tag_number == body.tag_number, Cattle.deleted_at.is_(None))
    )
    if exists:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Tag number '{body.tag_number}' already exists"
        )
    cattle = Cattle(**body.model_dump())
    db.add(cattle)
    db.flush()
    # Open the animal's billing history from today, so rent prorates correctly.
    sync_placement(db, cattle)
    db.commit()
    db.refresh(cattle)
    return cattle


@router.patch("/cattle/{cattle_id}", response_model=CattleOut)
def update_cattle(
    cattle_id: int,
    body: CattleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("cattle.update")),
) -> Cattle:
    cattle = db.get(Cattle, cattle_id)
    if not cattle or cattle.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cattle not found")
    data = body.model_dump(exclude_unset=True)
    if "owner_id" in data:
        _require_owner(db, data["owner_id"])
    for field, value in data.items():
        setattr(cattle, field, value)
    # An owner transfer, a sale or a death all change what gets billed and to
    # whom, so the placement history is reconciled on every edit.
    sync_placement(db, cattle)
    db.commit()
    db.refresh(cattle)
    return cattle


@router.delete("/cattle/{cattle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cattle(
    cattle_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("cattle.delete")),
) -> None:
    cattle = db.get(Cattle, cattle_id)
    if not cattle or cattle.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cattle not found")
    _soft_delete(cattle)
    # Stop the rent clock today rather than losing the days already billable.
    sync_placement(db, cattle, reason="removed")
    db.commit()


@router.post("/cattle/{cattle_id}/photo", response_model=CattleOut)
async def upload_cattle_photo(
    cattle_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("cattle.update")),
) -> Cattle:
    cattle = db.get(Cattle, cattle_id)
    if not cattle or cattle.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cattle not found")
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG or WebP images are allowed"
        )
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:  # 5 MB cap
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image must be under 5 MB")

    CATTLE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{cattle_id}_{uuid.uuid4().hex[:8]}{ext}"
    (CATTLE_PHOTO_DIR / filename).write_bytes(data)

    # Remove the previous file if any, then point the row at the new one.
    if cattle.photo_path:
        old = MEDIA_ROOT / cattle.photo_path
        if old.exists():
            old.unlink()
    cattle.photo_path = f"cattle/{filename}"
    db.commit()
    db.refresh(cattle)
    return cattle
