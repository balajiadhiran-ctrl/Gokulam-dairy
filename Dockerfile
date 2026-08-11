# Single-image deploy: Node builds the React SPA, Python serves it + the API.

# ---- Stage 1: build the frontend ----
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend runtime serving API + built SPA ----
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
# Built SPA goes where main.py's FRONTEND_DIST expects it.
COPY --from=web /web/dist ./static
ENV FRONTEND_DIST=/app/static

# Seed the SQLite DB on boot (idempotent), then serve on Render's $PORT.
CMD ["sh", "-c", "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
