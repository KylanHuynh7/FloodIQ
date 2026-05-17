"""Discover NOAA SLR Viewer region names + raster bounds for each state.

Scrapes NOAA's per-state index page to find region codes, then opens
one GeoTIFF per region remotely to read its true bounding box. Output
is a ready-to-paste Python list literal for COASTAL_REGIONS in
floodiq/sources/noaa.py.

We use 1.0ft as the canonical "small" raster to read bounds from — all
SLR depths within a region share the same footprint, so any will do.
"""

from __future__ import annotations

import re
import sys
import urllib.request

import rasterio


# Order from highest expected coastal-flood density to lower. FL+SC are
# already in noaa.py; we re-discover them here so the table is uniform.
STATES = [
    # Already covered (will re-derive precise bounds):
    "FL", "SC",
    # Gulf Coast (highest priority expansion):
    "LA", "TX", "MS", "AL",
    # Southeast continuation:
    "GA", "NC",
    # Mid-Atlantic + NYC:
    "VA", "MD", "DE", "NJ", "NY",
    # Northeast:
    "CT", "RI", "MA", "NH", "ME",
    # West Coast:
    "CA", "OR", "WA",
]

BASE = "https://coast.noaa.gov/slrdata/Depth_Rasters"


def regions_for_state(state: str) -> list[str]:
    url = f"{BASE}/{state}/index.html"
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            html = resp.read().decode("latin-1", errors="ignore")
    except Exception as e:
        print(f"  ! could not fetch index for {state}: {e}", file=sys.stderr)
        return []
    matches = re.findall(rf"({state}_[A-Za-z0-9_]+?)_slr_depth_", html)
    seen, ordered = set(), []
    for m in matches:
        if m not in seen:
            seen.add(m)
            ordered.append(m)
    return ordered


def bounds_for(state: str, region: str) -> tuple[float, float, float, float] | None:
    # 0.5ft is published universally; 1.0ft is FL-only.
    for depth in ("0_5", "1_0", "1_5"):
        url = f"{BASE}/{state}/{region}_slr_depth_{depth}ft.tif"
        try:
            with rasterio.open(url) as ds:
                b = ds.bounds
                crs = ds.crs
            break
        except Exception:
            continue
    else:
        print(f"  ! no openable raster for {state}/{region}", file=sys.stderr)
        return None
    # If the raster is in geographic coordinates (NAD83 or WGS84), the
    # bounds are already lat/lon. Otherwise we'd need to reproject; flag
    # for manual review.
    if crs is None:
        print(f"  ! {region}: no CRS", file=sys.stderr)
        return None
    if crs.to_epsg() not in (4269, 4326):
        # Reproject corners to WGS84.
        from rasterio.warp import transform_bounds
        try:
            b = transform_bounds(crs, "EPSG:4326", *b, densify_pts=21)
        except Exception as e:
            print(f"  ! {region}: reprojection failed: {e}", file=sys.stderr)
            return None
    return float(b[1]), float(b[3]), float(b[0]), float(b[2])  # lat_min, lat_max, lon_min, lon_max


def main() -> None:
    rows: list[str] = []
    for state in STATES:
        print(f"=== {state} ===")
        regions = regions_for_state(state)
        if not regions:
            print(f"  (no regions found)")
            continue
        for region in regions:
            b = bounds_for(state, region)
            if b is None:
                continue
            lat_min, lat_max, lon_min, lon_max = b
            print(
                f"  {region:<20}  "
                f"lat=({lat_min:7.3f},{lat_max:7.3f})  "
                f"lon=({lon_min:8.3f},{lon_max:8.3f})"
            )
            rows.append(
                f'    ("{state}", "{region}", {lat_min:.3f}, {lat_max:.3f}, '
                f"{lon_min:.3f}, {lon_max:.3f}),"
            )
    print()
    print("# === Paste into floodiq/sources/noaa.py: ===")
    print("COASTAL_REGIONS: list[tuple[str, str, float, float, float, float]] = [")
    for r in rows:
        print(r)
    print("]")


if __name__ == "__main__":
    main()
