"""Nominatim (OpenStreetMap) geocoder — fallback for the Census Geocoder.

The Census Geocoder is strict about USPS-standard address format and has
known coverage gaps. Nominatim is much more forgiving with casual user
input. Per Nominatim's TOS:
  - Limit to ~1 req/sec from the public instance
  - Supply a User-Agent identifying the application
  - Use for low-volume traffic only (a few requests per user is fine)

See: https://operations.osmfoundation.org/policies/nominatim/
"""

from __future__ import annotations

from dataclasses import dataclass

import time

import httpx

from floodiq import METHODOLOGY_VERSION


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = f"FloodIQ/{METHODOLOGY_VERSION} (educational flood-risk tool)"
DEFAULT_TIMEOUT = 15.0
# Nominatim's public instance enforces ~1 req/sec; back off and retry
# once on transient throttle/server errors before giving up.
RETRY_STATUS_CODES = {429, 502, 503, 504}


@dataclass(frozen=True)
class OsmMatch:
    display_name: str
    latitude: float
    longitude: float
    country_code: str  # 2-letter lowercase ISO code ("us" for United States)


def geocode_osm(
    address: str, *, client: httpx.Client | None = None
) -> OsmMatch | None:
    """Return the best Nominatim match, or None if no match."""
    params = {
        "q": address,
        "format": "json",
        "limit": "1",
        "countrycodes": "us",
        "addressdetails": "1",
    }
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=DEFAULT_TIMEOUT)
    try:
        resp = client.get(NOMINATIM_URL, params=params, headers=headers)
        if resp.status_code in RETRY_STATUS_CODES:
            time.sleep(1.2)  # respect Nominatim's 1 req/sec ceiling
            resp = client.get(NOMINATIM_URL, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    finally:
        if own_client:
            client.close()

    if not data:
        return None
    m = data[0]
    addr = m.get("address", {}) or {}
    try:
        lat = float(m["lat"])
        lon = float(m["lon"])
    except (KeyError, ValueError):
        return None
    return OsmMatch(
        display_name=m.get("display_name", ""),
        latitude=lat,
        longitude=lon,
        country_code=(addr.get("country_code") or "").lower(),
    )
