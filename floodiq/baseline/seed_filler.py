"""Lazy county seed filler (Section 6).

When a user requests a score for an address in a county whose seed sample
(``SEED_TARGET`` tracts in ``sample_order``) isn't fully scored under the
current methodology version, this module scores the missing tracts' internal
points via FEMA NFHL and NOAA SLR before the user's percentile is computed.
Cost: one-time per county per methodology version, roughly 15-60 s.

Seeds are keyed by methodology_version, so a version bump re-seeds every
county on its next lookup.
"""

from __future__ import annotations

import hashlib
import sqlite3
from concurrent.futures import ThreadPoolExecutor

import httpx

from floodiq import METHODOLOGY_VERSION
from floodiq.baseline.tract_centroids import tracts_for_county
from floodiq.cache.store import (
    count_seeds_in_county,
    insert_seed_score,
    seeded_tract_geoids,
)
from floodiq.scoring.composite import HORIZONS, composite_all_horizons
from floodiq.scoring.normalize import (
    normalize_fema_zone,
    normalize_noaa_inundation,
)
from floodiq.sources.fema import lookup_fema
from floodiq.sources.noaa import lookup_noaa


# Section 6 (v1.2): 100 tracts per county, chosen by a seeded hash order
# (see sample_order). Tracts hold roughly equal populations, so a uniform
# sample of tracts approximates a population-weighted sample of homes.
SEED_TARGET = 100
# 8 concurrent FEMA requests keeps a 100-tract fill well inside the
# serverless time limit while staying polite to the public NFHL endpoint.
SEED_CONCURRENCY = 8

# Marker row for a sampled tract FEMA has no map for (e.g. open water), so
# it counts as attempted and isn't re-fetched on every later lookup. It
# never enters a baseline: queries only read horizons 10/30/100.
UNMAPPED_MARKER_HORIZON = 0


def sample_order(county_fips: str, tracts: list, version: str = METHODOLOGY_VERSION) -> list:
    """Deterministic pseudo-random order of a county's tracts.

    v1.1 took the first N tracts by GEOID, and GEOIDs are assigned
    geographically, so the sample was one cluster of neighbors (Miami-Dade:
    92% Zone AE vs ~30% in a fair sample). Ranking by a hash of
    (county, tract, methodology version) spreads the sample across the
    county while staying reproducible on any machine (Section 11), unlike
    random.shuffle, whose output may change between Python versions.
    """
    def rank(t) -> str:
        return hashlib.sha256(f"{county_fips}:{t.geoid}:{version}".encode()).hexdigest()

    return sorted(tracts, key=rank)


def ensure_county_seeded(
    conn: sqlite3.Connection,
    county_fips: str,
    *,
    target: int = SEED_TARGET,
    concurrency: int = SEED_CONCURRENCY,
    now_year: int,
) -> int:
    """Score tract centroids until the county has at least ``target`` seeds
    under the current methodology version. Returns the number of new
    centroids inserted (0 if already at target).

    Fetching runs in a thread pool; DB writes stay on the calling thread
    so SQLite's single-writer model is respected.
    """

    all_tracts = tracts_for_county(county_fips)
    if not all_tracts:
        return 0
    # The sample is the first `target` tracts in hash order (all of them in
    # small counties). Attempted-but-unmapped tracts count via marker rows.
    sample = sample_order(county_fips, all_tracts)[:target]
    have = count_seeds_in_county(conn, county_fips, METHODOLOGY_VERSION)
    if have >= len(sample):
        return 0

    already = seeded_tract_geoids(conn, county_fips, METHODOLOGY_VERSION)
    candidates = [t for t in sample if t.geoid not in already]
    if not candidates:
        return 0

    def fetch_one(tract):
        # One httpx.Client per worker — cheap to create, avoids shared
        # state between threads.
        with httpx.Client(timeout=45.0) as c:
            try:
                fema = lookup_fema(tract.latitude, tract.longitude, client=c)
            except Exception:
                return None  # transient: retried on a later lookup
        if fema.unmapped or fema.zone_normalized is None:
            return (tract, None, None)  # permanent: record as attempted
        fema_normalized = normalize_fema_zone(fema.zone_normalized)
        if fema_normalized is None:
            return None
        noaa_by_horizon: dict[int, int] = {}
        for h in HORIZONS:
            nl = lookup_noaa(tract.latitude, tract.longitude, h, now_year=now_year)
            noaa_by_horizon[h] = normalize_noaa_inundation(nl.inundation_feet)
        composites = composite_all_horizons(fema_normalized, noaa_by_horizon)
        return (tract, fema.zone_normalized, composites)

    added = 0
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        for result in pool.map(fetch_one, candidates):
            if result is None:
                continue
            tract, zone, composites = result
            if composites is None:
                insert_seed_score(
                    conn,
                    county_fips=county_fips,
                    tract_geoid=tract.geoid,
                    horizon_years=UNMAPPED_MARKER_HORIZON,
                    composite_absolute=-1.0,
                    fema_zone="UNMAPPED",
                    methodology_version=METHODOLOGY_VERSION,
                )
                continue
            for h, c in composites.items():
                insert_seed_score(
                    conn,
                    county_fips=county_fips,
                    tract_geoid=tract.geoid,
                    horizon_years=h,
                    composite_absolute=c.composite,
                    fema_zone=zone,
                    methodology_version=METHODOLOGY_VERSION,
                )
            added += 1
    conn.commit()
    return added
