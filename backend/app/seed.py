"""Create tables and seed demo data: roles/permissions, a few users, owners,
cattle, and a couple weeks of milk records. Idempotent — safe to re-run."""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    Cattle,
    Donation,
    Donor,
    MilkProduction,
    Owner,
    Permission,
    Role,
    User,
)
from app.services.donations import (
    apply_valuation,
    financial_year,
    find_or_create_donor,
    new_public_token,
    next_receipt_no,
    quantity_label,
)

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
    ("donors.read", "donors"),
    ("donors.update", "donors"),
]

# Owners + cattle full CRUD — shared by Super Admin and Admin.
OWNER_CATTLE_CRUD = [
    "dashboard.read",
    "owners.read", "owners.create", "owners.update", "owners.delete",
    "cattle.read", "cattle.create", "cattle.update", "cattle.delete",
    "donations.read", "donations.update",
    "donors.read", "donors.update",
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
    _add_missing_columns()
    db: Session = SessionLocal()
    try:
        _seed_rbac(db)
        _seed_users(db)
        _seed_farm(db)
        _seed_donations(db)
        _backfill_donors(db)
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


def _add_missing_columns() -> None:
    """`create_all` builds new tables but never alters existing ones, so a
    database created before the donor registry existed would be missing the
    receipt/valuation columns. Add whatever is absent — this is the stand-in
    for a migration tool on a project that doesn't carry one yet."""
    wanted = {
        "donations": [
            ("donor_id", "INTEGER"),
            ("receipt_no", "VARCHAR(32)"),
            ("financial_year", "VARCHAR(9)"),
            ("public_token", "VARCHAR(32)"),
            ("quantity_value", "NUMERIC(10, 2)"),
            ("unit", "VARCHAR(16)"),
            ("unit_rate", "NUMERIC(10, 2)"),
            ("amount", "NUMERIC(12, 2)"),
        ],
        "donors": [
            ("show_publicly", "BOOLEAN DEFAULT 0 NOT NULL"),
        ],
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in wanted.items():
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl_type in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))
                    print(f"  + {table}.{name}")


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


def _backfill_donors(db: Session) -> None:
    """Attach any donation that predates the donor registry to a donor row, so
    the donors list covers the farm's whole history rather than just new
    pledges."""
    orphans = list(db.scalars(select(Donation).where(Donation.donor_id.is_(None))))
    for d in orphans:
        donor = find_or_create_donor(db, name=d.donor_name, phone=d.phone, email=d.email)
        d.donor_id = donor.id
    if orphans:
        db.flush()
        print(f"  linked {len(orphans)} earlier donation(s) to the donor registry")


def _seed_donations(db: Session) -> None:
    """A handful of feed donations so the donors list and receipts have
    something to show on a fresh install."""
    if db.scalar(select(Donor).limit(1)):
        return

    rng = random.Random(7)
    samples = [
        # (name, phone, email, type, item, qty, unit, days ago, status)
        ("Anitha Ramesh", "+91 98410 22118", "anitha.r@example.in",
         "green_fodder", "Napier grass", 120, "kg", 2, "received"),
        ("Anitha Ramesh", "+91 98410 22118", None,
         "hay", "Paddy straw hay", 3, "bag", 24, "received"),
        ("Suresh Kumar", "9840155320", None,
         "feed", "Cattle feed pellets", 2, "bag", 5, "acknowledged"),
        ("Devi Textiles Trust", "+91 44 2841 7700", "trust@devitextiles.example",
         "dry_grass", "Dry fodder bundles", 40, "bundle", 9, "received"),
        ("M. Balamurugan", "9003477812", "bala.m@example.in",
         "mineral", "Mineral mixture", 15, "kg", 13, "new"),
        ("Lakshmi Ammal", None, None,
         "green_fodder", "Co-4 fodder", 2, "quintal", 18, "received"),
        ("Suresh Kumar", "9840155320", "suresh.k@example.in",
         "green_fodder", "Maize fodder", 250, "kg", 31, "received"),
    ]

    # Demo donors who agreed to be named on the public wall. Everyone else
    # stays unlisted, which is what a real register looks like.
    consenting = {"Anitha Ramesh", "Devi Textiles Trust", "Lakshmi Ammal", "Suresh Kumar"}

    for name, phone, email, dtype, item, qty, unit, days_ago, status in samples:
        donor = find_or_create_donor(db, name=name, phone=phone, email=email)
        if name in consenting:
            donor.show_publicly = True
        fy = financial_year()
        created = datetime.now() - timedelta(days=days_ago, hours=rng.randint(0, 20))
        d = Donation(
            donor_id=donor.id,
            donor_name=name,
            phone=phone,
            email=email,
            donation_type=dtype,
            item=item,
            quantity_value=Decimal(qty),
            unit=unit,
            quantity=quantity_label(Decimal(qty), unit),
            status=status,
            financial_year=fy,
            receipt_no=next_receipt_no(db, fy),
            public_token=new_public_token(),
            created_at=created,
            updated_at=created,
        )
        apply_valuation(d)
        db.add(d)
    db.flush()


if __name__ == "__main__":
    seed()
