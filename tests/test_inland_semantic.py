"""Pins the tri-state inland semantic from the v1.1 polish.

Three distinct cases the pipeline must surface differently:
  1. Outside NOAA coastal coverage entirely (e.g., Denver CO).
  2. Inside coverage but NOAA projects the point above SLR threshold
     (e.g., Charleston historic district — coastal but elevated).
  3. Inside coverage and NOAA projects inundation (e.g., Tampa Bayshore).

We assert the right ``noaa_region_covered``, ``is_inland``, and
``inland_note`` for each case using a stubbed ``lookup_noaa`` so the
tests don't depend on network calls or NOAA data quirks.
"""

from unittest.mock import patch

from floodiq import pipeline
from floodiq.pipeline import (
    INLAND_NOTE_COVERED_BUT_DRY,
    INLAND_NOTE_OUTSIDE_COVERAGE,
    score_address,
)
from floodiq.sources.fema import FemaLookup
from floodiq.sources.geocoder import GeocodeResult
from floodiq.sources.noaa import NoaaLookup


_GEO = GeocodeResult(
    matched_address="100 Test St, Anywhere, ST 99999",
    latitude=30.0,
    longitude=-90.0,
    state_fips="22",
    county_fips="22071",
    county_name="Orleans",
    match_is_approximate=False,
    not_found=False,
)
_FEMA = FemaLookup(
    zone_raw="AE",
    zone_normalized="AE",
    base_flood_elevation=None,
    effective_date=None,
    unmapped=False,
    zone_subtype=None,
)


def _run_with_noaa(noaa_lookup_factory):
    with (
        patch.object(pipeline, "geocode_with_fallback", return_value=_GEO),
        patch.object(pipeline, "lookup_fema", return_value=_FEMA),
        patch.object(pipeline, "lookup_noaa", side_effect=noaa_lookup_factory),
    ):
        return score_address("100 Test St, Anywhere, ST", persist=False)


def test_outside_coverage():
    """Region not covered at any horizon — note should say outside coverage."""
    def stub(lat, lon, h, *, now_year):
        return NoaaLookup(
            inundation_feet=None,
            projection_year=2026 + h,
            scenario="intermediate",
            data_available=False,
        )
    report = _run_with_noaa(stub)
    assert report.noaa_region_covered is False
    assert report.is_inland is True
    assert report.inland_note == INLAND_NOTE_OUTSIDE_COVERAGE


def test_covered_but_dry():
    """Region covered but every horizon's cell is dry — note acknowledges
    coverage but flags the elevated-point caveat."""
    def stub(lat, lon, h, *, now_year):
        return NoaaLookup(
            inundation_feet=None,  # dry at this point
            projection_year=2026 + h,
            scenario="intermediate",
            data_available=True,  # but region IS covered
        )
    report = _run_with_noaa(stub)
    assert report.noaa_region_covered is True
    assert report.is_inland is True  # no inundation, still treated as inland
    assert report.inland_note == INLAND_NOTE_COVERED_BUT_DRY


def test_covered_and_wet():
    """Region covered AND some horizon shows inundation — no inland note."""
    def stub(lat, lon, h, *, now_year):
        # Dry at 10/30y, wet at 100y — typical coastal trajectory.
        feet = 2.5 if h == 100 else None
        return NoaaLookup(
            inundation_feet=feet,
            projection_year=2026 + h,
            scenario="intermediate",
            data_available=True,
        )
    report = _run_with_noaa(stub)
    assert report.noaa_region_covered is True
    assert report.is_inland is False  # 100y has feet > 0
    assert report.inland_note is None
