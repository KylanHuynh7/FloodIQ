"""Top-level scoring pipeline (METHODOLOGY.md orchestrator).

address -> geocode -> FEMA + NOAA -> normalize -> composite per horizon
       -> confidence per horizon -> county percentile -> summary headline.

All Section 9 edge cases are funneled through ``score_address``: unmapped
FEMA zone, imprecise geocode, inland properties, addresses outside CONUS.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

import httpx

from floodiq import METHODOLOGY_VERSION
from floodiq.baseline.county import percentile_in_county
from floodiq.baseline.national import percentile_national
from floodiq.baseline.seed_filler import ensure_county_seeded
from floodiq.cache.store import (
    composite_scores_in_county,
    composite_scores_national,
    open_store,
    record_score,
)
from floodiq.scoring.composite import HORIZONS, composite_all_horizons
from floodiq.scoring.confidence import (
    ConfidenceInputs,
    compute_confidence,
    disagreement_flag,
)
from floodiq.scoring.normalize import (
    normalize_fema_zone,
    normalize_noaa_inundation,
)
from floodiq.sources.fema import lookup_fema, map_age_years
from floodiq.sources.geocoder import geocode_with_fallback
from floodiq.sources.noaa import lookup_noaa


UNMAPPED_MESSAGE = (
    "FloodIQ does not have sufficient public data to score this address. "
    "This typically occurs for addresses in unmapped rural areas or recent "
    "annexations. We recommend consulting your local floodplain administrator."
)
UPSTREAM_UNAVAILABLE_MESSAGE = (
    "An upstream data source (FEMA NFHL or U.S. Census Geocoder) did not "
    "respond in time. Please try again in a few moments."
)
OUTSIDE_CONUS_MESSAGE = (
    "FloodIQ v1 supports addresses in the continental United States only. "
    "Support for US territories is planned for a future version."
)
ADDRESS_NOT_FOUND_MESSAGE = (
    "We couldn't match this address. The U.S. Census Geocoder needs a "
    "fully specified address — please include city and state (and ZIP if "
    "you have it), e.g. \"18411 Tuba St, Tarzana, CA 91356\". Some newer "
    "or rural addresses may not be in Census's database at all."
)
# Note shown when the property has no coastal SLR signal contributing to
# the score. Wording differs based on *why*: outside NOAA coverage entirely
# vs covered but the modeled SLR doesn't reach this point.
INLAND_NOTE_OUTSIDE_COVERAGE = (
    "This property is outside NOAA's v1.1 coastal SLR coverage (currently "
    "CONUS coastal states only). The 30- and 100-year scores are based on "
    "FEMA flood zone data alone, which reflects historical patterns and may "
    "not capture changing flood risks from increased precipitation or "
    "inland flooding. This is a documented limitation of FloodIQ v1.1."
)
INLAND_NOTE_COVERED_BUT_DRY = (
    "NOAA's coastal SLR raster covers this address, but its modeled "
    "inundation does not reach this specific point under the Intermediate "
    "scenario at the horizons checked. Note that NOAA's raster is sampled "
    "at the geocoded coordinate and a small surrounding neighborhood; "
    "if your property is genuinely waterfront and this surprises you, the "
    "geocoded point may have landed on an elevated building footprint. "
    "Treat the 100-year score as a conservative lower bound."
)


# US territory state FIPS codes that v1 does not support (Section 9.4).
NON_CONUS_STATE_FIPS = {
    "02",  # Alaska — coastal but outside the v1 CONUS scope per spec wording
    "15",  # Hawaii
    "60",  # American Samoa
    "66",  # Guam
    "69",  # Northern Mariana Islands
    "72",  # Puerto Rico
    "78",  # U.S. Virgin Islands
}


@dataclass
class HorizonReport:
    horizon_years: int
    fema_component: int
    noaa_component: int
    composite_absolute: float  # 0-100 pre-baseline
    composite_county_percentile: float | None  # 0-100, None if no baseline yet
    composite_national_percentile: float | None  # 0-100, None if no baseline yet
    confidence_label: str
    confidence_drivers: list[str]
    disagreement: bool


@dataclass
class ScoreReport:
    methodology_version: str
    scored_at: str  # ISO-8601 UTC
    input_address: str
    matched_address: str
    latitude: float
    longitude: float
    county_fips: str
    county_name: str
    fema_zone_raw: str | None
    fema_zone_normalized: str | None
    fema_map_effective_date: str | None
    fema_map_age_years: float | None
    # noaa_region_covered: lat/lon falls inside one of the v1.1 NOAA
    #   coastal sub-regions. Says nothing about whether the cell at this
    #   point is wet — only that we consulted the NOAA dataset.
    # noaa_data_available: at least one horizon returned a real (positive)
    #   inundation reading. False either because the region isn't covered
    #   OR because every horizon's cell came back dry/nodata.
    # is_inland: kept for backwards compatibility — same as
    #   `not noaa_data_available`. Use the more specific flags above
    #   for new UI decisions.
    noaa_region_covered: bool
    noaa_data_available: bool
    is_inland: bool
    geocoder_match_is_approximate: bool
    horizons: dict[int, HorizonReport] = field(default_factory=dict)
    summary_headline: str = ""
    inland_note: str | None = None
    # Set when no score is returned (unmapped, outside CONUS, etc.).
    error: str | None = None


def score_address(
    address: str,
    *,
    now: datetime | None = None,
    persist: bool = True,
) -> ScoreReport:
    now = now or datetime.now(tz=timezone.utc)
    now_year = now.year

    try:
        with httpx.Client(timeout=45.0) as http:
            geo = geocode_with_fallback(address, client=http)
            if geo.not_found:
                return _error_report(
                    address, ADDRESS_NOT_FOUND_MESSAGE, now
                )
            if geo.state_fips in NON_CONUS_STATE_FIPS:
                return _error_report(
                    address, OUTSIDE_CONUS_MESSAGE, now, geo=geo
                )

            fema = lookup_fema(geo.latitude, geo.longitude, client=http)
    except (httpx.TimeoutException, httpx.HTTPError):
        return _error_report(address, UPSTREAM_UNAVAILABLE_MESSAGE, now)

    if fema.unmapped or fema.zone_normalized is None:
        return _error_report(address, UNMAPPED_MESSAGE, now, geo=geo, fema=fema)

    fema_normalized = normalize_fema_zone(fema.zone_normalized)
    assert fema_normalized is not None  # guarded above
    fema_age = map_age_years(fema.effective_date, now=now)

    noaa_by_horizon: dict[int, int] = {}
    noaa_feet_by_horizon: dict[int, float | None] = {}
    is_inland = True  # flipped to False the moment any horizon has feet > 0
    noaa_signal_available = False  # True if any horizon returned a real reading
    noaa_region_covered = False  # True if any horizon found the region in coverage
    for h in HORIZONS:
        nl = lookup_noaa(geo.latitude, geo.longitude, h, now_year=now_year)
        noaa_feet_by_horizon[h] = nl.inundation_feet
        normalized = normalize_noaa_inundation(nl.inundation_feet)
        noaa_by_horizon[h] = normalized
        if nl.data_available:
            noaa_region_covered = True
        if nl.inundation_feet is not None:
            noaa_signal_available = True
        if nl.inundation_feet and nl.inundation_feet > 0:
            is_inland = False

    composites = composite_all_horizons(fema_normalized, noaa_by_horizon)

    # Section 6: ensure the user's county has a populated seed distribution
    # before we compute percentiles. One-time per county; subsequent
    # requests are fast. Failures here are non-fatal — percentile just
    # reports "pending" instead.
    county_extra: dict[int, list[float]] = {h: [] for h in HORIZONS}
    national_extra: dict[int, list[float]] = {h: [] for h in HORIZONS}
    if persist:
        try:
            with open_store() as conn:
                try:
                    ensure_county_seeded(conn, geo.county_fips, now_year=now_year)
                except Exception:
                    pass
                for h in HORIZONS:
                    county_extra[h] = composite_scores_in_county(
                        conn, geo.county_fips, h
                    )
                    national_extra[h] = composite_scores_national(conn, h)
        except Exception:
            # Cache problems should never block a score — Section 11
            # reproducibility is about determinism of inputs, not infra.
            pass

    horizons: dict[int, HorizonReport] = {}
    for h in HORIZONS:
        c = composites[h]
        conf = compute_confidence(
            ConfidenceInputs(
                fema_map_age_years=fema_age,
                fema_normalized=fema_normalized,
                noaa_normalized=noaa_by_horizon[h],
                noaa_signal_available=noaa_signal_available,
                is_inland=is_inland,
                horizon_years=h,
                geocoder_match_is_approximate=geo.match_is_approximate,
            )
        )
        pct_county = percentile_in_county(
            c.composite,
            county_fips=geo.county_fips,
            additional_scores=county_extra[h],
        )
        pct_national = percentile_national(
            c.composite,
            additional_scores=national_extra[h],
        )
        horizons[h] = HorizonReport(
            horizon_years=h,
            fema_component=c.fema_component,
            noaa_component=c.noaa_component,
            composite_absolute=c.composite,
            composite_county_percentile=pct_county.percentile,
            composite_national_percentile=pct_national.percentile,
            confidence_label=conf.label,
            confidence_drivers=conf.drivers,
            disagreement=conf.disagreement,
        )

    report = ScoreReport(
        methodology_version=METHODOLOGY_VERSION,
        scored_at=now.isoformat(),
        input_address=address,
        matched_address=geo.matched_address,
        latitude=geo.latitude,
        longitude=geo.longitude,
        county_fips=geo.county_fips,
        county_name=geo.county_name,
        fema_zone_raw=fema.zone_raw,
        fema_zone_normalized=fema.zone_normalized,
        fema_map_effective_date=(
            fema.effective_date.isoformat() if fema.effective_date else None
        ),
        fema_map_age_years=fema_age,
        noaa_region_covered=noaa_region_covered,
        noaa_data_available=any(v is not None for v in noaa_feet_by_horizon.values()),
        is_inland=is_inland,
        geocoder_match_is_approximate=geo.match_is_approximate,
        horizons=horizons,
        summary_headline=_summary_headline(horizons, is_inland),
        inland_note=(
            INLAND_NOTE_OUTSIDE_COVERAGE
            if is_inland and not noaa_region_covered
            else INLAND_NOTE_COVERED_BUT_DRY
            if is_inland and noaa_region_covered
            else None
        ),
    )

    if persist:
        try:
            with open_store() as conn:
                record_score(
                    conn,
                    address_input=address,
                    matched_address=geo.matched_address,
                    county_fips=geo.county_fips,
                    methodology_version=METHODOLOGY_VERSION,
                    payload=_report_to_dict(report),
                )
        except Exception:
            pass

    return report


def _summary_headline(
    horizons: dict[int, HorizonReport], is_inland: bool
) -> str:
    s10 = horizons[10].composite_absolute
    s100 = horizons[100].composite_absolute
    any_disagreement = any(h.disagreement for h in horizons.values())

    if s10 >= 70:
        near = "High near-term flood risk"
    elif s10 >= 40:
        near = "Moderate near-term flood risk"
    else:
        near = "Low near-term flood risk"

    parts = [near]
    if is_inland:
        # For inland properties the 10/30/100 spread is just FEMA weight
        # rebalancing against NOAA=0; reporting a trajectory would imply
        # a forward-looking signal we do not have (Section 9.3).
        parts.append(
            "inland property — 100-year score reflects FEMA signal only, "
            "no NOAA-driven trend"
        )
    else:
        rising = s100 - s10
        if rising >= 20:
            trend = "rising substantially over 100 years"
        elif rising >= 5:
            trend = "rising over 100 years"
        elif rising <= -5:
            trend = "decreasing over 100 years"
        else:
            trend = "stable over 100 years"
        parts.append(trend)

    if any_disagreement:
        parts.append("FEMA and NOAA disagree — see source breakdown")
    return "; ".join(parts) + "."


def _error_report(
    address: str,
    message: str,
    now: datetime,
    *,
    geo=None,
    fema=None,
) -> ScoreReport:
    return ScoreReport(
        methodology_version=METHODOLOGY_VERSION,
        scored_at=now.isoformat(),
        input_address=address,
        matched_address=geo.matched_address if geo else "",
        latitude=geo.latitude if geo else 0.0,
        longitude=geo.longitude if geo else 0.0,
        county_fips=geo.county_fips if geo else "",
        county_name=geo.county_name if geo else "",
        fema_zone_raw=fema.zone_raw if fema else None,
        fema_zone_normalized=fema.zone_normalized if fema else None,
        fema_map_effective_date=(
            fema.effective_date.isoformat() if fema and fema.effective_date else None
        ),
        fema_map_age_years=None,
        noaa_region_covered=False,
        noaa_data_available=False,
        is_inland=False,
        geocoder_match_is_approximate=(
            geo.match_is_approximate if geo else False
        ),
        horizons={},
        summary_headline="",
        inland_note=None,
        error=message,
    )


def _report_to_dict(r: ScoreReport) -> dict:
    d = asdict(r)
    # asdict turns the int-keyed horizons dict into the same shape; JSON
    # serialization will stringify the ints — fine for our purposes.
    return d
