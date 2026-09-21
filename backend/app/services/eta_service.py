"""Distance and ETA estimation (pure functions, independently testable)."""
from __future__ import annotations

import math

# Rough average delivery speed for ETA estimates (m/s). ~18 km/h city riding.
DEFAULT_SPEED_MPS = 5.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return haversine_km(lat1, lng1, lat2, lng2) * 1000.0


def estimate_eta_minutes(
    distance_km: float, speed_mps: float = DEFAULT_SPEED_MPS
) -> float:
    """Estimate travel time in minutes for a straight-line distance."""
    if speed_mps <= 0:
        speed_mps = DEFAULT_SPEED_MPS
    seconds = (distance_km * 1000.0) / speed_mps
    return round(seconds / 60.0, 1)
