# FloodIQ

FloodIQ scores the relative flood risk of a U.S. property across three time horizons (10/30/100-year), combining public data from FEMA's National Flood Hazard Layer with NOAA's sea level rise inundation projections. The score is reported as a percentile against the county median, with a separate confidence label that reflects how much trust to place in the number.

The full specification — what the score means, how it is calculated, and what its limitations are — lives in [METHODOLOGY.md](METHODOLOGY.md). **The methodology is the source of truth; the code follows it.** If the code disagrees with METHODOLOGY.md, the code is wrong (see Section 14 of that document).

## Status

**v1.1** — methodology and pipeline complete, 75 tests passing, locally validated end-to-end. Backend is stable; frontend is functional but visually unstyled (no design polish beyond raw HTML).

## Quickstart

```bash
# 1. Create venv and install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. One-time data bootstrap: download Census tract centroids (~2.4 MB)
python scripts/download_tract_centroids.py

# 3. Start the web app
PYTHONPATH=. uvicorn floodiq.web.app:app --reload
```

Then open <http://localhost:8000>.

### First lookup takes a while

The first address you score in any given U.S. county triggers a one-time **county baseline seed fill** — FloodIQ scores ~25 Census tract centroids in that county via FEMA's NFHL endpoint to build a comparison distribution. This takes ~30–60 seconds (5 concurrent FEMA calls). Every subsequent address in that same county is fast (~2–5 seconds).

The web UI shows a loading screen with a message explaining this.

## Coverage

- **FEMA NFHL** — all CONUS, plus most US territories (queried live via NOAA's public ArcGIS REST service).
- **NOAA SLR depth rasters** — all CONUS coastal states: FL, SC, GA, NC, VA, MD, DE, NJ, NY, CT, RI, MA, NH, ME, LA, TX, MS, AL, CA, OR, WA. Properties outside these regions get FEMA-only scoring with a documented confidence penalty at the 100-year horizon (see METHODOLOGY.md Section 9.3).
- **Geocoding** — primary: U.S. Census Geocoder. Fallback: OpenStreetMap (Nominatim) for addresses Census can't match. OSM matches are flagged as approximate and trigger a Section 7 confidence penalty.

## Repo layout

```
floodiq/
  scoring/        # deterministic core: normalize, horizon weights, confidence, disagreement
  sources/        # FEMA NFHL, NOAA SLR (COG raster sampling), Census geocoder, Nominatim fallback
  baseline/       # county + national percentile, tract-centroid seed filler
  cache/          # SQLite cache (source pulls + score history + seed scores)
  report/         # 3-page PDF generator + Section 12 disclaimer text
  web/            # FastAPI app + minimal HTML
  pipeline.py     # score_address() orchestrator
tests/            # 75 tests covering scoring math, baselines, sources, edge cases
scripts/          # one-shot tools: tract download, NOAA region discovery, validation sweeps
data/             # local cache.db, Census tract centroids TSV
METHODOLOGY.md    # source of truth — read this before touching scoring logic
```

## Tests

```bash
pytest tests/ -q
```

## Deployment caveats

The app runs cleanly on `localhost`. Before exposing it publicly, address these items (which are deferred from v1.1 — see the OWASP audit in the commit history for details):

- **TLS termination** at a reverse proxy (Caddy / Cloudflare / Fly) — uvicorn alone is HTTP.
- **Rate limiting** on `/score` — without it, a malicious or buggy client could exhaust FEMA's quota or pile up seed-fill work for every U.S. county.
- **Persistent storage for `data/cache.db`** — if containerized, this needs a volume or you lose score history and seed baselines on restart.
- **Custom 500 handler** — FastAPI's default returns plain "Internal Server Error" but with stack traces visible in dev mode.

## Known limitations

These are documented in METHODOLOGY.md Sections 9 and 12 — read those for the full version:

- **NOAA point-precision tradeoff.** NOAA's raster is sampled in a 21-cell (~63m) neighborhood around the geocoded address. A genuinely-waterfront property whose geocode lands on an elevated building footprint may read as "above SLR threshold" — the report acknowledges this case explicitly.
- **Inland flooding not modeled.** v1.1 has no riverine SLR equivalent; inland properties are scored on FEMA alone with a confidence penalty.
- **FEMA map age** is reflected in confidence, not the score itself. Old maps lose tiers.
- **Educational tool only.** Not professional flood-risk assessment, insurance underwriting, or real estate advice. Full disclaimer text in `floodiq/report/disclaimers.py` and on the PDF.
