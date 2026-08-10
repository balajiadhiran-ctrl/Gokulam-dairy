"""Create tables and seed demo data: roles/permissions, a few users, owners,
cattle, and a couple weeks of milk records. Idempotent — safe to re-run."""
from __future__ import annotations

import random
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import Cattle, MilkProduction, Owner, Permission, Role, User

# Permission catalogue for the core slice (design §4.2)
PERMISSIONS = [
    ("dashboard.read", "dashboard"),
    ("owners.read", "owners"),
    ("owners.create", "owners"),
    ("owners.update", "owners"),
    ("owners.delete", "owners"),
    ("cattle.read", "cattle"),
    ("cattle.create", "cattle"),
    ("cattle.update", "cattle"),
    ("cattle.delete", "cattle"),
    ("milk.read", "milk"),
    ("milk.create", "milk"),
    ("milk.update", "milk"),
    ("donations.read", "donations"),
    ("donations.update", "donations"),
]

# Owners + cattle full CRUD — shared by Super Admin and Admin.
OWNER_CATTLE_CRUD = [
    "dashboard.read",
    "owners.read", "owners.create", "owners.update", "owners.delete",
    "cattle.read", "cattle.create", "cattle.update", "cattle.delete",
    "donations.read", "donations.update",
]

# role slug -> permission codes ("*" = all)
ROLES = {
    # Super Admin: everything, including future user/RBAC/settings management.
    "super-admin": ("Super Admin", "*"),
    # Admin: manage owners and their cattle (add owners + full cattle CRUD).
    "admin": ("Admin", OWNER_CATTLE_CRUD),
    "farm-manager": ("Farm Manager", OWNER_CATTLE_CRUD + ["milk.read", "milk.create", "milk.update"]),
    "staff": ("Staff", ["cattle.read", "milk.read", "milk.create"]),
    "owner": ("Owner", ["dashboard.read", "owners.read", "cattle.read", "milk.read"]),
}


def seed() -> None:
    Base.metadata.create_all(engine)
    db: Session = SessionLocal()
    try:
        _seed_rbac(db)
        _seed_users(db)
        _seed_farm(db)
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


def _seed_rbac(db: Session) -> None:
    perms: dict[str, Permission] = {}
    for code, module in PERMISSIONS:
        p = db.scalar(select(Permission).where(Permission.code == code))
        if not p:
            p = Permission(code=code, module=module, description=code)
            db.add(p)
        perms[code] = p
    db.flush()

    for slug, (name, codes) in ROLES.items():
        role = db.scalar(select(Role).where(Role.slug == slug))
        if not role:
            role = Role(name=name, slug=slug, is_system=True)
            db.add(role)
        wanted = list(perms.values()) if codes == "*" else [perms[c] for c in codes]
        role.permissions = wanted
    db.flush()


def _seed_users(db: Session) -> None:
    def ensure(email: str, name: str, role_slug: str, owner: Owner | None = None) -> None:
        if db.scalar(select(User).where(User.email == email)):
            return
        role = db.scalar(select(Role).where(Role.slug == role_slug))
        u = User(
            email=email,
            password_hash=hash_password("password123"),
            full_name=name,
            is_active=True,
            owner_id=owner.id if owner else None,
        )
        u.roles = [role] if role else []
        db.add(u)

    ensure("superadmin@gokulam.in", "Super Admin", "super-admin")
    ensure("admin@gokulam.in", "Farm Admin", "admin")
    ensure("manager@gokulam.in", "R. Manager", "farm-manager")
    ensure("staff@gokulam.in", "Shed Staff", "staff")
    db.flush()


def _seed_farm(db: Session) -> None:
    if db.scalar(select(Owner).limit(1)):
        return  # farm data already present

    # (English, हिन्दी, தமிழ்)
    owner_names = [
        ("R. Krishnan", "आर. कृष्णन", "ஆர். கிருஷ்ணன்"),
        ("S. Lakshmi", "एस. लक्ष्मी", "எஸ். லட்சுமி"),
        ("M. Govindan", "एम. गोविंदन", "எம். கோவிந்தன்"),
        ("P. Anand", "पी. आनंद", "பி. ஆனந்த்"),
        ("V. Meera", "वी. मीरा", "வி. மீரா"),
    ]
    breeds = {"cow": ["Gir", "Sahiwal", "HF Cross"], "buffalo": ["Murrah", "Jaffarabadi"]}
    owners: list[Owner] = []
    for i, (name, name_hi, name_ta) in enumerate(owner_names, start=1):
        o = Owner(
            owner_code=f"OWN-{i:03d}",
            name=name,
            name_hi=name_hi,
            name_ta=name_ta,
            village="Gokulam",
            status="active",
        )
        db.add(o)
        owners.append(o)
    db.flush()

    # Link the demo "owner portal" user to the first owner
    portal = db.scalar(select(User).where(User.email == "owner@gokulam.in"))
    if not portal:
        role = db.scalar(select(Role).where(Role.slug == "owner"))
        portal = User(
            email="owner@gokulam.in",
            password_hash=hash_password("password123"),
            full_name=owners[0].name,
            owner_id=owners[0].id,
        )
        portal.roles = [role] if role else []
        db.add(portal)

    rng = random.Random(42)
    cattle: list[Cattle] = []
    tag = 100
    for o in owners:
        for _ in range(rng.randint(3, 6)):
            tag += 1
            atype = rng.choice(["cow", "buffalo"])
            c = Cattle(
                tag_number=f"GKL-{tag:04d}",
                name=None,
                animal_type=atype,
                breed=rng.choice(breeds[atype]),
                owner_id=o.id,
                status="active",
            )
            db.add(c)
            cattle.append(c)
    db.flush()

    # ~10 days of milk history
    staff = db.scalar(select(User).where(User.email == "staff@gokulam.in"))
    today = date.today()
    for c in cattle:
        for d in range(1, 11):
            day = today - timedelta(days=d)
            morning = round(rng.uniform(3, 8), 2)
            evening = round(rng.uniform(2, 7), 2)
            db.add(
                MilkProduction(
                    cattle_id=c.id,
                    owner_id=c.owner_id,
                    prod_date=day,
                    morning_litres=morning,
                    evening_litres=evening,
                    total_litres=round(morning + evening, 2),
                    recorded_by=staff.id if staff else None,
                )
            )


if __name__ == "__main__":
    seed()
