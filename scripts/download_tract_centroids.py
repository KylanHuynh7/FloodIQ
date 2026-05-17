"""One-time downloader for Census tract centroids (Section 6 seed source).

Pulls the Census 2024 Gazetteer national tracts file, keeps only CONUS
tracts, and writes a slim TSV at data/census_tracts/tract_centroids.tsv
with columns: county_fips, tract_geoid, lat, lon.

Idempotent — safe to re-run; just re-overwrites the slim file.

Source: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/
"""

from __future__ import annotations

import csv
import io
import sys
import urllib.request
import zipfile
from pathlib import Path


GAZETTEER_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
    "2024_Gazetteer/2024_Gaz_tracts_national.zip"
)
OUT_DIR = Path(__file__).resolve().parents[1] / "data" / "census_tracts"
OUT_PATH = OUT_DIR / "tract_centroids.tsv"

# State FIPS codes to exclude (non-CONUS, matching pipeline.NON_CONUS_STATE_FIPS).
EXCLUDE_STATE_FIPS = {"02", "15", "60", "66", "69", "72", "78"}


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {GAZETTEER_URL}")
    with urllib.request.urlopen(GAZETTEER_URL, timeout=120) as resp:
        zip_bytes = resp.read()
    print(f"  {len(zip_bytes):,} bytes")

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # The archive contains one .txt file (tab-separated).
        names = [n for n in zf.namelist() if n.lower().endswith(".txt")]
        if not names:
            print("ERROR: no .txt file in archive", file=sys.stderr)
            return 1
        with zf.open(names[0]) as f:
            raw = f.read().decode("latin-1")

    # Parse. Columns of interest: GEOID, INTPTLAT, INTPTLONG.
    reader = csv.DictReader(io.StringIO(raw), delimiter="\t")
    # Census ships with trailing whitespace on column names — normalize.
    reader.fieldnames = [c.strip() for c in (reader.fieldnames or [])]

    kept = 0
    skipped = 0
    with OUT_PATH.open("w", newline="") as out:
        writer = csv.writer(out, delimiter="\t")
        writer.writerow(["county_fips", "tract_geoid", "lat", "lon"])
        for row in reader:
            geoid = (row.get("GEOID") or "").strip()
            if len(geoid) != 11:
                skipped += 1
                continue
            state_fips = geoid[:2]
            if state_fips in EXCLUDE_STATE_FIPS:
                skipped += 1
                continue
            county_fips = geoid[:5]
            try:
                lat = float((row.get("INTPTLAT") or "").strip())
                lon = float((row.get("INTPTLONG") or "").strip())
            except ValueError:
                skipped += 1
                continue
            writer.writerow([county_fips, geoid, f"{lat:.6f}", f"{lon:.6f}"])
            kept += 1

    print(f"Wrote {OUT_PATH}")
    print(f"  kept: {kept:,} CONUS tracts; skipped: {skipped:,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
