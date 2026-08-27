"""Portal accounts for cattle owners.

Each owner gets a login of their own so they can see their herd, their milk
records and their rent invoices — and nobody else's. The read endpoints are
row-scoped by `User.owner_id` (see app/api/deps.py), so an owner account is
confined to its own records no matter what it asks for.

Owners rarely have an email address on file, and the login id has to be unique
and typeable, so an account falls back to a synthetic id built from the owner
code — `own-001@gokulam.farm`. That is a *username*, not a mailbox: invoices
are still emailed to the address on the owner record.
"""
from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Owner, Role, User

LOGIN_DOMAIN = "gokulam.farm"

# No l/1/I/0/O — these get handed over on paper and read back over a phone.
_ALPHABET = "abcdefghjkmnpqrstuvwxyz"
_DIGITS = "23456789"


def generate_password() -> str:
    """Something like "gokul-pravu-4726": long enough to be safe, short enough
    to dictate down a phone line."""
    word = "".join(secrets.choice(_ALPHABET) for _ in range(5))
    number = "".join(secrets.choice(_DIGITS) for _ in range(4))
    return f"gokul-{word}-{number}"


def login_email_for(owner: Owner) -> str:
    """Their real address when there is one, otherwise a synthetic username."""
    if owner.email:
        return owner.email.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", owner.owner_code.lower()).strip("-")
    return f"{slug or f'owner-{owner.id}'}@{LOGIN_DOMAIN}"


def find_login(db: Session, owner: Owner) -> User | None:
    return db.scalar(
        select(User).where(User.owner_id == owner.id, User.deleted_at.is_(None))
    )


def provision(db: Session, owner: Owner) -> tuple[User, str, bool]:
    """Create the owner's account, or reset the password on the existing one.

    Returns (user, plaintext password, created). The password is returned only
    here — it is stored hashed, so a lost one is reset, never recovered.
    """
    password = generate_password()
    existing = find_login(db, owner)

    if existing is not None:
        existing.password_hash = hash_password(password)
        existing.must_change_password = True
        existing.is_active = True
        return existing, password, False

    email = login_email_for(owner)
    clash = db.scalar(select(User).where(User.email == email, User.deleted_at.is_(None)))
    if clash is not None:
        # Someone else already uses that address — fall back to the owner code
        # so provisioning never silently hijacks an existing account.
        slug = re.sub(r"[^a-z0-9]+", "-", owner.owner_code.lower()).strip("-")
        email = f"{slug}-{owner.id}@{LOGIN_DOMAIN}"

    role = db.scalar(select(Role).where(Role.slug == "owner"))
    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=owner.name,
        owner_id=owner.id,
        is_active=True,
        must_change_password=True,
    )
    user.roles = [role] if role else []
    db.add(user)
    db.flush()
    return user, password, True
