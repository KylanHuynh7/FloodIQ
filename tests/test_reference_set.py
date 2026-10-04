"""Section 6 reference set: which user lookups may enter a baseline."""

import tempfile
from pathlib import Path

from floodiq import METHODOLOGY_VERSION
from floodiq.cache.store import composite_scores_in_county, open_store, record_score

COUNTY = "11001"


def _payload(score: float, *, approximate: bool = False, error: str | None = None, version: str = METHODOLOGY_VERSION):
    return {
        "methodology_version": version,
        "geocoder_match_is_approximate": approximate,
        "error": error,
        "horizons": {"10": {"composite_absolute": score}},
    }


def _record(conn, address_input, matched, payload):
    record_score(
        conn,
        address_input=address_input,
        matched_address=matched,
        county_fips=COUNTY,
        methodology_version="1.1",
        payload=payload,
    )


def _scores():
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "cache.db"
        with open_store(db) as conn:
            yield conn


def test_repeat_lookups_count_once_at_latest_score():
    for conn in _scores():
        for _ in range(5):
            _record(conn, "1600 Pennsylvania Ave NW, Washington, DC", "1600 PENNSYLVANIA AVE NW", _payload(10))
        # Same property, differently cased/spaced, later re-score.
        _record(conn, "1600 pennsylvania ave nw, washington dc", "1600  Pennsylvania Ave NW", _payload(12))
        assert composite_scores_in_county(conn, COUNTY, 10) == [12.0]


def test_junk_fallback_matches_are_excluded():
    for conn in _scores():
        _record(conn, "x", "X, 1355 Market Street, San Francisco", _payload(48, approximate=True))
        _record(conn, "100 East Bay St, Charleston, SC 29401", "100, East Bay Street", _payload(32, approximate=True))
        _record(conn, "bad", "", _payload(0, error="not found"))
        assert composite_scores_in_county(conn, COUNTY, 10) == [32.0]


def test_scores_from_older_methodology_versions_are_excluded():
    for conn in _scores():
        _record(conn, "1 Old St, Washington, DC", "1 OLD ST", _payload(22.5, version="1.1"))
        _record(conn, "2 New St, Washington, DC", "2 NEW ST", _payload(75))
        assert composite_scores_in_county(conn, COUNTY, 10) == [75.0]
