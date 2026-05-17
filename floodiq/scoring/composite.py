"""Horizon-weighted composite scoring from METHODOLOGY.md Section 5."""

from __future__ import annotations

from dataclasses import dataclass


HORIZONS: tuple[int, ...] = (10, 30, 100)

# (FEMA weight, NOAA weight) per horizon. Sum to 1.0.
HORIZON_WEIGHTS: dict[int, tuple[float, float]] = {
    10: (1.0, 0.0),
    30: (0.7, 0.3),
    100: (0.3, 0.7),
}


@dataclass(frozen=True)
class CompositeScore:
    horizon_years: int
    fema_component: int
    noaa_component: int
    composite: float  # 0-100, pre-baseline (absolute, not yet county-relative)


def composite_for_horizon(
    horizon_years: int,
    fema_normalized: int,
    noaa_normalized: int,
) -> CompositeScore:
    if horizon_years not in HORIZON_WEIGHTS:
        raise ValueError(f"Unsupported horizon: {horizon_years}")
    fema_w, noaa_w = HORIZON_WEIGHTS[horizon_years]
    score = fema_w * fema_normalized + noaa_w * noaa_normalized
    return CompositeScore(
        horizon_years=horizon_years,
        fema_component=fema_normalized,
        noaa_component=noaa_normalized,
        composite=score,
    )


def composite_all_horizons(
    fema_normalized: int,
    noaa_by_horizon: dict[int, int],
) -> dict[int, CompositeScore]:
    """Compute all three horizon composites in one pass.

    FEMA is a single value (its score doesn't change by horizon — the weight
    does). NOAA can differ per horizon because projected inundation grows
    with the projection year.
    """
    return {
        h: composite_for_horizon(h, fema_normalized, noaa_by_horizon.get(h, 0))
        for h in HORIZONS
    }
