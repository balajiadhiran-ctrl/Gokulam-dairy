#!/usr/bin/env bash
# One-time setup when the Codespace is created: install deps + seed the DB.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ Backend: venv + dependencies"
cd "$ROOT/backend"
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip -q
.venv/bin/python -m pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env
echo "▶ Backend: seeding database"
.venv/bin/python -m app.seed

echo "▶ Frontend: npm install"
cd "$ROOT/frontend"
npm install

echo "✅ Setup complete — servers will start automatically."
