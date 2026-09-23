from __future__ import annotations

from pydantic import BaseModel, Field


class LatLngOut(BaseModel):
    lat: float
    lng: float


class DirectionsOut(BaseModel):
    points: list[LatLngOut]
    distance_meters: int | None = None
    duration_seconds: int | None = None
    source: str = Field(description="google | straight")


class PlaceSuggestionOut(BaseModel):
    place_id: str
    label: str
    secondary: str | None = None


class PlaceDetailsOut(BaseModel):
    lat: float
    lng: float
    label: str
    address: str


class PlaceAutocompleteIn(BaseModel):
    input: str = Field(min_length=2, max_length=200)
