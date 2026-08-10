"""Authentication endpoints (design §5.2)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas import LoginRequest, RefreshRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens_for(user: User) -> TokenResponse:
    perms = user.permission_codes
    return TokenResponse(
        access_token=create_access_token(user.id, perms, user.owner_id),
        refresh_token=create_refresh_token(user.id),
        permissions=perms,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == body.email, User.deleted_at.is_(None)))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return _tokens_for(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
        assert payload.get("type") == "refresh"
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return _tokens_for(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
