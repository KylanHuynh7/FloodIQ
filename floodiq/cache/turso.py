"""Minimal Turso (libSQL) client over the HTTP pipeline API.

Implements just the slice of the sqlite3 connection API that
`floodiq.cache.store` uses — `execute(...).fetchone()/fetchall()`,
`executescript`, `commit`, `close` — so the store can run against a hosted
Turso database on serverless platforms whose filesystem doesn't persist.

Why not the official `turso_serverless` package: it opens a new HTTPS
connection for every statement and sends `executemany` as one request per
row, which made a county seed fill (~75 inserts) take tens of seconds.
This client reuses one keep-alive `httpx.Client` per process and queues
writes until `commit()`, so a whole seed fill is a single round trip.

Protocol: POST {base}/v2/pipeline, https://docs.turso.tech/sdk/http/reference
"""

from __future__ import annotations

import base64
import math
import threading
from typing import Any, Iterable, Sequence

import httpx

DEFAULT_TIMEOUT = 30.0

# One pooled client per process: Vercel's Fluid compute reuses instances
# across requests, so keep-alive connections survive between lookups.
_client: httpx.Client | None = None
_client_lock = threading.Lock()


def _http() -> httpx.Client:
    global _client
    with _client_lock:
        if _client is None:
            _client = httpx.Client(timeout=DEFAULT_TIMEOUT, http2=False)
        return _client


class TursoError(Exception):
    """A statement failed on the server (constraint, syntax, ...)."""


def _encode(value: Any) -> dict:
    if value is None:
        return {"type": "null"}
    if isinstance(value, bool):
        return {"type": "integer", "value": str(int(value))}
    if isinstance(value, int):
        return {"type": "integer", "value": str(value)}
    if isinstance(value, float):
        # JSON has no NaN/inf; SQLite stores NaN as NULL anyway.
        if not math.isfinite(value):
            return {"type": "null"}
        return {"type": "float", "value": value}
    if isinstance(value, str):
        return {"type": "text", "value": value}
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"type": "blob", "base64": base64.b64encode(bytes(value)).decode("ascii")}
    raise TypeError(f"unsupported parameter type: {type(value).__name__}")


def _decode(cell: dict) -> Any:
    kind = cell.get("type")
    if kind == "null":
        return None
    if kind == "integer":
        return int(cell["value"])
    if kind == "float":
        return float(cell["value"])
    if kind == "text":
        return cell["value"]
    if kind == "blob":
        b64 = cell["base64"]
        return base64.b64decode(b64 + "=" * (-len(b64) % 4))
    raise TursoError(f"unknown value type from server: {kind!r}")


class _Result:
    def __init__(self, rows: list[tuple]):
        self._rows = rows

    def fetchone(self) -> tuple | None:
        return self._rows[0] if self._rows else None

    def fetchall(self) -> list[tuple]:
        return list(self._rows)


class TursoConnection:
    """sqlite3-shaped connection backed by Turso's HTTP API.

    Statements without a result set are queued and sent together on
    `commit()` (or before the next read, so reads see earlier writes).
    Each queued statement autocommits on the server, in order — the same
    effective semantics the store relied on, since every write it makes
    is an idempotent `INSERT OR REPLACE` or a single-row insert.
    """

    def __init__(self, url: str, auth_token: str, *, client: httpx.Client | None = None):
        base = url.strip()
        for scheme in ("libsql://", "turso://", "wss://", "ws://"):
            if base.startswith(scheme):
                base = "https://" + base[len(scheme):]
        self._endpoint = base.rstrip("/") + "/v2/pipeline"
        self._headers = {"Authorization": f"Bearer {auth_token}"}
        self._pending: list[dict] = []
        self._lock = threading.Lock()
        self._client = client  # injectable for tests; defaults to the shared pool

    # --- sqlite3-compatible surface -------------------------------------

    def execute(self, sql: str, params: Sequence[Any] | None = None) -> _Result:
        stmt = {"sql": sql, "args": [_encode(p) for p in (params or ())]}
        with self._lock:
            if _returns_rows(sql):
                # Flush queued writes in the same pipeline so the read
                # observes them, then return the read's rows.
                results = self._pipeline(self._pending + [{"type": "execute", "stmt": stmt}])
                self._pending = []
                return _Result(_rows(results[-1]))
            self._pending.append({"type": "execute", "stmt": stmt})
            return _Result([])

    def executemany(self, sql: str, seq: Iterable[Sequence[Any]]) -> None:
        for params in seq:
            self.execute(sql, params)

    def executescript(self, script: str) -> None:
        with self._lock:
            self._pending.append({"type": "sequence", "sql": script})

    def commit(self) -> None:
        with self._lock:
            if self._pending:
                self._pipeline(self._pending)
                self._pending = []

    def close(self) -> None:
        # Nothing to release: each pipeline request ends with "close", and
        # the HTTP client is shared. Unflushed writes are dropped, matching
        # sqlite3's behavior of discarding an uncommitted transaction.
        self._pending = []

    # --- transport --------------------------------------------------------

    def _pipeline(self, requests: list[dict]) -> list[dict]:
        body = {"requests": requests + [{"type": "close"}]}
        resp = (self._client or _http()).post(self._endpoint, json=body, headers=self._headers)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        for r in results[: len(requests)]:
            if r.get("type") == "error":
                err = r.get("error") or {}
                raise TursoError(f"{err.get('code', 'error')}: {err.get('message', '')}")
        return results[: len(requests)]


def _returns_rows(sql: str) -> bool:
    head = sql.lstrip().split(None, 1)[0].upper() if sql.strip() else ""
    return head in ("SELECT", "WITH", "PRAGMA", "EXPLAIN", "VALUES")


def _rows(result: dict) -> list[tuple]:
    if result.get("type") != "ok":
        return []
    payload = (result.get("response") or {}).get("result") or {}
    return [tuple(_decode(c) for c in row) for row in payload.get("rows", [])]
