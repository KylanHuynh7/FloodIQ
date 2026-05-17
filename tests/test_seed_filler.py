"""Tests for the county seed filler.

These avoid hitting the real FEMA API by monkey-patching the lookup with
a deterministic synthetic. The goal is to verify orchestration: the
filler stops at SEED_TARGET, is idempotent, and that seeds flow into the
percentile queries via the cache helpers.
"""

import tempfile
from pathlib import Path

import pytest

from floodiq import METHODOLOGY_VERSION
from floodiq.baseline import seed_filler, tract_centroids
from floodiq.baseline.tract_centroids import Tract
from floodiq.cache.store import (
    composite_scores_in_county,
    count_seeds_in_county,
    open_store,
)
from floodiq.sources.fema import FemaLookup


COUNTY = "06075"  # San Francisco


def _synthetic_tracts(n: int):
    return [
        Tract(geoid=f"{COUNTY}{i:06d}", latitude=37.77, longitude=-122.42)
        for i in range(n)
    ]


@pytest.fixture
def tmp_db(monkeypatch):
    with tempfile.TemporaryDirectory() as td:
        db_path = Path(td) / "cache.db"
        monkeypatch.setattr(
            "floodiq.cache.store.DEFAULT_DB_PATH", db_path
        )
        yield db_path


@pytest.fixture
def fake_tracts(monkeypatch):
    tracts = _synthetic_tracts(40)
    monkeypatch.setattr(
        tract_centroids, "tracts_for_county", lambda fips, limit=None: tracts
    )
    return tracts


@pytest.fixture
def fake_fema(monkeypatch):
    # Alternate between zones to give the distribution some variance.
    zones = ["AE", "X_UNSHADED", "X_SHADED", "VE", "A"]
    call = {"i": 0}

    def fake_lookup(lat, lon, *, client=None):
        z = zones[call["i"] % len(zones)]
        call["i"] += 1
        return FemaLookup(
            zone_raw=z,
            zone_normalized=z,
            base_flood_elevation=None,
            effective_date=None,
            unmapped=False,
            zone_subtype=None,
        )

    monkeypatch.setattr(seed_filler, "lookup_fema", fake_lookup)


def test_seed_fill_reaches_target(tmp_db, fake_tracts, fake_fema):
    with open_store(tmp_db) as conn:
        added = seed_filler.ensure_county_seeded(
            conn, COUNTY, target=10, now_year=2026
        )
    assert added == 10
    with open_store(tmp_db) as conn:
        assert count_seeds_in_county(conn, COUNTY, METHODOLOGY_VERSION) == 10


def test_seed_fill_is_idempotent(tmp_db, fake_tracts, fake_fema):
    with open_store(tmp_db) as conn:
        seed_filler.ensure_county_seeded(conn, COUNTY, target=10, now_year=2026)
        added2 = seed_filler.ensure_county_seeded(
            conn, COUNTY, target=10, now_year=2026
        )
    assert added2 == 0


def test_seed_fill_resumes(tmp_db, fake_tracts, fake_fema):
    with open_store(tmp_db) as conn:
        seed_filler.ensure_county_seeded(conn, COUNTY, target=5, now_year=2026)
        added2 = seed_filler.ensure_county_seeded(
            conn, COUNTY, target=12, now_year=2026
        )
    assert added2 == 7
    with open_store(tmp_db) as conn:
        assert count_seeds_in_county(conn, COUNTY, METHODOLOGY_VERSION) == 12


def test_seeds_flow_into_county_percentile_query(tmp_db, fake_tracts, fake_fema):
    with open_store(tmp_db) as conn:
        seed_filler.ensure_county_seeded(
            conn, COUNTY, target=15, now_year=2026
        )
    with open_store(tmp_db) as conn:
        scores = composite_scores_in_county(conn, COUNTY, horizon_years=10)
    assert len(scores) == 15
    # All seeded scores should fall in 0..100 (sanity).
    assert all(0 <= s <= 100 for s in scores)
