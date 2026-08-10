"""Auth / RBAC FastAPI dependencies (design §4, §10)."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_permission(code: str):
    """Route guard: caller must hold `code` (e.g. 'milk.create')."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if code not in user.permission_codes:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"Missing required permission: {code}"
            )
        return user

    return checker
