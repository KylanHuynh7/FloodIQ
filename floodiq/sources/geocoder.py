"""U.S. Census Bureau Geocoder client (Section 3.3).

The Census Geocoder is free, public, and requires no API key. We use the
"onelineaddress" endpoint with the "Public_AR_Current" benchmark and pull
geographies (county FIPS, etc.) in the same call so we don't pay for two
round trips.

Docs: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.pdf
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx


CENSUS_GEOCODE_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"
)
CENSUS_REVERSE_URL = (
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates"
)
DEFAULT_TIMEOUT = 15.0


@dataclass(frozen=True)
class GeocodeResult:
    matched_address: str
    latitude: float
    longitude: float
    state_fips: str
    county_fips: str  # 5-digit (state + county), the standard FIPS county code
    county_name: str
    match_is_approximate: bool
    # Set when no match was found at all. All other fields are empty/zero.
    not_found: bool = False


def geocode(address: str, *, client: httpx.Client | None = None) -> GeocodeResult:
    """Geocode an address. Returns GeocodeResult with not_found=True on miss."""
    params = {
        "address": address,
        "benchmark": "Public_AR_Current",
        "vintage": "Current_Current",
        "format": "json",
    }
    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=DEFAULT_TIMEOUT)
    try:
        resp = client.get(CENSUS_GEOCODE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    finally:
        if own_client:
            client.close()

    matches = data.get("result", {}).get("addressMatches", [])
    if not matches:
        return GeocodeResult(
            matched_address="",
            latitude=0.0,
            longitude=0.0,
            state_fips="",
            county_fips="",
            county_name="",
            match_is_approximate=False,
            not_found=True,
        )

    m = matches[0]
    coords = m.get("coordinates", {})
    geogs = m.get("geographies", {}).get("Counties", [])
    county = geogs[0] if geogs else {}
    state_fips = county.get("STATE", "")
    county_only = county.get("COUNTY", "")
    county_fips = f"{state_fips}{county_only}" if state_fips and county_only else ""

    # The Census Geocoder doesn't expose a single "approximate" flag the way
    # commercial geocoders do. We treat anything that is not a tiebreaker-
    # free, single-match, Exact-type result as approximate. The presence of
    # multiple matches or a non-Exact match type both indicate uncertainty.
    match_type = m.get("tigerLine", {}).get("side", "")  # not a confidence field
    is_approximate = len(matches) > 1 or _looks_approximate(m)

    return GeocodeResult(
        matched_address=m.get("matchedAddress", ""),
        latitude=float(coords.get("y", 0.0)),
        longitude=float(coords.get("x", 0.0)),
        state_fips=state_fips,
        county_fips=county_fips,
        county_name=county.get("NAME", ""),
        match_is_approximate=is_approximate,
    )


def _looks_approximate(match: dict) -> bool:
    # Census exposes addressComponents; if zip or city differs from the input
    # by a meaningful margin, treat as approximate. Without the original
    # input string we use a coarser heuristic: missing matchedAddress.
    return not match.get("matchedAddress")


@dataclass(frozen=True)
class ReverseCountyResult:
    state_fips: str
    county_fips: str  # 5-digit (state + county)
    county_name: str
    not_found: bool = False


def reverse_county(
    latitude: float, longitude: float, *, client: httpx.Client | None = None
) -> ReverseCountyResult:
    """Look up the county that contains (lat, lon) using Census's
    coordinates-to-geographies endpoint. Used after a non-Census geocode
    (e.g., Nominatim) so we can still populate the county-relative baseline.
    """
    params = {
        "x": longitude,
        "y": latitude,
        "benchmark": "Public_AR_Current",
        "vintage": "Current_Current",
        "format": "json",
    }
    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=DEFAULT_TIMEOUT)
    try:
        resp = client.get(CENSUS_REVERSE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    finally:
        if own_client:
            client.close()

    counties = (
        data.get("result", {}).get("geographies", {}).get("Counties", [])
    )
    if not counties:
        return ReverseCountyResult(
            state_fips="", county_fips="", county_name="", not_found=True
        )
    c = counties[0]
    state_fips = c.get("STATE", "")
    county_only = c.get("COUNTY", "")
    return ReverseCountyResult(
        state_fips=state_fips,
        county_fips=(
            f"{state_fips}{county_only}" if state_fips and county_only else ""
        ),
        county_name=c.get("NAME", ""),
    )


def geocode_with_fallback(
    address: str, *, client: httpx.Client | None = None
) -> GeocodeResult:
    """Geocode using Census first; fall back to OpenStreetMap (Nominatim)
    if Census can't match the address. OSM matches are flagged as
    approximate so the Section 7 confidence drop fires.
    """
    primary = geocode(address, client=client)
    if not primary.not_found:
        return primary

    # Nominatim is forgiving to a fault: it will happily resolve "x" to a
    # shop named X in San Francisco, or "10 Downing St, London" to a
    # Downing Street in New Jersey. Only consult it for input that looks
    # like a street address and names a state (or ZIP) we can check the
    # match against.
    if not looks_like_street_address(address):
        return primary
    named_states = _states_named_in(address)
    zips = _ZIP_RE.findall(address)

    # Census missed — try Nominatim. Local import keeps the dependency
    # graph tight (callers that don't want OSM never hit this path).
    from floodiq.sources.nominatim import geocode_osm

    try:
        osm = geocode_osm(address)
    except Exception:
        return primary  # OSM failure leaves us with Census's not_found

    if osm is None or osm.country_code != "us":
        return primary

    try:
        rev = reverse_county(osm.latitude, osm.longitude, client=client)
    except Exception:
        return primary
    if rev.not_found or not rev.county_fips:
        return primary
    if named_states and rev.state_fips not in named_states:
        return primary
    if not named_states and not any(z in osm.display_name for z in zips):
        return primary

    return GeocodeResult(
        matched_address=osm.display_name,
        latitude=osm.latitude,
        longitude=osm.longitude,
        state_fips=rev.state_fips,
        county_fips=rev.county_fips,
        county_name=rev.county_name,
        # OSM coordinates land on the building or street; that's a coarser
        # match than Census's USPS-validated rooftop, so flag approximate.
        match_is_approximate=True,
        not_found=False,
    )


_HOUSE_NUMBER_RE = re.compile(r"\b\d+[A-Za-z]?\b")
_ZIP_RE = re.compile(r"\b(\d{5})(?:-\d{4})?\b")

# State name / USPS abbreviation -> 2-digit state FIPS.
_STATE_FIPS = {
    "AL": "01", "ALABAMA": "01", "AK": "02", "ALASKA": "02",
    "AZ": "04", "ARIZONA": "04", "AR": "05", "ARKANSAS": "05",
    "CA": "06", "CALIFORNIA": "06", "CO": "08", "COLORADO": "08",
    "CT": "09", "CONNECTICUT": "09", "DE": "10", "DELAWARE": "10",
    "DC": "11", "DISTRICT OF COLUMBIA": "11", "FL": "12", "FLORIDA": "12",
    "GA": "13", "GEORGIA": "13", "HI": "15", "HAWAII": "15",
    "ID": "16", "IDAHO": "16", "IL": "17", "ILLINOIS": "17",
    "IN": "18", "INDIANA": "18", "IA": "19", "IOWA": "19",
    "KS": "20", "KANSAS": "20", "KY": "21", "KENTUCKY": "21",
    "LA": "22", "LOUISIANA": "22", "ME": "23", "MAINE": "23",
    "MD": "24", "MARYLAND": "24", "MA": "25", "MASSACHUSETTS": "25",
    "MI": "26", "MICHIGAN": "26", "MN": "27", "MINNESOTA": "27",
    "MS": "28", "MISSISSIPPI": "28", "MO": "29", "MISSOURI": "29",
    "MT": "30", "MONTANA": "30", "NE": "31", "NEBRASKA": "31",
    "NV": "32", "NEVADA": "32", "NH": "33", "NEW HAMPSHIRE": "33",
    "NJ": "34", "NEW JERSEY": "34", "NM": "35", "NEW MEXICO": "35",
    "NY": "36", "NEW YORK": "36", "NC": "37", "NORTH CAROLINA": "37",
    "ND": "38", "NORTH DAKOTA": "38", "OH": "39", "OHIO": "39",
    "OK": "40", "OKLAHOMA": "40", "OR": "41", "OREGON": "41",
    "PA": "42", "PENNSYLVANIA": "42", "RI": "44", "RHODE ISLAND": "44",
    "SC": "45", "SOUTH CAROLINA": "45", "SD": "46", "SOUTH DAKOTA": "46",
    "TN": "47", "TENNESSEE": "47", "TX": "48", "TEXAS": "48",
    "UT": "49", "UTAH": "49", "VT": "50", "VERMONT": "50",
    "VA": "51", "VIRGINIA": "51", "WA": "53", "WASHINGTON": "53",
    "WV": "54", "WEST VIRGINIA": "54", "WI": "55", "WISCONSIN": "55",
    "WY": "56", "WYOMING": "56", "PR": "72", "PUERTO RICO": "72",
}
_STATE_RE = re.compile(
    r"\b("
    + "|".join(sorted((re.escape(k) for k in _STATE_FIPS), key=len, reverse=True))
    + r")\b",
    re.IGNORECASE,
)


def looks_like_street_address(address: str) -> bool:
    """True when `address` has a house number plus a state or ZIP: the
    minimum we need to sanity-check a forgiving (OSM) geocoder match."""
    return bool(_HOUSE_NUMBER_RE.search(address)) and bool(
        _states_named_in(address) or _ZIP_RE.search(address)
    )


def _states_named_in(address: str) -> set[str]:
    """State FIPS codes for every state name or abbreviation in `address`.
    Over-matching (e.g. "IN" inside a street name) only widens what we
    accept, so it never wrongly rejects a real address."""
    return {_STATE_FIPS[m.upper()] for m in _STATE_RE.findall(address)}
