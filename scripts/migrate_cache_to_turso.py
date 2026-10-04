"""Copy the local SQLite cache (data/cache.db) into the Turso database.

Preserves ids and result tokens, so existing /result/{token} and
/report/{token}.pdf links keep working after the move. Safe to re-run:
rows that already exist are skipped (INSERT OR IGNORE).

Usage:
    set -a; . ~/.config/floodiq/turso.env; set +a
    PYTHONPATH=. python scripts/migrate_cache_to_turso.py
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

from floodiq.cache.store import DEFAULT_DB_PATH, open_store

TABLES = ("source_cache", "score_history", "county_seed_scores")
BATCH = 200  # statements per HTTP request


def main(src: Path = DEFAULT_DB_PATH) -> int:
    if not os.environ.get("TURSO_DATABASE_URL"):
        print("TURSO_DATABASE_URL is not set; refusing to run.", file=sys.stderr)
        return 1
    local = sqlite3.connect(src)
    with open_store() as remote:  # Turso, because the env var is set
        for table in TABLES:
            cols = [r[1] for r in local.execute(f"PRAGMA table_info({table})")]
            rows = local.execute(f"SELECT {', '.join(cols)} FROM {table}").fetchall()
            sql = (
                f"INSERT OR IGNORE INTO {table} ({', '.join(cols)}) "
                f"VALUES ({', '.join('?' * len(cols))})"
            )
            for i in range(0, len(rows), BATCH):
                for row in rows[i : i + BATCH]:
                    remote.execute(sql, row)
                remote.commit()
            have = remote.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"{table}: {len(rows)} local rows -> {have} rows in Turso")
    local.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
