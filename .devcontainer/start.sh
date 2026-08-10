#!/usr/bin/env bash
# Start the API (8000) and web (5173) servers in the background.
# Safe to run multiple times — it won't double-start the API.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Backend (FastAPI on 8000) ---
if ! curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
  echo "Starting API on :8000"
  cd "$ROOT/backend"
  nohup .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 \
    > /tmp/gokulam-api.log 2>&1 &
fi

# --- Frontend (Vite dev on 5173; proxies /api and /media to the API) ---
if ! curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1; then
  echo "Starting Web on :5173"
  cd "$ROOT/frontend"
  nohup npm run dev -- --host 0.0.0.0 > /tmp/gokulam-web.log 2>&1 &
fi

echo "Gokulam is starting. Open the forwarded port 5173 to view the app."
