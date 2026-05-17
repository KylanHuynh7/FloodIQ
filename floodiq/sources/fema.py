"""FEMA National Flood Hazard Layer (NFHL) client (Section 3.1).

We query FEMA's public NFHL ArcGIS REST endpoint by lat/lon. The NFHL
service has multiple layers; flood zones live in the "S_Fld_Haz_Ar" layer
(layer id 28 on the public service at time of writing). We return the
zone designation, base flood elevation if present, and the effective date
of the underlying FIRM panel so callers can compute map age.

Endpoint: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import httpx


NFHL_FLOOD_HAZARD_LAYER_URL = (
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
)
# FEMA's NFHL endpoint is occasionally slow (5-30s); allow generous time
# and retry once on timeout before giving up.
DEFAULT_TIMEOUT = 45.0


@dataclass(frozen=True)
class FemaLookup:
    # The zone code as returned by NFHL (e.g., "AE", "VE", "X").
    zone_raw: str | None
    # Normalized to one of FEMA_ZONE_SCORES keys, or None if unmapped.
    zone_normalized: str | None
    # Base Flood Elevation in feet, if NFHL provides one for this polygon.
    base_flood_elevation: float | None
    # Effective date of the underlying FIRM panel, or None if not provided.
    effective_date: datetime | None
    # True when no NFHL polygon covers the point — Section 9.1 territory.
    unmapped: bool
    # The "ZONE_SUBTY" attribute, used to detect 0.2% (shaded X) cases.
    zone_subtype: str | None


def lookup_fema(
    latitude: float,
    longitude: float,
    *,
    client: httpx.Client | None = None,
) -> FemaLookup:
    params = {
        "geometry": f"{longitude},{latitude}",
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "FLD_ZONE,ZONE_SUBTY,STATIC_BFE,DFIRM_ID",
        "returnGeometry": "false",
        "f": "json",
    }
    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=DEFAULT_TIMEOUT)
    try:
        try:
            resp = client.get(NFHL_FLOOD_HAZARD_LAYER_URL, params=params)
        except httpx.TimeoutException:
            # One retry — NFHL is sporadically slow but usually fine on
            # a second attempt within a few seconds.
            resp = client.get(NFHL_FLOOD_HAZARD_LAYER_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        effective_date = _fetch_effective_date(features, client)
    finally:
        if own_client:
            client.close()

    if not features:
        return FemaLookup(
            zone_raw=None,
            zone_normalized=None,
            base_flood_elevation=None,
            effective_date=effective_date,
            unmapped=True,
            zone_subtype=None,
        )

    attrs = features[0].get("attributes", {})
    zone_raw = (attrs.get("FLD_ZONE") or "").strip() or None
    subtype = (attrs.get("ZONE_SUBTY") or "").strip() or None
    bfe_raw = attrs.get("STATIC_BFE")
    bfe = (
        float(bfe_raw)
        if bfe_raw is not None and bfe_raw not in (-9999, "-9999")
        else None
    )

    return FemaLookup(
        zone_raw=zone_raw,
        zone_normalized=_normalize_zone_label(zone_raw, subtype),
        base_flood_elevation=bfe,
        effective_date=effective_date,
        unmapped=zone_raw is None,
        zone_subtype=subtype,
    )


def _normalize_zone_label(zone_raw: str | None, subtype: str | None) -> str | None:
    """Translate NFHL's raw FLD_ZONE + ZONE_SUBTY into our table keys."""
    if zone_raw is None:
        return None
    z = zone_raw.strip().upper()
    if z in {"VE", "V"}:
        return "VE"
    if z == "AE":
        return "AE"
    if z == "A":
        return "A"
    if z == "AH":
        return "AH"
    if z == "AO":
        return "AO"
    if z == "X":
        # ZONE_SUBTY distinguishes shaded (0.2 PCT ANNUAL CHANCE FLOOD HAZARD)
        # from unshaded ("AREA OF MINIMAL FLOOD HAZARD" or empty).
        if subtype and "0.2" in subtype.upper():
            return "X_SHADED"
        return "X_UNSHADED"
    if z in {"D", "OPEN WATER", ""}:
        return None
    return None


def _fetch_effective_date(
    features: list[dict], client: httpx.Client
) -> datetime | None:
    """Look up the effective date of the FIRM panel via the DFIRM_ID.

    NFHL's S_FIRM_Pan layer (layer id 3 on the public service) carries
    EFF_DATE per DFIRM panel. We query it cheaply by DFIRM_ID. If anything
    fails we return None — map age is a confidence input, not a blocker.
    """
    if not features:
        return None
    dfirm_id = features[0].get("attributes", {}).get("DFIRM_ID")
    if not dfirm_id:
        return None
    try:
        params = {
            "where": f"DFIRM_ID='{dfirm_id}'",
            "outFields": "EFF_DATE",
            "returnGeometry": "false",
            "f": "json",
            "resultRecordCount": "1",
        }
        resp = client.get(
            "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/3/query",
            params=params,
        )
        resp.raise_for_status()
        feats = resp.json().get("features", [])
        if not feats:
            return None
        eff_ms = feats[0].get("attributes", {}).get("EFF_DATE")
        if eff_ms is None:
            return None
        # ArcGIS dates are Unix epoch milliseconds.
        return datetime.fromtimestamp(eff_ms / 1000, tz=timezone.utc)
    except Exception:
        return None


def map_age_years(effective_date: datetime | None, *, now: datetime | None = None) -> float | None:
    if effective_date is None:
        return None
    ref = now or datetime.now(tz=timezone.utc)
    return (ref - effective_date).days / 365.25
