"""NFHL error bodies must not be mistaken for "unmapped" (Section 9.1)."""

import httpx
import pytest

from floodiq.sources.fema import FemaServiceError, lookup_fema

ERROR_BODY = {"error": {"code": 500, "message": "Unable to complete operation."}}
ZONE_X = {"features": [{"attributes": {"FLD_ZONE": "X", "ZONE_SUBTY": None, "STATIC_BFE": None}}]}


def _client(*bodies):
    """Client whose layer-28 queries return `bodies` in order. Other
    requests (effective-date lookup) get an empty feature list."""
    queue = list(bodies)

    def handler(request: httpx.Request) -> httpx.Response:
        if "/MapServer/28/" in request.url.path and queue:
            return httpx.Response(200, json=queue.pop(0))
        return httpx.Response(200, json={"features": []})

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_transient_error_body_is_retried():
    with _client(ERROR_BODY, ZONE_X) as c:
        result = lookup_fema(32.78, -79.93, client=c)
    assert result.unmapped is False
    assert result.zone_raw == "X"


def test_persistent_error_raises_instead_of_unmapped():
    with _client(ERROR_BODY, ERROR_BODY) as c, pytest.raises(FemaServiceError):
        lookup_fema(32.78, -79.93, client=c)


def test_genuinely_empty_result_is_still_unmapped():
    with _client({"features": []}) as c:
        assert lookup_fema(32.78, -79.93, client=c).unmapped is True
