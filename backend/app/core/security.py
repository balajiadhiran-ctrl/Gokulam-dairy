"""Password hashing and JWT helpers.

NOTE: The design (§10) calls for bcrypt/argon2. For the local dev build we use
stdlib PBKDF2-HMAC-SHA256 so there are no native-compile dependencies on the
very new Python 3.14. The interface below is drop-in swappable — replace
`hash_password` / `verify_password` with argon2-cffi or bcrypt for production.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings

_PBKDF2_ROUNDS = 240_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


def _create_token(sub: str, ttl_seconds: int, token_type: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "type": token_type,
        "iat": now,
        "exp": now + timedelta(seconds=ttl_seconds),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def create_access_token(user_id: int, permissions: list[str], owner_id: int | None) -> str:
    return _create_token(
        str(user_id),
        settings.jwt_access_ttl,
        "access",
        {"perms": permissions, "owner_id": owner_id},
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(str(user_id), settings.jwt_refresh_ttl, "refresh")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
