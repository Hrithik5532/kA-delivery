"""FastAPI application entrypoint for the delivery partner API."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.ws_manager import manager
from app.api.v1 import (
    admin,
    admin_api_keys,
    admin_salary,
    admin_shifts,
    auth,
    deliveries,
    maps,
    partner,
    rider,
    tracking_ws,
)

# Import models so metadata is populated before create_all.
import app.models  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    from app.db_init import init_database

    init_database()
    manager.set_loop(asyncio.get_running_loop())
    scheduler = None
    if settings.environment.strip().lower() != "test":
        from app.services.shift_service import run_scheduler

        scheduler = asyncio.create_task(run_scheduler())
    yield
    if scheduler is not None:
        scheduler.cancel()


app = FastAPI(
    title="Khana Delivery Partner API",
    version="1.0.0",
    description="Delivery partner (rider) backend for Khana Anywhere.",
    lifespan=lifespan,
)

# `allow_origins=["*"]` with `allow_credentials=True` is an invalid combo that
# browsers reject. Only enable credentials when explicit origins are configured
# (set CORS_ORIGINS to your admin/web origins in production). Auth uses Bearer
# tokens, not cookies, so credentials can stay off for the wildcard dev case.
_log = logging.getLogger("app.errors")


@app.middleware("http")
async def _json_500(request: Request, call_next):
    """Turn unhandled exceptions into a JSON 500 *inside* the CORS middleware.

    Otherwise Starlette answers from its outermost error handler without CORS
    headers, and browsers report a misleading "blocked by CORS policy" instead
    of the real server error.
    """
    try:
        return await call_next(request)
    except Exception:
        _log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Check the API logs for details."},
        )


_cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


api = APIRouter(prefix="/api/v1")
api.include_router(auth.router)
api.include_router(rider.router)
api.include_router(maps.router)
api.include_router(deliveries.router)
api.include_router(admin.router)
api.include_router(admin_api_keys.router)
api.include_router(admin_shifts.router)
api.include_router(admin_salary.router)
api.include_router(partner.router)
api.include_router(tracking_ws.router)


@api.get("/config", tags=["config"])
def client_config() -> dict:
    """Non-secret tunables the mobile app needs."""
    return {
        "map_provider": settings.map_provider,
        "location_update_interval_seconds": settings.location_update_interval_seconds,
        "location_distance_threshold_meters": settings.location_distance_threshold_meters,
        "location_stale_seconds": settings.location_stale_seconds,
        "ws_reconnect_base_ms": settings.ws_reconnect_base_ms,
        "ws_reconnect_max_ms": settings.ws_reconnect_max_ms,
    }


app.include_router(api)


@app.get("/", tags=["health"])
def root() -> dict:
    return {
        "service": "Khana Delivery Partner API",
        "status": "ok",
        "docs": "/docs",
        "api": "/api/v1",
        "health": "/health",
    }


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
