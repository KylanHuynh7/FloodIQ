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


def _zone_and_panels(*panel_bodies):
    """Layer 28 returns a Zone AE polygon in DFIRM 12086C; layer 3 returns
    `panel_bodies` in order (one per request)."""
    panels = list(panel_bodies)
    zone = {"features": [{"attributes": {"FLD_ZONE": "AE", "ZONE_SUBTY": None,
                                          "STATIC_BFE": None, "DFIRM_ID": "12086C"}}]}

    def handler(request: httpx.Request) -> httpx.Response:
        if "/MapServer/28/" in request.url.path:
            return httpx.Response(200, json=zone)
        assert request.url.params["geometryType"] == "esriGeometryPoint"
        return httpx.Response(200, json=panels.pop(0))

    return httpx.Client(transport=httpx.MockTransport(handler))


def _panel(dfirm, year):
    from datetime import datetime, timezone
    ms = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    return {"attributes": {"DFIRM_ID": dfirm, "EFF_DATE": ms}}


def test_effective_date_uses_the_panel_from_the_same_map_set():
    # A neighboring county's panel overlaps the point and comes back first.
    body = {"features": [_panel("12011C", 2023), _panel("12086C", 2009)]}
    with _zone_and_panels(body) as c:
        r = lookup_fema(25.79, -80.13, client=c)
    assert r.effective_date.year == 2009


def test_effective_date_retries_once_on_error_body():
    with _zone_and_panels(ERROR_BODY, {"features": [_panel("12086C", 2009)]}) as c:
        r = lookup_fema(25.79, -80.13, client=c)
    assert r.effective_date is not None and r.effective_date.year == 2009
