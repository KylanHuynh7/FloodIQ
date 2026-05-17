"""Tests for the NOAA SLR module's pure-function bits.

The raster-sampling code path is integration-tested by
scripts/validate_noaa_coastal.py (network-dependent). Here we cover the
horizon→SLR mapping, snap-to-published-depth, and region routing
without hitting the network.
"""

import pytest

from floodiq.sources.noaa import (
    INTERMEDIATE_SLR_FEET_BY_YEAR,
    PUBLISHED_DEPTHS_FT,
    _region_for,
    horizon_to_slr_feet,
    snap_to_published_depth,
)


class TestHorizonToSlrFeet:
    def test_anchors_at_2000(self):
        assert horizon_to_slr_feet(-26, now_year=2026) == pytest.approx(0)

    def test_intermediate_2030_published_value(self):
        # In 2030 the published Intermediate scenario value is 0.5 ft.
        assert horizon_to_slr_feet(4, now_year=2026) == pytest.approx(0.5)

    def test_intermediate_2050(self):
        assert horizon_to_slr_feet(24, now_year=2026) == pytest.approx(1.0)

    def test_intermediate_2100(self):
        assert horizon_to_slr_feet(74, now_year=2026) == pytest.approx(3.3)

    def test_clamps_past_last_anchor(self):
        # Beyond 2150 we clamp to the last published value.
        assert horizon_to_slr_feet(200, now_year=2026) == pytest.approx(
            INTERMEDIATE_SLR_FEET_BY_YEAR[2150]
        )

    def test_interpolates_between_anchors(self):
        # 2040 sits halfway between 2030 (0.5) and 2050 (1.0).
        assert horizon_to_slr_feet(14, now_year=2026) == pytest.approx(0.75)


class TestSnapToPublishedDepth:
    def test_snaps_to_nearest_half_foot(self):
        assert snap_to_published_depth(0.6) == 0.5
        assert snap_to_published_depth(0.75) == 1.0  # banker's rounding hits 1.0
        assert snap_to_published_depth(1.2) == 1.0
        assert snap_to_published_depth(3.8) == 4.0
        assert snap_to_published_depth(3.6) == 3.5

    def test_clamps_to_published_range(self):
        assert snap_to_published_depth(-5) == 0.0
        assert snap_to_published_depth(99) == PUBLISHED_DEPTHS_FT[-1]

    def test_non_fl_states_use_odd_half_grid(self):
        # SC publishes 0.5, 1.5, 2.5, ... 9.5 only. A 1.0ft target should
        # snap to 1.5 (tie broken in favor of the larger depth), not 1.0
        # (which doesn't exist as a file).
        assert snap_to_published_depth(1.0, state="SC") == 1.5
        assert snap_to_published_depth(0.6, state="SC") == 0.5
        assert snap_to_published_depth(3.8, state="LA") == 3.5
        assert snap_to_published_depth(4.1, state="TX") == 4.5
        assert snap_to_published_depth(99, state="NY") == 9.5


class TestRegionRouting:
    def test_tampa_routes_to_fl_west_1(self):
        # Bayshore Blvd Tampa
        assert _region_for(27.93, -82.47) == ("FL", "FL_West_1")

    def test_miami_beach_routes_to_fl_se(self):
        assert _region_for(25.78, -80.13) == ("FL", "FL_SE")

    def test_key_west_routes_to_fl_keys(self):
        assert _region_for(24.55, -81.78) == ("FL", "FL_Keys")

    def test_charleston_routes_to_sc_central(self):
        # Downtown Charleston SC
        assert _region_for(32.78, -79.93) == ("SC", "SC_Central")

    def test_hilton_head_routes_to_sc_south(self):
        assert _region_for(32.21, -80.74) == ("SC", "SC_South")

    def test_inland_returns_none(self):
        # Truly inland points well outside any v1 NOAA coastal region.
        # (DC's tidal Potomac is now in VA_N coverage, and the LA basin
        # is in CA_South — neither is truly inland anymore.)
        # Denver CO — Rocky Mountains
        assert _region_for(39.74, -104.99) is None
        # Topeka KS — Great Plains
        assert _region_for(39.05, -95.68) is None
        # Salt Lake City UT — Great Basin
        assert _region_for(40.76, -111.89) is None
        # Cedar Rapids IA
        assert _region_for(41.98, -91.67) is None

    def test_expanded_v1_coverage(self):
        # Sanity-check that the post-discovery expansion picks up the
        # expected states. We don't assert exact region naming so this
        # doesn't break if NOAA renames a sub-region.
        for label, lat, lon in [
            ("New Orleans", 29.95, -90.07),
            ("Galveston", 29.30, -94.79),
            ("Mobile Bay", 30.69, -88.04),  # AL statewide raster
            ("Savannah", 32.08, -81.09),
            ("Outer Banks", 35.55, -75.47),
            ("Norfolk", 36.85, -76.29),
            ("Annapolis", 38.98, -76.49),
            ("Atlantic City", 39.36, -74.42),
            ("Manhattan", 40.71, -74.00),
            ("Boston", 42.36, -71.06),
            ("Portland ME", 43.66, -70.26),
            ("San Francisco", 37.77, -122.42),
            ("Long Beach CA", 33.77, -118.19),
            ("Seattle", 47.61, -122.33),
        ]:
            assert _region_for(lat, lon) is not None, f"{label} should be covered"

    def test_ocean_point_routes_to_region(self):
        # A point just east of Miami Beach (in the Atlantic) still maps to
        # a region — the sampler will return None for the actual value
        # because it'll be open water, but routing alone shouldn't fail.
        assert _region_for(25.78, -80.05) == ("FL", "FL_SE")
