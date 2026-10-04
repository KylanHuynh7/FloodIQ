"""NFIP flood insurance claims history (METHODOLOGY.md Section 3.4).

A display-only "flood history" indicator: how many National Flood Insurance
Program claims have been paid in the property's Census tract, and how many of
those were on properties outside today's FEMA high-risk zones (A*/V*). The
second number is the useful one for inland risk: it shows flooding that the
flood maps don't capture, such as heavy-rain (pluvial) flooding. It does not
enter the score.

Source: OpenFEMA "NFIP Redacted Claims" v3,
https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3

Note: v3 locates claims by `censusGeoid`, a 12-digit Census block group
GEOID, so a tract is matched by its 11-digit prefix. (The documented
`censusTract` field does not exist in the v3 API.)
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass

import httpx

CLAIMS_URL = "https://www.fema.gov/api/open/v3/NfipClaims"
DEFAULT_TIMEOUT = 20.0


@dataclass(frozen=True)
class ClaimsHistory:
    tract_geoid: str
    claims_in_tract: int
    # Claims on properties whose *current* FEMA zone is not A*/V*.
    claims_outside_high_risk: int
    # County claims divided by the county's tract count, for context.
    county_avg_per_tract: float | None

    def to_dict(self) -> dict:
        return asdict(self)


def _count(client: httpx.Client, odata_filter: str) -> int:
    resp = client.get(
        CLAIMS_URL,
        params={
            "$filter": odata_filter,
            "$inlinecount": "allpages",
            "$top": "1",
            "$select": "yearOfLoss",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    count = (data.get("metadata") or {}).get("count")
    if not isinstance(count, int):
        raise ValueError(f"unexpected OpenFEMA response: {str(data)[:200]}")
    return count


def lookup_claims(
    tract_geoid: str,
    *,
    county_tract_count: int,
    client: httpx.Client | None = None,
) -> ClaimsHistory | None:
    """Claims history for a tract, or None if unavailable for any reason.

    Never raises: this is supplementary context and must not block a score.
    """
    if len(tract_geoid) != 11 or not tract_geoid.isdigit():
        return None
    county = tract_geoid[:5]
    in_tract = f"startswith(censusGeoid,'{tract_geoid}')"
    filters = {
        "tract": in_tract,
        "outside": (
            f"{in_tract} and not startswith(floodZoneCurrent,'A') "
            "and not startswith(floodZoneCurrent,'V')"
        ),
        "county": f"startswith(censusGeoid,'{county}')",
    }
    own_client = client is None
    c = client or httpx.Client(timeout=DEFAULT_TIMEOUT)
    try:
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {k: pool.submit(_count, c, f) for k, f in filters.items()}
            counts = {k: fut.result() for k, fut in futures.items()}
    except Exception:
        return None
    finally:
        if own_client:
            c.close()
    return ClaimsHistory(
        tract_geoid=tract_geoid,
        claims_in_tract=counts["tract"],
        claims_outside_high_risk=counts["outside"],
        county_avg_per_tract=(
            round(counts["county"] / county_tract_count, 1)
            if county_tract_count > 0
            else None
        ),
    )
