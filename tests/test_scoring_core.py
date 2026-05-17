"""Tests pinning Sections 4, 5, 7, 8 of METHODOLOGY.md.

If any of these fail, either the methodology has changed (and the test
should be updated alongside the spec) or the code drifted (and the code
should be fixed). Do not silently adjust expected values.
"""

import pytest

from floodiq.scoring.composite import HORIZON_WEIGHTS, composite_for_horizon
from floodiq.scoring.confidence import (
    ConfidenceInputs,
    ConfidenceTier,
    compute_confidence,
    disagreement_flag,
)
from floodiq.scoring.normalize import normalize_fema_zone, normalize_noaa_inundation


class TestFemaZoneNormalization:
    @pytest.mark.parametrize(
        "zone,expected",
        [
            ("VE", 90),
            ("AE", 75),
            ("A", 65),
            ("AH", 55),
            ("AO", 50),
            ("X_SHADED", 30),
            ("X_UNSHADED", 10),
        ],
    )
    def test_table_4_1(self, zone, expected):
        assert normalize_fema_zone(zone) == expected

    def test_unmapped_returns_none(self):
        assert normalize_fema_zone(None) is None
        assert normalize_fema_zone("UNDETERMINED") is None
        assert normalize_fema_zone("D") is None  # Zone D = undetermined

    def test_bare_x_treated_as_unshaded(self):
        assert normalize_fema_zone("X") == 10

    def test_case_insensitive(self):
        assert normalize_fema_zone("ae") == 75


class TestNoaaNormalization:
    @pytest.mark.parametrize(
        "feet,expected",
        [
            (0, 0),
            (None, 0),
            (0.5, 25),
            (1.0, 25),
            (1.5, 50),
            (2.0, 50),
            (2.5, 75),
            (3.0, 75),
            (3.1, 100),
            (10.0, 100),
        ],
    )
    def test_table_4_2(self, feet, expected):
        assert normalize_noaa_inundation(feet) == expected


class TestHorizonWeights:
    def test_table_5(self):
        assert HORIZON_WEIGHTS == {
            10: (1.0, 0.0),
            30: (0.7, 0.3),
            100: (0.3, 0.7),
        }

    def test_weights_sum_to_one(self):
        for fema_w, noaa_w in HORIZON_WEIGHTS.values():
            assert fema_w + noaa_w == pytest.approx(1.0)

    def test_composite_10_year_is_pure_fema(self):
        s = composite_for_horizon(10, fema_normalized=75, noaa_normalized=100)
        assert s.composite == 75

    def test_composite_30_year_weighted(self):
        s = composite_for_horizon(30, fema_normalized=75, noaa_normalized=50)
        assert s.composite == pytest.approx(0.7 * 75 + 0.3 * 50)

    def test_composite_100_year_weighted(self):
        s = composite_for_horizon(100, fema_normalized=75, noaa_normalized=50)
        assert s.composite == pytest.approx(0.3 * 75 + 0.7 * 50)

    def test_unknown_horizon_rejected(self):
        with pytest.raises(ValueError):
            composite_for_horizon(50, 0, 0)


class TestDisagreement:
    def test_threshold_is_strict_greater_than_30(self):
        assert disagreement_flag(75, 45) is False  # diff = 30, not >30
        assert disagreement_flag(75, 44) is True

    def test_direction_does_not_matter(self):
        assert disagreement_flag(10, 90) is True
        assert disagreement_flag(90, 10) is True


class TestConfidence:
    def _inputs(self, **overrides):
        defaults = dict(
            fema_map_age_years=0,
            fema_normalized=50,
            noaa_normalized=50,
            noaa_signal_available=True,
            is_inland=False,
            horizon_years=10,
            geocoder_match_is_approximate=False,
        )
        defaults.update(overrides)
        return ConfidenceInputs(**defaults)

    def test_defaults_to_high(self):
        result = compute_confidence(self._inputs())
        assert result.tier is ConfidenceTier.HIGH

    def test_old_map_10_to_20_years_drops_one_tier(self):
        result = compute_confidence(self._inputs(fema_map_age_years=15))
        assert result.tier is ConfidenceTier.MEDIUM

    def test_old_map_over_20_years_drops_two_tiers(self):
        result = compute_confidence(self._inputs(fema_map_age_years=25))
        assert result.tier is ConfidenceTier.LOW

    def test_approximate_geocode_drops_one_tier(self):
        result = compute_confidence(
            self._inputs(geocoder_match_is_approximate=True)
        )
        assert result.tier is ConfidenceTier.MEDIUM

    def test_inland_100_year_drops_one_tier(self):
        result = compute_confidence(
            self._inputs(
                noaa_signal_available=False,
                is_inland=True,
                horizon_years=100,
                fema_normalized=10,
                noaa_normalized=0,
            )
        )
        assert result.tier is ConfidenceTier.MEDIUM

    def test_inland_10_year_no_penalty(self):
        result = compute_confidence(
            self._inputs(
                noaa_signal_available=False,
                is_inland=True,
                horizon_years=10,
                fema_normalized=10,
                noaa_normalized=0,
            )
        )
        assert result.tier is ConfidenceTier.HIGH

    def test_inland_in_high_fema_zone_does_not_trip_disagreement(self):
        # Section 8 carve-out: when NOAA has no signal for this property,
        # the disagreement check is skipped. An inland AE-zone property
        # should retain High confidence, not be forced to Low.
        result = compute_confidence(
            self._inputs(
                noaa_signal_available=False,
                is_inland=True,
                horizon_years=30,
                fema_normalized=75,
                noaa_normalized=0,
            )
        )
        assert result.tier is ConfidenceTier.HIGH
        assert result.disagreement is False

    def test_coastal_disagreement_still_forces_low(self):
        # When NOAA signal IS available and the components diverge, the
        # disagreement check still does its job (the original Section 8
        # case it was designed for).
        result = compute_confidence(
            self._inputs(
                noaa_signal_available=True,
                fema_normalized=90,
                noaa_normalized=0,
                horizon_years=30,
            )
        )
        assert result.tier is ConfidenceTier.LOW
        assert result.disagreement is True

    def test_disagreement_forces_low(self):
        # FEMA high (90), NOAA low (0), NOAA signal present: diff = 90, well over 30.
        result = compute_confidence(
            self._inputs(
                noaa_signal_available=True,
                fema_normalized=90,
                noaa_normalized=0,
                horizon_years=30,
            )
        )
        assert result.tier is ConfidenceTier.LOW
        assert result.disagreement is True

    def test_floor_is_low(self):
        result = compute_confidence(
            self._inputs(
                fema_map_age_years=25,
                geocoder_match_is_approximate=True,
                is_inland=True,
                horizon_years=100,
            )
        )
        assert result.tier is ConfidenceTier.LOW

    def test_drivers_recorded(self):
        result = compute_confidence(
            self._inputs(
                fema_map_age_years=15,
                geocoder_match_is_approximate=True,
            )
        )
        assert any("FEMA map" in d for d in result.drivers)
        assert any("Geocoder" in d for d in result.drivers)
