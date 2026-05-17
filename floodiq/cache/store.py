"""SQLite cache + history store (METHODOLOGY.md Section 11).

Two responsibilities:

1. **Source data cache.** FEMA + geocoder lookups are cached with their
   retrieval timestamp so the same address yields the same upstream data
   under the same methodology version.

2. **Score history.** Every produced score is recorded with the
   methodology version it was scored under. Refreshing source data does
   not silently overwrite — historical scores remain queryable.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator


DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "cache.db"


SCHEMA = """
CREATE TABLE IF NOT EXISTS source_cache (
    source TEXT NOT NULL,        -- "fema", "geocode", "noaa"
    key    TEXT NOT NULL,        -- normalized lookup key (e.g., lat,lon rounded)
    payload TEXT NOT NULL,       -- JSON
    retrieved_at TEXT NOT NULL,  -- ISO-8601 UTC
    PRIMARY KEY (source, key)
);

CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Non-enumerable public token used in result/PDF URLs. Prevents a
    -- visitor from walking /report/1.pdf, /report/2.pdf, ... and viewing
    -- other people's address lookups (which contain PII).
    token TEXT UNIQUE,
    address_input TEXT NOT NULL,
    matched_address TEXT,
    county_fips TEXT,
    methodology_version TEXT NOT NULL,
    scored_at TEXT NOT NULL,
    payload TEXT NOT NULL        -- full ScoreReport JSON
);
CREATE INDEX IF NOT EXISTS idx_score_history_token ON score_history(token);

CREATE INDEX IF NOT EXISTS idx_score_history_county
    ON score_history(county_fips);

-- Seed scores produced from Census tract centroids (Section 6 baseline).
-- Kept in a separate table from score_history so user-facing history is
-- clean. Percentile queries union both tables.
CREATE TABLE IF NOT EXISTS county_seed_scores (
    county_fips TEXT NOT NULL,
    tract_geoid TEXT NOT NULL,
    horizon_years INTEGER NOT NULL,
    composite_absolute REAL NOT NULL,
    fema_zone TEXT,
    methodology_version TEXT NOT NULL,
    scored_at TEXT NOT NULL,
    PRIMARY KEY (tract_geoid, horizon_years, methodology_version)
);

CREATE INDEX IF NOT EXISTS idx_seed_county_horizon
    ON county_seed_scores(county_fips, horizon_years);
"""


def _now_utc() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


@contextmanager
def open_store(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    path = db_path or DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def cache_get(conn: sqlite3.Connection, source: str, key: str) -> dict | None:
    row = conn.execute(
        "SELECT payload, retrieved_at FROM source_cache WHERE source=? AND key=?",
        (source, key),
    ).fetchone()
    if row is None:
        return None
    payload, retrieved_at = row
    return {"payload": json.loads(payload), "retrieved_at": retrieved_at}


def cache_put(
    conn: sqlite3.Connection, source: str, key: str, payload: dict
) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO source_cache(source, key, payload, retrieved_at) "
        "VALUES(?,?,?,?)",
        (source, key, json.dumps(payload), _now_utc()),
    )


def record_score(
    conn: sqlite3.Connection,
    *,
    address_input: str,
    matched_address: str,
    county_fips: str,
    methodology_version: str,
    payload: dict,
) -> str:
    """Persist a scored report and return its public token (a URL-safe
    random string used in /result/{token} and /report/{token}.pdf paths
    instead of the auto-increment id; prevents enumeration of past
    lookups which contain address PII)."""
    token = secrets.token_urlsafe(16)  # 128 bits — collision-safe in practice
    conn.execute(
        "INSERT INTO score_history"
        "(token, address_input, matched_address, county_fips, methodology_version, scored_at, payload) "
        "VALUES (?,?,?,?,?,?,?)",
        (
            token,
            address_input,
            matched_address,
            county_fips,
            methodology_version,
            _now_utc(),
            json.dumps(payload),
        ),
    )
    return token


def get_score(conn: sqlite3.Connection, token: str) -> dict | None:
    row = conn.execute(
        "SELECT address_input, matched_address, county_fips, methodology_version, "
        "scored_at, payload FROM score_history WHERE token=?",
        (token,),
    ).fetchone()
    if row is None:
        return None
    return {
        "address_input": row[0],
        "matched_address": row[1],
        "county_fips": row[2],
        "methodology_version": row[3],
        "scored_at": row[4],
        "payload": json.loads(row[5]),
    }


def composite_scores_in_county(
    conn: sqlite3.Connection, county_fips: str, horizon_years: int
) -> list[float]:
    """Return composite (absolute, pre-baseline) scores for one horizon in a
    county. Combines user score history with the tract-centroid seed set
    (Section 6)."""
    rows = conn.execute(
        "SELECT payload FROM score_history WHERE county_fips=?",
        (county_fips,),
    ).fetchall()
    out = _composites_from_rows(rows, horizon_years)
    seed_rows = conn.execute(
        "SELECT composite_absolute FROM county_seed_scores "
        "WHERE county_fips=? AND horizon_years=?",
        (county_fips, horizon_years),
    ).fetchall()
    out.extend(float(r[0]) for r in seed_rows)
    return out


def composite_scores_national(
    conn: sqlite3.Connection, horizon_years: int
) -> list[float]:
    """National reference distribution: union of all user history + all
    county seeds at this horizon."""
    rows = conn.execute("SELECT payload FROM score_history").fetchall()
    out = _composites_from_rows(rows, horizon_years)
    seed_rows = conn.execute(
        "SELECT composite_absolute FROM county_seed_scores WHERE horizon_years=?",
        (horizon_years,),
    ).fetchall()
    out.extend(float(r[0]) for r in seed_rows)
    return out


def count_seeds_in_county(
    conn: sqlite3.Connection, county_fips: str, methodology_version: str
) -> int:
    """How many distinct tract centroids have been seeded for this county
    under the given methodology version."""
    row = conn.execute(
        "SELECT COUNT(DISTINCT tract_geoid) FROM county_seed_scores "
        "WHERE county_fips=? AND methodology_version=?",
        (county_fips, methodology_version),
    ).fetchone()
    return int(row[0]) if row else 0


def seeded_tract_geoids(
    conn: sqlite3.Connection, county_fips: str, methodology_version: str
) -> set[str]:
    rows = conn.execute(
        "SELECT DISTINCT tract_geoid FROM county_seed_scores "
        "WHERE county_fips=? AND methodology_version=?",
        (county_fips, methodology_version),
    ).fetchall()
    return {r[0] for r in rows}


def insert_seed_score(
    conn: sqlite3.Connection,
    *,
    county_fips: str,
    tract_geoid: str,
    horizon_years: int,
    composite_absolute: float,
    fema_zone: str | None,
    methodology_version: str,
) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO county_seed_scores"
        "(county_fips, tract_geoid, horizon_years, composite_absolute, "
        "fema_zone, methodology_version, scored_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (
            county_fips,
            tract_geoid,
            horizon_years,
            composite_absolute,
            fema_zone,
            methodology_version,
            _now_utc(),
        ),
    )


def _composites_from_rows(rows: list, horizon_years: int) -> list[float]:
    out: list[float] = []
    for (raw,) in rows:
        try:
            data = json.loads(raw)
            horizons = data.get("horizons", {})
            entry = horizons.get(str(horizon_years)) or horizons.get(horizon_years)
            if entry and "composite_absolute" in entry:
                out.append(float(entry["composite_absolute"]))
        except (ValueError, KeyError, TypeError):
            continue
    return out
