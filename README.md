# FloodIQ

FloodIQ scores the relative flood risk of a U.S. property across three time horizons (10/30/100-year), combining public data from FEMA's National Flood Hazard Layer with NOAA's sea level rise inundation projections. The score is reported as a percentile against the county, with a separate confidence label that reflects how much trust to place in the number.

**Live:** <https://flood-iq.vercel.app>

The full specification — what the score means, how it is calculated, and what its limitations are — lives in [METHODOLOGY.md](METHODOLOGY.md). **The methodology is the source of truth; the code follows it.** If the code disagrees with METHODOLOGY.md, the code is wrong (see Section 14 of that document).

## How it runs

```
browser ──► flood-iq.vercel.app        Next.js frontend   (frontend/)
   │
   └──────► flood-iq-api.vercel.app    FastAPI backend    (floodiq/, Vercel Python Functions)
                     │
                     ├──► Turso (libSQL)   score history, county baselines
                     └──► FEMA NFHL · NOAA SLR · OpenFEMA NFIP claims · U.S. Census geocoder · OpenStreetMap
```

Both apps deploy from this repository as two Vercel projects. Pushing to `main` deploys both to production. Other branches get preview deployments.

| Vercel project | Root directory | Config |
|---|---|---|
| `flood-iq` (frontend) | `frontend/` | `frontend/vercel.json` |
| `flood-iq-api` (backend) | `.` | `vercel.json`, `pyproject.toml` |

Backend environment variables (`flood-iq-api`):

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Hosted database. When unset, the backend uses local `data/cache.db`. |
| `FLOODIQ_ALLOWED_ORIGINS` | Exact CORS origins (production frontend). |
| `FLOODIQ_ALLOWED_ORIGIN_REGEX` | CORS pattern for this team's preview deployments. |

The frontend needs one variable, `NEXT_PUBLIC_FLOODIQ_API_BASE`, set to the backend URL.

## Local development

```bash
# Backend (uses data/cache.db; no Turso needed)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn floodiq.web.app:app --reload        # http://localhost:8000

# Frontend (proxies /api/* to the local backend)
cd frontend && npm install && npm run dev                 # http://localhost:3000
```

`data/census_tracts/tract_centroids.tsv` is committed. To refresh it from the Census Gazetteer, run `python scripts/download_tract_centroids.py`.

### First lookup in a county is slower

The first address scored in a U.S. county triggers a one-time **county baseline seed fill**: FloodIQ scores sampled Census tract locations in that county to build a comparison distribution. That takes roughly 15–60 seconds, depending on FEMA's response times. Every later lookup in that county is fast. The loading screen explains this to the user.

## Tests

```bash
pytest tests/ -q
```

Tests run fully offline against local SQLite and mocked upstream services.

## Coverage

- **FEMA NFHL** — continental U.S. (queried live). Addresses outside the continental U.S. are declined (METHODOLOGY.md Section 9.4).
- **NOAA SLR depth rasters** — continental coastal states: FL, SC, GA, NC, VA, MD, DE, NJ, NY, CT, RI, MA, NH, ME, LA, TX, MS, AL, CA, OR, WA. Properties outside these regions get FEMA-only scoring with a documented confidence penalty at the 100-year horizon (Section 9.3).
- **Flood insurance claims** — OpenFEMA NFIP claims per Census tract, shown as context and not part of the score (METHODOLOGY.md Section 3.4).
- **Geocoding** — primary: U.S. Census Geocoder. Fallback: OpenStreetMap (Nominatim), only for input with a house number and a state or ZIP that matches the result. OSM matches are flagged as approximate and lower confidence (Section 7).

## Repo layout

```
floodiq/
  scoring/        # deterministic core: normalize, horizon weights, confidence, disagreement
  sources/        # FEMA NFHL, NOAA SLR (COG raster sampling), Census geocoder, Nominatim fallback
  baseline/       # county + national percentile, tract-centroid seed filler
  cache/          # store (SQLite locally, Turso when hosted) + minimal Turso HTTP client
  report/         # 3-page PDF generator + Section 12 disclaimer text
  web/            # FastAPI app
  _vendor/        # libexpat for rasterio on Vercel (see _vendor/README.md)
  pipeline.py     # score_address() orchestrator
frontend/         # Next.js app (landing, scoring, result, error pages)
tests/            # scoring math, baselines, sources, edge cases, Turso client
scripts/          # data bootstrap, NOAA region discovery, validation sweeps, cache migration
data/             # Census tract centroids (committed); local cache.db (ignored)
METHODOLOGY.md    # source of truth — read this before touching scoring logic
```

## Known limitations

These are documented in METHODOLOGY.md Sections 9 and 12 — read those for the full version:

- **NOAA point-precision tradeoff.** NOAA's raster is sampled in a 21-cell (~63m) neighborhood around the geocoded address. A genuinely-waterfront property whose geocode lands on an elevated building footprint may read as "above SLR threshold" — the report acknowledges this case explicitly.
- **Inland flooding is not projected forward.** FEMA's flood zones include today's river floodplains, but FloodIQ has no inland equivalent of NOAA's sea-level projections yet. Inland properties keep their FEMA hazard at every horizon (the Section 5 floor), with a confidence penalty at the 100-year horizon.
- **Tie-dominated counties.** Where most of a county shares one score, the result reads "typical for this county" with a hazard level instead of a percentile (Section 6).
- **FEMA map age** is reflected in confidence, not the score itself. Old maps lose tiers.
- **Rate limits are best-effort** on serverless (per warm instance).
- **Educational tool only.** Not professional flood-risk assessment, insurance underwriting, or real estate advice. Full disclaimer text in `floodiq/report/disclaimers.py` and on the PDF.
