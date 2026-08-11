"""FastAPI application factory (design §1, §5)."""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, catalog, donations, milk
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

app = FastAPI(
    title="Gokulam Dairy Farm ERP API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_v1 = "/api/v1"
app.include_router(auth.router, prefix=api_v1)
app.include_router(catalog.router, prefix=api_v1)
app.include_router(donations.router, prefix=api_v1)
app.include_router(milk.router, prefix=api_v1)

# Serve uploaded cattle photos (local stand-in for S3/MinIO).
MEDIA_ROOT = Path(__file__).resolve().parents[1] / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")


@app.on_event("startup")
def _startup() -> None:
    # Ensure tables exist even if seed hasn't been run yet.
    Base.metadata.create_all(engine)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Serve the built React SPA (single-service production deploy).
# In production FRONTEND_DIST points at the Vite `dist/` folder; the API and
# /media are matched first, and everything else falls back to index.html so
# client-side routing works. No-op in local dev when the var isn't set.
# ---------------------------------------------------------------------------
_dist = os.getenv("FRONTEND_DIST")
if _dist:
    FRONTEND_DIST = Path(_dist).resolve()
    if FRONTEND_DIST.is_dir():

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str) -> FileResponse:
            candidate = (FRONTEND_DIST / full_path).resolve()
            # Serve real static files (assets, images, manifest, sw.js…) safely,
            # otherwise return index.html for SPA routes.
            if full_path and FRONTEND_DIST in candidate.parents and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(FRONTEND_DIST / "index.html")
