# Gokulam Dairy Farm — Progressive Web App

An installable **PWA** with two faces sharing one backend:

- a **public marketing website / portfolio** (`/`) — responsive, with cow &amp; buffalo
  photos, gallery, and a **"donate feed"** flow where donors pledge green fodder,
  grass, hay and other food for the cattle;
- an **admin ERP** (`/admin`, behind login) — Owner &amp; Cattle management (herd
  counts, breed breakdown, cattle photos) and donation triage.

- **Frontend** — React 19 + TypeScript + Vite, Tailwind v4, TanStack Query, `vite-plugin-pwa`
- **Backend** — FastAPI + SQLAlchemy 2.0 (SQLite locally; swap to MySQL for prod), JWT auth, permission-based RBAC
- **Offline-first** — milk entries made without signal are queued in IndexedDB and
  synced to `POST /milk/bulk` (idempotent per animal/day) when connectivity returns.

## What's implemented

| Area | Status |
|------|--------|
| Multilingual — English / हिन्दी / தமிழ் with a language selector | ✅ |
| Public website — Home, Gallery, Donate, Contact (responsive) | ✅ |
| Cow/buffalo/farm imagery (free CC images in `public/images/`) | ✅ |
| Donate Feed — public pledge form → `POST /donations` | ✅ |
| Donation receipts — invoice-format thank-you with the contribution value | ✅ |
| Donor registry — repeat donors matched, lifetime totals, searchable | ✅ |
| Public donors wall — true donor count, names shown only with consent | ✅ |
| Admin donation triage (new → acknowledged → received) + valuation | ✅ |
| JWT login + refresh, session restore | ✅ |
| Permission-based RBAC (Super Admin, Admin, Manager, Staff, Owner) | ✅ |
| Owners — full CRUD, search, herd counts + breed breakdown | ✅ |
| Cattle — full CRUD, filter by owner/type, per-animal photo upload | ✅ |
| Dashboard — herd KPIs, breed distribution, owners by herd size | ✅ |
| Installable PWA (manifest, service worker, app-shell cache) | ✅ |
| Veterinary, Finance, Ledger, Inventory | ⏳ next modules |

## Deploy to GitHub Codespaces (public URL)

The repo is Codespaces-ready (`.devcontainer/`). Opening a Codespace installs
everything, seeds the DB, and starts both servers automatically.

1. Push this project to a GitHub repository (see below).
2. On the repo page: **Code ▸ Codespaces ▸ Create codespace on main**.
3. Wait for setup to finish (installs deps, seeds DB, starts servers).
4. Open the **Ports** tab → port **5173** → open in browser.
5. To share a **public URL**: in the Ports tab, right-click port **5173** →
   **Port Visibility ▸ Public**. The URL (`https://<name>-5173.app.github.dev`)
   is then reachable by anyone.

Only port 5173 needs to be public — the web server proxies `/api` and `/media`
to the backend (8000) inside the container, so the whole app works from one URL.

> **Note:** A Codespace is great for demos/sharing, but it **suspends after ~30 min
> idle** and the URL goes dark until you reopen it. For always-on hosting use a
> real platform (Render, Railway, Fly.io, or a VM) — the same Docker-friendly
> layout applies.

### Push to GitHub first

```bash
git add -A
git commit -m "Gokulam Dairy Farm PWA"
# create an empty repo on github.com, then:
git branch -M main
git remote add origin https://github.com/<you>/gokulam-dairy.git
git push -u origin main
```

## Always-on deploy (Render) — permanent public URL

The whole app ships as **one Docker image** (Node builds the SPA, Python serves
it + the API from a single origin), with a `render.yaml` blueprint.

1. Push to GitHub (above).
2. Sign in at **https://render.com** with your GitHub account.
3. **New + ▸ Blueprint** → pick the `Gokulam-dairy` repo → **Apply**.
4. Render builds the Dockerfile and deploys. You get a permanent URL like
   `https://gokulam-dairy.onrender.com` — public, no login to view.

Demo accounts are seeded on every boot (SQLite). Log in at `/admin` with
`admin@gokulam.in` / `password123`.

> **Free plan** gives a permanent URL that **sleeps after ~15 min idle** and
> cold-starts (~30–60s) on the next request — no tab to keep open, unlike
> Codespaces. For **zero sleep**, switch `plan: free` → `plan: starter` in
> `render.yaml` (~$7/mo). Uploaded cattle photos and data reset on redeploy
> (ephemeral disk); add a Render Disk or managed MySQL to persist them.

Run the image locally (if you have Docker):
```bash
docker build -t gokulam .
docker run -p 8000:8000 gokulam    # → http://localhost:8000
```

## Routes

- **Public site**: `/` (Home), `/gallery`, `/donate`, `/donors`, `/contact`,
  `/receipt/:token`
- **Login**: `/login`
- **Admin ERP**: `/admin` (Dashboard), `/admin/owners`, `/admin/cattle`,
  `/admin/donations`, `/admin/donors`

## Prerequisites

- Python 3.11+ (tested on 3.14) and Node 20+

## Run the backend (port 8000)

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
cp .env.example .env
python -m app.seed          # create + seed the SQLite database
python -m uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/api/v1/docs

## Run the frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173 — Vite proxies `/api` to the backend on 8000.

## Demo accounts (password: `password123`)

| Email | Role | Access |
|-------|------|--------|
| `superadmin@gokulam.in` | Super Admin | everything (all modules + future user/RBAC/settings) |
| `admin@gokulam.in` | Admin | **add owners + full cattle CRUD** (owners & cattle management) |
| `manager@gokulam.in` | Farm Manager | owners, cattle, plus milk |
| `staff@gokulam.in` | Staff | cattle read, milk create/read |
| `owner@gokulam.in` | Owner | read-only, scoped to own animals |

## Try it

**Public site** — open `http://127.0.0.1:5173/`:
1. Browse the **Home** hero, stats, products and gallery preview.
2. **Gallery** — filter cow/buffalo/calf/farm photos, click for a lightbox.
3. **Donate** — pledge feed (green fodder, grass, hay…); submits with no login.
   Enter a quantity and the form shows what the contribution is worth; on submit
   you get a printable **donation receipt** with a receipt number, itemised line,
   total and amount in words. The `/receipt/:token` link keeps working afterwards.

**Admin** — click **Login**, sign in as **Admin** (`admin@gokulam.in` / `password123`):
1. **Owners** — cards with total/cow/buffalo counts and breed chips; add/edit/delete.
2. **View cattle** on an owner — gallery; add cattle and **Add photo** (JPEG/PNG/WebP).
3. **Cattle** — all animals, filterable by owner and type.
4. **Donations** — donor pledges with their receipt number and value; move them
   new → acknowledged → received, or price anything the rate card could not value.
5. **Donors** — the registry: every donor with donation count, lifetime value and
   last donation. Click a row for their full history and receipt links. The
   **On wall** toggle lists or unlists a name on the public page.

### Naming donors publicly

`/donors` is a thank-you wall. The two totals — donors and donations — count
**everyone** on the register, because a number identifies nobody. Names appear
only for donors who ticked *"Show my name on the donors wall"* on the pledge
form; the box is unticked by default, and donors already on file when this was
added stay unlisted. Phone numbers, email addresses and rupee amounts are never
published. Ticking the box opts a donor in; a later pledge with the box unticked
never silently removes a name they already agreed to — staff unlist on request
from the admin **Donors** screen.

### Valuing in-kind donations

No money changes hands — a donation is feed, not a payment. To thank donors with
a figure, each feed type carries an indicative farm-gate rate per kilogram in
`backend/app/core/rates.py`, and units convert to kilograms there too
(1 bag = 50 kg, 1 bundle = 20 kg, 1 quintal = 100 kg). **Edit that file to match
your farm's real rates.** Staff can override the rate on any individual donation
from the admin screen. Receipts are labelled *Donation Receipt*, not tax
invoices, and say plainly that nothing is payable.

## Production notes

- **Database**: set `DATABASE_URL` to `mysql+asyncmy://…` (design §11.5). The BigInt
  PKs already fall back to SQLite-compatible INTEGER locally.
- **Passwords**: local build uses stdlib PBKDF2 (no native deps on Python 3.14).
  Swap `app/core/security.py` to argon2/bcrypt for production (design §10).
- **Icons**: `frontend/public/icon-*.png` are placeholder brand marks — replace
  with designed assets.
