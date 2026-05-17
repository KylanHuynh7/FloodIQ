"""Lazy county seed filler (Section 6).

When a user requests a score for an address in a county that has fewer
than ``SEED_TARGET`` tract-centroid scores in the local store, this
module scores the next batch of centroids via the FEMA NFHL API before
the user's percentile is computed. Cost: one-time per county, ~15-30s.

NOAA contribution to seed scores is 0 across all horizons until the
NOAA dataset is populated (Section 9.3 inland behavior), so seeds are
currently FEMA-driven. When NOAA data later lands, seeds should be
re-scored — the methodology_version key in the table lets us purge and
refill cleanly.
"""

from __future__ import annotations

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


SEED_TARGET = 25
# 5 concurrent FEMA requests stays well within polite usage of the public
# NFHL endpoint while cutting wall time from ~25*latency to ~5*latency.
SEED_CONCURRENCY = 5


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

    have = count_seeds_in_county(conn, county_fips, METHODOLOGY_VERSION)
    if have >= target:
        return 0

    need = target - have
    all_tracts = tracts_for_county(county_fips)
    if not all_tracts:
        return 0

    already = seeded_tract_geoids(conn, county_fips, METHODOLOGY_VERSION)
    candidates = [t for t in all_tracts if t.geoid not in already][:need]
    if not candidates:
        return 0

    def fetch_one(tract):
        # One httpx.Client per worker — cheap to create, avoids shared
        # state between threads.
        with httpx.Client(timeout=45.0) as c:
            try:
                fema = lookup_fema(tract.latitude, tract.longitude, client=c)
            except Exception:
                return None
        if fema.unmapped or fema.zone_normalized is None:
            return None
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
