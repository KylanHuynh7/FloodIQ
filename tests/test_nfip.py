"""NFIP claims history: query shape, parsing, and failure handling (offline)."""

import httpx

from floodiq.sources.nfip import lookup_claims

TRACT = "22071013400"


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_counts_tract_outside_and_county_average():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        f = request.url.params["$filter"]
        seen.append(f)
        if "floodZoneCurrent" in f:
            n = 227
        elif TRACT in f:
            n = 1345
        else:
            n = 126_000
        return httpx.Response(200, json={"metadata": {"count": n}, "NfipClaims": []})

    with _client(handler) as c:
        h = lookup_claims(TRACT, county_tract_count=184, client=c)

    assert h.claims_in_tract == 1345
    assert h.claims_outside_high_risk == 227
    assert h.county_avg_per_tract == round(126_000 / 184, 1)
    # v3 has no censusTract field: tracts are matched by block-group prefix.
    assert all("startswith(censusGeoid," in f for f in seen)
    assert any(f == "startswith(censusGeoid,'22071')" for f in seen)


def test_api_error_returns_none_instead_of_raising():
    def handler(request):
        return httpx.Response(400, json={"error": [{"message": "bad field"}]})

    with _client(handler) as c:
        assert lookup_claims(TRACT, county_tract_count=184, client=c) is None


def test_malformed_tract_is_skipped_without_a_request():
    def handler(request):  # pragma: no cover - must not be called
        raise AssertionError("no request expected")

    with _client(handler) as c:
        assert lookup_claims("", county_tract_count=10, client=c) is None
        assert lookup_claims("1234", county_tract_count=10, client=c) is None
