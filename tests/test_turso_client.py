"""TursoConnection: batching, read-your-writes, encoding, errors.

Runs against a fake pipeline endpoint (httpx.MockTransport), so no
network or credentials are needed."""

import json

import httpx
import pytest

from floodiq.cache.turso import TursoConnection, TursoError


class FakeTurso:
    def __init__(self):
        self.requests = []  # one entry per HTTP call: list of pipeline requests
        self.urls = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.urls.append(str(request.url))
        assert request.headers["authorization"] == "Bearer tok"
        reqs = body["requests"]
        assert reqs[-1] == {"type": "close"}
        self.requests.append(reqs[:-1])
        results = []
        for r in reqs[:-1]:
            sql = r.get("stmt", {}).get("sql", r.get("sql", ""))
            if "FAIL" in sql:
                results.append({"type": "error", "error": {"message": "boom", "code": "SQLITE_CONSTRAINT"}})
            elif sql.startswith("SELECT"):
                rows = [[{"type": "integer", "value": "7"}, {"type": "float", "value": 1.5},
                         {"type": "text", "value": "x"}, {"type": "null"},
                         {"type": "blob", "base64": "aGk"}]]  # unpadded "hi"
                results.append({"type": "ok", "response": {"type": "execute", "result": {"cols": [], "rows": rows}}})
            else:
                results.append({"type": "ok", "response": {"type": "execute", "result": {"cols": [], "rows": []}}})
        results.append({"type": "ok", "response": {"type": "close"}})
        return httpx.Response(200, json={"baton": None, "base_url": None, "results": results})


@pytest.fixture
def fake():
    return FakeTurso()


def _conn(fake):
    client = httpx.Client(transport=httpx.MockTransport(fake.handler))
    return TursoConnection("libsql://db-org.aws-us-east-1.turso.io", "tok", client=client)


def test_libsql_url_maps_to_https_pipeline(fake):
    c = _conn(fake)
    c.execute("SELECT 1")
    assert fake.urls == ["https://db-org.aws-us-east-1.turso.io/v2/pipeline"]


def test_writes_are_batched_into_one_request_on_commit(fake):
    c = _conn(fake)
    for i in range(75):
        c.execute("INSERT INTO t VALUES (?)", (i,))
    assert fake.requests == []  # nothing sent yet
    c.commit()
    assert len(fake.requests) == 1 and len(fake.requests[0]) == 75


def test_read_flushes_pending_writes_in_same_request(fake):
    c = _conn(fake)
    c.execute("INSERT INTO t VALUES (?)", (1,))
    row = c.execute("SELECT a FROM t").fetchone()
    assert len(fake.requests) == 1
    assert [r["stmt"]["sql"] for r in fake.requests[0]] == ["INSERT INTO t VALUES (?)", "SELECT a FROM t"]
    assert row == (7, 1.5, "x", None, b"hi")


def test_parameter_encoding(fake):
    c = _conn(fake)
    c.execute("INSERT INTO t VALUES (?,?,?,?,?,?)", (None, True, 42, 2.5, "s", b"hi"))
    c.commit()
    args = fake.requests[0][0]["stmt"]["args"]
    assert args == [
        {"type": "null"},
        {"type": "integer", "value": "1"},
        {"type": "integer", "value": "42"},
        {"type": "float", "value": 2.5},
        {"type": "text", "value": "s"},
        {"type": "blob", "base64": "aGk="},
    ]


def test_server_error_raises(fake):
    c = _conn(fake)
    c.execute("INSERT FAIL")
    with pytest.raises(TursoError, match="SQLITE_CONSTRAINT"):
        c.commit()


def test_close_discards_uncommitted_writes(fake):
    c = _conn(fake)
    c.execute("INSERT INTO t VALUES (1)")
    c.close()
    assert fake.requests == []
