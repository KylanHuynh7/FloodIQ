"""County-relative percentile baseline (METHODOLOGY.md Section 6).

The user-facing score is the property's percentile rank within its county's
distribution of composite scores, normalized to 0-100 where 50 represents
the county median.

The reference distribution is the union of:

1. Scored addresses already in the local store (populated as FloodIQ runs).
2. A per-county seed set documented in the public methodology log.

The seed set composition is a methodology decision (Section 6) — its
contents must be specified by the human operator before launch. Until then
``seed_distribution_for_county`` returns an empty list and the percentile
function falls back to "no baseline available."
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from dataclasses import dataclass


@dataclass(frozen=True)
class CountyPercentile:
    score_absolute: float  # the 0-100 composite before baselining
    percentile: float | None  # 0-100, county-relative; None if no baseline
    sample_size: int  # number of reference scores used


def seed_distribution_for_county(county_fips: str) -> list[float]:
    """Return the seed reference scores for a county.

    Empty until the human operator provides the seed set per Section 6.
    This is intentional: returning fabricated seeds would violate the
    Section 14 "do not invent" rule.
    """
    return []


def percentile_in_county(
    score_absolute: float,
    *,
    county_fips: str,
    additional_scores: list[float] | None = None,
    min_sample_size: int = 10,
) -> CountyPercentile:
    """Compute the county-relative percentile.

    Combines the seed distribution for the county with any additional
    scores supplied by the caller (typically pulled from the cache of
    previously scored addresses in the same county). When the combined
    sample is smaller than ``min_sample_size``, returns percentile=None
    so the caller can surface "baseline not yet stable" rather than
    showing a misleading number.
    """
    reference = list(seed_distribution_for_county(county_fips))
    if additional_scores:
        reference.extend(additional_scores)

    n = len(reference)
    if n < min_sample_size:
        return CountyPercentile(
            score_absolute=score_absolute,
            percentile=None,
            sample_size=n,
        )

    reference.sort()
    # Percentile rank: midpoint of strict-less and less-or-equal counts,
    # which handles ties symmetrically.
    lo = bisect_left(reference, score_absolute)
    hi = bisect_right(reference, score_absolute)
    rank = (lo + hi) / 2.0
    pct = 100.0 * rank / n
    return CountyPercentile(
        score_absolute=score_absolute,
        percentile=pct,
        sample_size=n,
    )
