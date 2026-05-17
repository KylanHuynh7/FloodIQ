"""Normalization tables from METHODOLOGY.md Section 4.

Both FEMA zone designations and NOAA inundation depths are mapped to a
0-100 component scale so they can be combined under Section 5's horizon
weights. The numbers below are authoritative per the methodology and must
not be edited without a corresponding methodology revision.
"""

from __future__ import annotations


FEMA_ZONE_SCORES: dict[str, int] = {
    "VE": 90,
    "AE": 75,
    "A": 65,
    "AH": 55,
    "AO": 50,
    "X_SHADED": 30,
    "X_UNSHADED": 10,
}


def normalize_fema_zone(zone: str | None) -> int | None:
    """Map a FEMA zone code to its 0-100 component score.

    Returns None for undetermined/unmapped zones — Section 9.1 says we must
    not return a score in that case, and the caller is responsible for
    surfacing the unmapped-area message.
    """
    if zone is None:
        return None
    key = _canonical_zone(zone)
    return FEMA_ZONE_SCORES.get(key)


def _canonical_zone(zone: str) -> str:
    z = zone.strip().upper()
    # FEMA returns "X" with a separate shaded/unshaded flag in some feeds.
    # Callers that know the shading should pass "X_SHADED" or "X_UNSHADED".
    # A bare "X" is ambiguous — we treat it as unshaded (the lower-risk
    # interpretation) only when no shading info is available; callers that
    # have shading info should pass the explicit key.
    if z in {"X", "X500"}:
        return "X_UNSHADED"
    return z


def normalize_noaa_inundation(feet: float | None) -> int:
    """Map projected inundation depth (feet) to a 0-100 component score.

    Per Section 4.2 the mapping is stepped, not continuous. None or 0 feet
    yields 0 — inland properties or locations with no projected inundation.
    """
    if feet is None or feet <= 0:
        return 0
    if feet <= 1.0:
        return 25
    if feet <= 2.0:
        return 50
    if feet <= 3.0:
        return 75
    return 100
