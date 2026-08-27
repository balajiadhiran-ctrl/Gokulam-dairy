"""Feed catalogue — what the farm feeds its cattle and what each item costs.

`GET /feed-items` is public: the donate form lists the active items so a donor
picks real feed at the farm's own rate. Everything that changes the catalogue
requires the matching `feed.*` permission, held by Super Admin and Admin.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db.session import get_db
from app.models import Donation, FeedItem, User
from app.schemas import FeedItemCreate, FeedItemOut, FeedItemUpdate

router = APIRouter(prefix="/feed-items", tags=["feed"])


@router.get("", response_model=list[FeedItemOut])
def list_public_feed_items(
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[FeedItem]:
    """Active catalogue for the public donate form. Retired items are hidden
    here but kept for the donations that reference them."""
    stmt = select(FeedItem).where(
        FeedItem.deleted_at.is_(None), FeedItem.is_active.is_(True)
    )
    if category:
        stmt = stmt.where(FeedItem.category == category)
    return list(db.scalars(stmt.order_by(FeedItem.category, FeedItem.name)))


@router.get("/all", response_model=list[FeedItemOut])
def list_all_feed_items(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("feed.read")),
) -> list[FeedItem]:
    """Full catalogue including retired items, for the admin screen."""
    return list(
        db.scalars(
            select(FeedItem)
            .where(FeedItem.deleted_at.is_(None))
            .order_by(FeedItem.category, FeedItem.name)
        )
    )


@router.post("", response_model=FeedItemOut, status_code=status.HTTP_201_CREATED)
def create_feed_item(
    body: FeedItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("feed.create")),
) -> FeedItem:
    if body.feed_code and db.scalar(
        select(FeedItem).where(FeedItem.feed_code == body.feed_code)
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "Feed code already in use")

    data = body.model_dump(exclude={"feed_code"})
    item = FeedItem(**data, feed_code=body.feed_code or "")
    db.add(item)
    db.flush()
    if not item.feed_code:
        item.feed_code = f"FEED-{item.id:03d}"
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=FeedItemOut)
def update_feed_item(
    item_id: int,
    body: FeedItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("feed.update")),
) -> FeedItem:
    """Editing a rate changes what *future* donations are valued at. Receipts
    already issued keep the rate they were created with."""
    item = _get(db, item_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feed_item(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("feed.delete")),
) -> None:
    """Soft delete. An item that donations point at is retired instead of
    removed, so their history and receipts stay intact."""
    item = _get(db, item_id)
    in_use = db.scalar(select(Donation.id).where(Donation.feed_item_id == item_id).limit(1))
    if in_use:
        item.is_active = False
    else:
        item.deleted_at = datetime.now(timezone.utc)
    db.commit()


def _get(db: Session, item_id: int) -> FeedItem:
    item = db.get(FeedItem, item_id)
    if not item or item.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feed item not found")
    return item
