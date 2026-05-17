"""FastAPI app (METHODOLOGY.md Section 10.1)."""

from __future__ import annotations

import html
import json

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response

from floodiq import METHODOLOGY_VERSION
from floodiq.cache.store import get_score, open_store, record_score
from floodiq.pipeline import ScoreReport, score_address
from floodiq.report.disclaimers import DISCLAIMER_BULLETS
from floodiq.report.pdf import build_pdf


# Disable FastAPI's auto-generated /docs, /redoc, and /openapi.json. These
# leak schema info and aren't needed for a single-page user-facing app.
app = FastAPI(
    title="FloodIQ",
    version=METHODOLOGY_VERSION,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


def _js_string(s: str) -> str:
    """Encode a Python string for safe embedding inside an HTML <script>
    tag's JS string literal. Escapes both JSON-string special chars and
    '</' to prevent breaking out of the script tag."""
    return json.dumps(s).replace("</", "<\\/")


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return _render_form()


@app.post("/score", response_class=HTMLResponse)
def post_score(address: str = Form(...)) -> str:
    # The actual scoring may take up to ~3 minutes the very first time
    # FloodIQ encounters a new county (Section 6 seed fill). We respond
    # immediately with a loading shell that drives the slow call from
    # the browser via /api/score and redirects to /result/{id} when done.
    return _render_loading(address)


@app.post("/api/score")
def api_score(payload: dict) -> JSONResponse:
    address = (payload or {}).get("address")
    if not address:
        raise HTTPException(status_code=400, detail="address is required")
    report = score_address(address)
    # Persist so a token is available for /result/{token} and /report/{token}.pdf.
    token: str | None = None
    if not report.error:
        try:
            with open_store() as conn:
                token = record_score(
                    conn,
                    address_input=report.input_address,
                    matched_address=report.matched_address,
                    county_fips=report.county_fips,
                    methodology_version=report.methodology_version,
                    payload=_report_to_jsonable(report),
                )
        except Exception:
            token = None
    body = _report_to_jsonable(report)
    body["score_id"] = token  # name kept for backwards compat; value is now a token
    return JSONResponse(body)


@app.get("/result/{token}", response_class=HTMLResponse)
def get_result(token: str) -> str:
    if not _is_valid_token(token):
        raise HTTPException(status_code=404, detail="result not found")
    with open_store() as conn:
        stored = get_score(conn, token)
    if not stored:
        raise HTTPException(status_code=404, detail="result not found")
    report = _report_from_stored_payload(stored["payload"])
    return _render_result(report, score_id=token)


def _is_valid_token(s: str) -> bool:
    """secrets.token_urlsafe(16) returns ~22 URL-safe base64 chars. Reject
    anything outside that shape so we don't query the DB for garbage and
    so error responses don't reveal token format details."""
    return 16 <= len(s) <= 32 and all(
        c.isalnum() or c in "-_" for c in s
    )


@app.get("/report/{token}.pdf")
def report_pdf(token: str) -> Response:
    if not _is_valid_token(token):
        raise HTTPException(status_code=404, detail="report not found")
    with open_store() as conn:
        stored = get_score(conn, token)
    if not stored:
        raise HTTPException(status_code=404, detail="report not found")
    report = _report_from_stored_payload(stored["payload"])
    pdf_bytes = build_pdf(report)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="floodiq-{token}.pdf"'
        },
    )


def _render_form(error: str | None = None) -> str:
    disclaimers_html = "".join(f"<li>{b}</li>" for b in DISCLAIMER_BULLETS)
    err_html = f'<div class="error">{error}</div>' if error else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>FloodIQ</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            max-width: 720px; margin: 2rem auto; padding: 0 1rem;
            color: #222; line-height: 1.4; }}
    h1 {{ margin-bottom: 0.25rem; }}
    .lede {{ color: #555; margin-bottom: 1.5rem; }}
    form {{ display: flex; gap: 0.5rem; }}
    input[type=text] {{ flex: 1; padding: 0.6rem; font-size: 1rem; }}
    button {{ padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }}
    .disclaimers {{ margin-top: 2rem; font-size: 0.85rem; color: #555; }}
    .disclaimers li {{ margin-bottom: 0.4rem; }}
    .error {{ color: #b00; margin-top: 1rem; }}
  </style>
</head>
<body>
  <h1>FloodIQ</h1>
  <p class="lede">A relative flood-risk score for a U.S. property, across 10-, 30-, and 100-year horizons. v{METHODOLOGY_VERSION}.</p>
  <form action="/score" method="post">
    <input type="text" name="address" placeholder="123 Main St, Charleston, SC 29401" required />
    <button type="submit">Score</button>
  </form>
  {err_html}
  <div class="disclaimers">
    <h3>Important</h3>
    <ul>{disclaimers_html}</ul>
  </div>
</body>
</html>"""


def _render_loading(address: str) -> str:
    safe_addr = html.escape(address)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>FloodIQ — scoring…</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            max-width: 720px; margin: 4rem auto; padding: 0 1rem;
            color: #222; line-height: 1.5; text-align: center; }}
    h1 {{ margin-bottom: 0.25rem; }}
    .addr {{ color: #555; margin-bottom: 2rem; font-size: 1.05rem; }}
    .spinner {{ width: 48px; height: 48px; margin: 0 auto 1.5rem;
                border: 4px solid #d8e0ea; border-top-color: #234;
                border-radius: 50%; animation: spin 0.9s linear infinite; }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    .msg {{ color: #333; font-size: 1rem; }}
    .sub {{ color: #777; font-size: 0.9rem; margin-top: 0.5rem; }}
    .elapsed {{ color: #999; font-size: 0.85rem; margin-top: 1rem;
                font-variant-numeric: tabular-nums; }}
    .err {{ color: #b00; margin-top: 1.5rem; }}
    a {{ color: #234; }}
  </style>
</head>
<body>
  <h1>Working on it…</h1>
  <p class="addr">{safe_addr}</p>
  <div class="spinner" aria-hidden="true"></div>
  <p class="msg" id="msg">Looking up FEMA flood data for this address.</p>
  <p class="sub" id="sub">This usually takes a few seconds.</p>
  <p class="elapsed" id="elapsed">0s elapsed</p>
  <p><a href="/">Cancel</a></p>
  <script>
    const address = {_js_string(address)};
    const startedAt = Date.now();
    const msgEl = document.getElementById('msg');
    const subEl = document.getElementById('sub');
    const elapsedEl = document.getElementById('elapsed');
    let done = false;

    function tick() {{
      if (done) return;
      const s = Math.floor((Date.now() - startedAt) / 1000);
      elapsedEl.textContent = s + 's elapsed';
      if (s === 8) {{
        msgEl.textContent = "First lookup in this area — building a county comparison baseline.";
        subEl.textContent = "This is a one-time step per county. Up to ~3 minutes the first time; instant after that.";
      }}
    }}
    const intervalId = setInterval(tick, 1000);

    function showError(text) {{
      done = true;
      clearInterval(intervalId);
      document.querySelector('.spinner').style.display = 'none';
      elapsedEl.style.display = 'none';
      msgEl.innerHTML = '<span class="err">' + text + '</span>';
      subEl.innerHTML = '<a href="/">Try another address</a>';
    }}

    fetch('/api/score', {{
      method: 'POST',
      headers: {{'Content-Type': 'application/json'}},
      body: JSON.stringify({{address: address}}),
    }}).then(async (r) => {{
      const text = await r.text();
      let data = null;
      try {{ data = JSON.parse(text); }} catch (e) {{ /* not JSON */ }}
      if (!r.ok) {{
        const detail = (data && (data.detail || data.error)) || text || ('HTTP ' + r.status);
        showError(detail);
        return;
      }}
      if (!data) {{
        showError('Unexpected response from server.');
        return;
      }}
      if (data.error) {{
        showError(data.error);
      }} else if (data.score_id) {{
        window.location = '/result/' + data.score_id;
      }} else {{
        showError('Could not save result.');
      }}
    }}).catch(err => {{
      showError('Network error: ' + err);
    }});
  </script>
</body>
</html>"""


def _render_result(report: ScoreReport, *, score_id: int) -> str:
    if report.error:
        return _render_form(error=report.error)

    rows = []
    for h in (10, 30, 100):
        hr = report.horizons[h]
        county = (
            f"{hr.composite_county_percentile:.0f}"
            if hr.composite_county_percentile is not None
            else "pending"
        )
        national = (
            f"{hr.composite_national_percentile:.0f}"
            if hr.composite_national_percentile is not None
            else "pending"
        )
        rows.append(
            f"<tr><td>{h}-year</td><td>{county}</td><td>{national}</td>"
            f"<td>{hr.composite_absolute:.0f}</td>"
            f"<td>{hr.confidence_label}</td></tr>"
        )

    # Source-data summary.
    if report.fema_map_age_years is not None:
        fema_line = (
            f"<strong>FEMA</strong>: Zone {html.escape(report.fema_zone_raw or 'n/a')}"
            f" (normalized: {html.escape(report.fema_zone_normalized or 'n/a')}). "
            f"Map effective {html.escape((report.fema_map_effective_date or 'unknown')[:10])} "
            f"({report.fema_map_age_years:.1f} years old)."
        )
    else:
        fema_line = (
            f"<strong>FEMA</strong>: Zone "
            f"{html.escape(report.fema_zone_raw or 'n/a')} "
            f"(map age unknown)."
        )
    if report.noaa_data_available:
        noaa_line = (
            "<strong>NOAA</strong>: Coastal sea level rise projection applied "
            "to this location (see PDF for per-horizon depths)."
        )
    elif report.noaa_region_covered:
        noaa_line = (
            "<strong>NOAA</strong>: Coastal coverage available, but NOAA's "
            "Intermediate-scenario projection does not show inundation "
            "reaching this specific point. The 30/100-year scores fall back "
            "to FEMA-only."
        )
    else:
        noaa_line = (
            "<strong>NOAA</strong>: This address is outside FloodIQ v1.1's "
            "NOAA SLR coverage (CONUS coastal states only). Scoring is "
            "FEMA-only."
        )

    # Per-horizon confidence drivers.
    driver_rows = []
    for h in (10, 30, 100):
        hr = report.horizons[h]
        if hr.confidence_drivers:
            drivers_html = "; ".join(html.escape(d) for d in hr.confidence_drivers)
        else:
            drivers_html = "no penalties applied"
        driver_rows.append(
            f"<li><strong>{h}-year ({hr.confidence_label})</strong>: {drivers_html}</li>"
        )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>FloodIQ — {html.escape(report.matched_address)}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            max-width: 720px; margin: 2rem auto; padding: 0 1rem;
            color: #222; line-height: 1.45; }}
    table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; }}
    th, td {{ border: 1px solid #ccc; padding: 0.5rem; text-align: left; }}
    th {{ background: #e8eef5; }}
    .summary {{ background: #f5f7fa; padding: 1rem; border-radius: 4px;
                margin: 1rem 0; }}
    .actions {{ margin: 1rem 0; }}
    a.button {{ display: inline-block; padding: 0.6rem 1rem; background: #234;
                color: white; text-decoration: none; border-radius: 4px; }}
    .explain {{ margin-top: 2rem; padding-top: 1rem;
                border-top: 1px solid #e0e0e0; font-size: 0.95rem; }}
    .explain h2 {{ font-size: 1.05rem; margin-top: 1.25rem; margin-bottom: 0.35rem; }}
    .explain p, .explain li {{ color: #333; }}
    .explain ul {{ margin-top: 0.25rem; padding-left: 1.25rem; }}
    .explain li {{ margin-bottom: 0.4rem; }}
    .more {{ color: #555; font-size: 0.9rem; margin-top: 1rem; }}
  </style>
</head>
<body>
  <p><a href="/">&larr; New search</a></p>
  <h1>FloodIQ</h1>
  <p><strong>{html.escape(report.matched_address)}</strong><br/>
     County: {html.escape(report.county_name)} ({html.escape(report.county_fips)})</p>
  <table>
    <tr><th>Horizon</th><th>County</th><th>National</th><th>Absolute (0-100)</th><th>Confidence</th></tr>
    {''.join(rows)}
  </table>
  <div class="summary">{html.escape(report.summary_headline)}</div>
  <div class="actions">
    <a class="button" href="/report/{score_id}.pdf">Download PDF report</a>
  </div>

  <div class="explain">
    <h2>How to read this score</h2>
    <p>Each horizon score is your property's percentile compared to other properties in your county — <strong>50 is the county median, 100 is the highest risk in the county</strong>. The three horizons (10/30/100 years) show how risk evolves over time as climate projections shift. The "Absolute" column is the raw 0–100 risk number before county comparison. Scores combine FEMA flood zone data with NOAA sea level rise projections.</p>

    <h2>Source data for this address</h2>
    <ul>
      <li>{fema_line}</li>
      <li>{noaa_line}</li>
    </ul>

    <h2>Why each horizon has this confidence level</h2>
    <ul>
      {''.join(driver_rows)}
    </ul>
    <p class="more">Confidence reflects how much trust to place in the number — it starts at High and drops one tier per penalty (old FEMA maps, approximate geocode, source disagreement, missing forward-looking signal). It is computed independently of the score itself.</p>

    <p class="more">The PDF report includes the full source breakdown, buyer talking points for your insurer and seller, and the complete methodology and disclaimers. <a href="/report/{score_id}.pdf">Download it here.</a></p>
  </div>

  <p style="color:#999;font-size:0.8rem;margin-top:2rem;">Methodology v{report.methodology_version}. Not professional advice — see PDF for full disclaimers.</p>
</body>
</html>"""


def _report_to_jsonable(report: ScoreReport) -> dict:
    horizons = {
        str(h): {
            "horizon_years": hr.horizon_years,
            "fema_component": hr.fema_component,
            "noaa_component": hr.noaa_component,
            "composite_absolute": hr.composite_absolute,
            "composite_county_percentile": hr.composite_county_percentile,
            "composite_national_percentile": hr.composite_national_percentile,
            "confidence_label": hr.confidence_label,
            "confidence_drivers": hr.confidence_drivers,
            "disagreement": hr.disagreement,
        }
        for h, hr in report.horizons.items()
    }
    return {
        "methodology_version": report.methodology_version,
        "scored_at": report.scored_at,
        "input_address": report.input_address,
        "matched_address": report.matched_address,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "county_fips": report.county_fips,
        "county_name": report.county_name,
        "fema_zone_raw": report.fema_zone_raw,
        "fema_zone_normalized": report.fema_zone_normalized,
        "fema_map_effective_date": report.fema_map_effective_date,
        "fema_map_age_years": report.fema_map_age_years,
        "noaa_region_covered": report.noaa_region_covered,
        "noaa_data_available": report.noaa_data_available,
        "is_inland": report.is_inland,
        "geocoder_match_is_approximate": report.geocoder_match_is_approximate,
        "horizons": horizons,
        "summary_headline": report.summary_headline,
        "inland_note": report.inland_note,
        "error": report.error,
    }


def _report_from_stored_payload(payload: dict) -> ScoreReport:
    from floodiq.pipeline import HorizonReport
    horizons = {
        int(k): HorizonReport(
            horizon_years=v["horizon_years"],
            fema_component=v["fema_component"],
            noaa_component=v["noaa_component"],
            composite_absolute=v["composite_absolute"],
            composite_county_percentile=v["composite_county_percentile"],
            composite_national_percentile=v.get("composite_national_percentile"),
            confidence_label=v["confidence_label"],
            confidence_drivers=v["confidence_drivers"],
            disagreement=v["disagreement"],
        )
        for k, v in payload["horizons"].items()
    }
    return ScoreReport(
        methodology_version=payload["methodology_version"],
        scored_at=payload["scored_at"],
        input_address=payload["input_address"],
        matched_address=payload["matched_address"],
        latitude=payload["latitude"],
        longitude=payload["longitude"],
        county_fips=payload["county_fips"],
        county_name=payload["county_name"],
        fema_zone_raw=payload.get("fema_zone_raw"),
        fema_zone_normalized=payload.get("fema_zone_normalized"),
        fema_map_effective_date=payload.get("fema_map_effective_date"),
        fema_map_age_years=payload.get("fema_map_age_years"),
        noaa_region_covered=payload.get("noaa_region_covered", False),
        noaa_data_available=payload.get("noaa_data_available", False),
        is_inland=payload.get("is_inland", False),
        geocoder_match_is_approximate=payload.get(
            "geocoder_match_is_approximate", False
        ),
        horizons=horizons,
        summary_headline=payload.get("summary_headline", ""),
        inland_note=payload.get("inland_note"),
        error=payload.get("error"),
    )
