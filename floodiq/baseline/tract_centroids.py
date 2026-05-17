"""Census tract centroid lookup — seed source for Section 6 baselines.

Loaded lazily from data/census_tracts/tract_centroids.tsv (produced by
scripts/download_tract_centroids.py). Ordering within a county is
deterministic (sorted by tract GEOID) so that the same N tracts get
selected as seeds across runs — preserving Section 11 reproducibility.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from threading import Lock


TRACTS_TSV = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "census_tracts"
    / "tract_centroids.tsv"
)


@dataclass(frozen=True)
class Tract:
    geoid: str
    latitude: float
    longitude: float


_LOCK = Lock()
_BY_COUNTY: dict[str, list[Tract]] | None = None


def _load() -> dict[str, list[Tract]]:
    global _BY_COUNTY
    with _LOCK:
        if _BY_COUNTY is not None:
            return _BY_COUNTY
        if not TRACTS_TSV.exists():
            raise FileNotFoundError(
                f"{TRACTS_TSV} not found. Run "
                "`python scripts/download_tract_centroids.py` to populate it."
            )
        by_county: dict[str, list[Tract]] = {}
        with TRACTS_TSV.open() as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                county = row["county_fips"]
                by_county.setdefault(county, []).append(
                    Tract(
                        geoid=row["tract_geoid"],
                        latitude=float(row["lat"]),
                        longitude=float(row["lon"]),
                    )
                )
        # Sort each county's tracts by GEOID for deterministic seed selection.
        for tracts in by_county.values():
            tracts.sort(key=lambda t: t.geoid)
        _BY_COUNTY = by_county
        return _BY_COUNTY


def tracts_for_county(county_fips: str, *, limit: int | None = None) -> list[Tract]:
    """Return the tract centroids for a county. Limit slices the head of the
    deterministic ordering, so a smaller limit is always a strict prefix of
    a larger one."""
    tracts = _load().get(county_fips, [])
    if limit is None:
        return list(tracts)
    return tracts[:limit]


def all_county_fips() -> list[str]:
    return sorted(_load().keys())
