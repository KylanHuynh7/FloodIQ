"""Verify Census→OSM fallback orchestration without hitting real APIs."""

from unittest.mock import patch

from floodiq.sources import geocoder
from floodiq.sources.geocoder import (
    GeocodeResult,
    ReverseCountyResult,
    geocode_with_fallback,
)
from floodiq.sources.nominatim import OsmMatch


CENSUS_HIT = GeocodeResult(
    matched_address="100 MAIN ST, SOMEWHERE, ST, 12345",
    latitude=40.0,
    longitude=-75.0,
    state_fips="42",
    county_fips="42017",
    county_name="Bucks",
    match_is_approximate=False,
    not_found=False,
)
CENSUS_MISS = GeocodeResult(
    matched_address="",
    latitude=0.0,
    longitude=0.0,
    state_fips="",
    county_fips="",
    county_name="",
    match_is_approximate=False,
    not_found=True,
)


def test_returns_census_hit_without_calling_osm():
    with (
        patch.object(geocoder, "geocode", return_value=CENSUS_HIT) as census,
        patch("floodiq.sources.nominatim.geocode_osm") as osm,
    ):
        result = geocode_with_fallback("100 Main St")
        assert result is CENSUS_HIT
        census.assert_called_once()
        osm.assert_not_called()


def test_falls_back_to_osm_when_census_misses():
    osm_match = OsmMatch(
        display_name="18411 Tuba Street, Tarzana, Los Angeles, CA, USA",
        latitude=34.17,
        longitude=-118.55,
        country_code="us",
    )
    rev = ReverseCountyResult(
        state_fips="06",
        county_fips="06037",
        county_name="Los Angeles",
        not_found=False,
    )
    with (
        patch.object(geocoder, "geocode", return_value=CENSUS_MISS),
        patch("floodiq.sources.nominatim.geocode_osm", return_value=osm_match),
        patch.object(geocoder, "reverse_county", return_value=rev),
    ):
        result = geocode_with_fallback("18411 Tuba Street")
        assert result.not_found is False
        assert result.county_fips == "06037"
        assert result.county_name == "Los Angeles"
        assert result.latitude == 34.17
        # OSM matches must be flagged approximate so the Section 7 penalty fires.
        assert result.match_is_approximate is True


def test_osm_non_us_match_is_treated_as_not_found():
    osm_match = OsmMatch(
        display_name="123 Some Road, Toronto, Canada",
        latitude=43.65,
        longitude=-79.38,
        country_code="ca",
    )
    with (
        patch.object(geocoder, "geocode", return_value=CENSUS_MISS),
        patch("floodiq.sources.nominatim.geocode_osm", return_value=osm_match),
    ):
        result = geocode_with_fallback("123 Some Road")
        assert result.not_found is True


def test_osm_miss_returns_census_not_found():
    with (
        patch.object(geocoder, "geocode", return_value=CENSUS_MISS),
        patch("floodiq.sources.nominatim.geocode_osm", return_value=None),
    ):
        result = geocode_with_fallback("nonexistent garbage")
        assert result.not_found is True


def test_reverse_county_failure_keeps_us_safe():
    osm_match = OsmMatch(
        display_name="somewhere in the US",
        latitude=40.0,
        longitude=-100.0,
        country_code="us",
    )
    miss_rev = ReverseCountyResult(
        state_fips="", county_fips="", county_name="", not_found=True
    )
    with (
        patch.object(geocoder, "geocode", return_value=CENSUS_MISS),
        patch("floodiq.sources.nominatim.geocode_osm", return_value=osm_match),
        patch.object(geocoder, "reverse_county", return_value=miss_rev),
    ):
        result = geocode_with_fallback("ambiguous query")
        assert result.not_found is True
