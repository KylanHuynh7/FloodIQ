"""National-relative percentile baseline (METHODOLOGY.md Section 6).

The PDF shows a national-relative score alongside the county-relative score
for context. Mechanics mirror the county module: a per-version seed
distribution combined with any prior scored addresses from the local
history. The seed list is empty by default — its contents are a
methodology decision per Section 6.
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from dataclasses import dataclass


@dataclass(frozen=True)
class NationalPercentile:
    score_absolute: float
    percentile: float | None
    sample_size: int


def seed_distribution_national() -> list[float]:
    """National reference scores. Empty until the human operator
    specifies the sampled-addresses seed set."""
    return []


def percentile_national(
    score_absolute: float,
    *,
    additional_scores: list[float] | None = None,
    min_sample_size: int = 20,
) -> NationalPercentile:
    reference = list(seed_distribution_national())
    if additional_scores:
        reference.extend(additional_scores)

    n = len(reference)
    if n < min_sample_size:
        return NationalPercentile(
            score_absolute=score_absolute,
            percentile=None,
            sample_size=n,
        )

    reference.sort()
    lo = bisect_left(reference, score_absolute)
    hi = bisect_right(reference, score_absolute)
    rank = (lo + hi) / 2.0
    pct = 100.0 * rank / n
    return NationalPercentile(
        score_absolute=score_absolute,
        percentile=pct,
        sample_size=n,
    )
