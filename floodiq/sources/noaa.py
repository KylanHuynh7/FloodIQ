"""NOAA Sea Level Rise inundation lookup (Section 3.2).

Reads NOAA's Sea Level Rise Viewer depth rasters as Cloud Optimized
GeoTIFFs hosted at coast.noaa.gov. Because they are COGs, we can sample
individual points via HTTP range requests without downloading the full
files (each is hundreds of MB to multiple GB).

Coverage in v1: Florida (all 11 NOAA-defined sub-regions) and South
Carolina. Properties outside these bounding boxes register as having no
NOAA signal, which Section 9.3 already documents and the rest of the
pipeline already handles (inland behavior).

SLR scenario: NOAA 2022 Sea Level Rise Technical Report **Intermediate**
scenario, per METHODOLOGY.md Section 12. Horizon years map to SLR feet
by linear interpolation against the published intermediate trajectory,
then snap to the nearest published 0.5-ft increment.

NOAA depth rasters store inundation depth in **meters above ground
level** for a given amount of SLR (in feet); cells outside the
inundation extent are nodata. We convert meters→feet, treat huge
sentinel values as nodata, and clamp absurd outliers (open-water cells
sometimes read as ~100m+, but that's already past the top score band).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from rasterio.errors import RasterioIOError
from rasterio.windows import Window


NOAA_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "noaa_slr"

# Section 12: FloodIQ v1 uses NOAA's intermediate scenario.
NOAA_SCENARIO = "intermediate"

# NOAA 2022 Sea Level Rise Technical Report — Intermediate scenario, US
# average GMSL in feet relative to year 2000 baseline. Used to convert
# a FloodIQ horizon (years from now) into the SLR amount the depth raster
# represents.
INTERMEDIATE_SLR_FEET_BY_YEAR = {
    2000: 0.0,
    2030: 0.5,
    2050: 1.0,
    2070: 1.7,
    2100: 3.3,
    2150: 5.5,
}

# NOAA publishes depth rasters on different grids per state:
#   - "Dense" states publish the full 0.5-ft grid from 0.0 through 10.0
#     (FL, CT, RI, MA, NH).
#   - All other coastal states publish only odd half-foot values
#     (0.5, 1.5, 2.5, ..., 9.5).
# Asking for a depth that isn't published yields a 404. The snap-to
# function picks from the state-specific grid.
DENSE_GRID_STATES = {"FL", "CT", "RI", "MA", "NH"}
DENSE_PUBLISHED_DEPTHS_FT = [round(0.5 * i, 1) for i in range(0, 21)]
SPARSE_PUBLISHED_DEPTHS_FT = [round(0.5 + 1.0 * i, 1) for i in range(0, 10)]

# Backwards-compat alias used by tests written under the FL-only assumption.
PUBLISHED_DEPTHS_FT = DENSE_PUBLISHED_DEPTHS_FT

# Base URL for the depth rasters (COGs). For region-subdivided states the
# filename is "{region}_slr_depth_..." (region includes the state prefix,
# e.g. FL_SE). For single-file states the filename is "{state}_slr_depth_..."
# and we set the region equal to the state code.
NOAA_DEPTH_URL_TMPL = (
    "https://coast.noaa.gov/slrdata/Depth_Rasters/{state}/{region}_slr_depth_{whole}_{half}ft.tif"
)

# Region bounding boxes (lat_min, lat_max, lon_min, lon_max) discovered by
# opening each region's GeoTIFF and reading its actual bounds. Generated
# via scripts/discover_noaa_regions.py — see that script to refresh.
#
# Coverage: all CONUS coastal states (FL, SC, LA, TX, MS, AL, GA, NC, VA,
# MD, DE, NJ, NY, CT, RI, MA, NH, ME, CA, OR, WA) plus inland-water states
# served by NOAA's tidal-influenced regions. Pacific Coast (WA exposed
# coast) is partially missing — NOAA lists it but the rasters 404 as of
# v1.0; covered states still get full Puget Sound + LA Basin coverage.
COASTAL_REGIONS: list[tuple[str, str, float, float, float, float]] = [
    # (state, region, lat_min, lat_max, lon_min, lon_max)
    # Florida — 11 sub-regions
    ("FL", "FL_East_1", 26.956, 28.792, -81.660, -80.022),
    ("FL", "FL_East_2", 28.344, 29.841, -82.537, -80.662),
    ("FL", "FL_Keys", 24.395, 25.355, -83.016, -80.149),
    ("FL", "FL_NE", 29.622, 30.831, -82.052, -81.150),
    ("FL", "FL_Pan_East", 29.535, 30.831, -86.001, -83.603),
    ("FL", "FL_Pan_West", 30.212, 31.000, -87.636, -85.844),
    ("FL", "FL_SE", 25.107, 26.972, -80.887, -79.973),
    ("FL", "FL_SW", 25.105, 26.950, -82.336, -80.857),
    ("FL", "FL_West_1", 26.756, 28.492, -82.940, -81.553),
    ("FL", "FL_West_2", 28.432, 29.592, -83.241, -81.638),
    ("FL", "FL_West_3", 29.250, 30.305, -84.001, -82.655),
    # South Carolina — 3 sub-regions
    ("SC", "SC_Central", 32.482, 33.508, -80.793, -79.261),
    ("SC", "SC_North", 33.049, 34.308, -80.103, -78.498),
    ("SC", "SC_South", 32.033, 33.182, -81.429, -80.223),
    # Louisiana — 6 sub-regions (Gulf Coast highest-risk priority)
    ("LA", "LA_CentralEast", 28.985, 30.658, -91.702, -89.998),
    ("LA", "LA_CentralNorth", 30.298, 31.013, -92.635, -91.308),
    ("LA", "LA_Central", 29.239, 30.499, -92.740, -91.082),
    ("LA", "LA_Delta", 28.854, 30.213, -90.690, -88.757),
    ("LA", "LA_LP", 29.909, 31.000, -91.663, -89.504),
    ("LA", "LA_West", 29.528, 30.741, -93.930, -92.582),
    # Texas — 5 sub-regions
    ("TX", "TX_Central", 28.022, 29.265, -97.307, -95.496),
    ("TX", "TX_North1", 29.505, 31.188, -94.734, -93.507),
    ("TX", "TX_North2", 28.768, 30.494, -95.962, -94.352),
    ("TX", "TX_South1", 27.557, 28.556, -97.943, -96.762),
    ("TX", "TX_South2", 25.836, 27.637, -98.061, -97.088),
    # Mississippi, Alabama — single statewide rasters
    ("MS", "MS", 30.145, 30.737, -89.691, -88.383),
    ("AL", "AL", 30.144, 31.992, -88.465, -86.905),
    # Georgia — 2 sub-regions
    ("GA", "GA_North", 31.290, 32.596, -81.983, -80.750),
    ("GA", "GA_South", 30.355, 31.830, -82.421, -81.182),
    # North Carolina — 5 sub-regions
    ("NC", "NC_Middle1", 35.348, 36.548, -77.524, -75.839),
    ("NC", "NC_Middle2", 35.005, 36.246, -76.606, -75.399),
    ("NC", "NC_Northern", 35.974, 36.553, -76.952, -75.708),
    ("NC", "NC_Southern1", 33.752, 34.733, -78.652, -77.483),
    ("NC", "NC_Southern2", 34.399, 35.762, -77.732, -76.005),
    # Virginia — 4 sub-regions (includes Chesapeake)
    ("VA", "VA_ES", 36.990, 38.029, -76.238, -75.165),
    ("VA", "VA_Mid", 36.909, 38.349, -77.568, -76.112),
    ("VA", "VA_N", 37.564, 38.974, -77.553, -76.129),
    ("VA", "VA_S", 36.543, 37.568, -77.503, -75.796),
    # Maryland — 5 sub-regions (includes Chesapeake)
    ("MD", "MD_East", 38.057, 39.264, -76.466, -75.699),
    ("MD", "MD_North", 38.992, 39.723, -76.571, -75.755),
    ("MD", "MD_Southeast", 37.886, 38.562, -76.238, -74.985),
    ("MD", "MD_Southwest", 37.888, 38.708, -77.324, -76.200),
    ("MD", "MD_West", 38.304, 39.722, -77.188, -76.287),
    # Delaware — single statewide raster
    ("DE", "DE", 38.450, 39.845, -75.790, -74.983),
    # New Jersey — 3 sub-regions
    ("NJ", "NJ_Middle", 39.474, 40.526, -75.062, -73.884),
    ("NJ", "NJ_Northern", 40.250, 41.204, -74.799, -73.893),
    ("NJ", "NJ_Southern", 38.788, 39.997, -75.572, -74.231),
    # New York — 3 sub-regions (covers NYC metro)
    ("NY", "NY_HU", 41.275, 42.797, -74.121, -73.622),
    ("NY", "NY_M", 40.476, 41.337, -74.260, -73.422),
    ("NY", "NY_SK", 40.533, 41.311, -73.501, -71.776),
    # Connecticut, Rhode Island, Massachusetts, New Hampshire — single rasters
    ("CT", "CT", 40.950, 42.040, -73.729, -71.787),
    ("RI", "RI", 41.095, 42.020, -71.908, -71.087),
    ("MA", "MA", 41.186, 42.888, -71.900, -69.858),
    ("NH", "NH", 42.737, 43.485, -71.453, -70.574),
    # Maine — 2 sub-regions
    ("ME", "ME_East", 44.028, 45.193, -69.256, -66.884),
    ("ME", "ME_West", 42.916, 44.627, -70.843, -68.481),
    # California — 7 sub-regions (Catalina, SF Bay, LA, etc.)
    ("CA", "CA_Catalina", 33.248, 33.532, -118.668, -118.241),
    ("CA", "CA_Central", 34.897, 37.287, -122.319, -119.471),
    ("CA", "CA_Delta", 37.134, 39.307, -122.423, -120.386),
    ("CA", "CA_North1", 40.000, 42.002, -124.483, -123.405),
    ("CA", "CA_North2", 38.757, 40.003, -124.136, -122.820),
    ("CA", "CA_SFBay", 36.893, 38.865, -123.634, -121.207),
    ("CA", "CA_South", 32.528, 35.116, -120.735, -116.080),
    # Oregon — 3 sub-regions
    ("OR", "OR_MFR", 41.997, 43.864, -124.705, -123.923),
    ("OR", "OR_PQR1", 43.861, 45.784, -124.231, -123.611),
    ("OR", "OR_PQR2", 45.448, 46.300, -124.161, -121.941),
    # Washington — 4 sub-regions (Puget Sound + Columbia; outer coast missing)
    ("WA", "WA_PugetSound_NE", 47.774, 49.003, -123.324, -120.653),
    ("WA", "WA_PugetSound_SE", 46.718, 47.796, -123.206, -121.062),
    ("WA", "WA_PugetSound_West", 47.079, 48.371, -123.821, -122.413),
    ("WA", "WA_South", 45.543, 46.795, -124.183, -119.865),
]

# Values outside [-1e30, 1e30] are sentinels (float32 nodata variants).
_SENTINEL_LIMIT = 1e30
# Cells with depth values above this threshold (in METERS) represent
# existing open water — rivers, bays, ocean — rather than SLR-induced
# inundation of land. They get filtered out so a property doesn't get
# flagged as flooded just because the raster pixel happens to sit on
# the surface of an adjacent bay.
_OPEN_WATER_M_THRESHOLD = 15.0
# Real SLR-induced inundation rarely exceeds ~15 ft even at 10 ft of
# SLR; cap so a noisy outlier doesn't push past the top normalization band.
_MAX_REASONABLE_FEET = 50.0
_METERS_TO_FEET = 3.28084


@dataclass(frozen=True)
class NoaaLookup:
    inundation_feet: float | None  # None when no signal for this location/horizon
    projection_year: int
    scenario: str
    data_available: bool  # True iff the location is inside a covered region


def data_available() -> bool:
    """v1 always has the COG endpoints reachable; True is the right default.
    Kept for backwards compatibility with the earlier stub interface."""
    return True


def horizon_to_slr_feet(horizon_years: int, now_year: int) -> float:
    """Linearly interpolate the NOAA Intermediate-scenario SLR amount in
    feet for the target year (now_year + horizon_years)."""
    target_year = now_year + horizon_years
    years = sorted(INTERMEDIATE_SLR_FEET_BY_YEAR.keys())
    if target_year <= years[0]:
        return INTERMEDIATE_SLR_FEET_BY_YEAR[years[0]]
    if target_year >= years[-1]:
        return INTERMEDIATE_SLR_FEET_BY_YEAR[years[-1]]
    for i in range(len(years) - 1):
        if years[i] <= target_year <= years[i + 1]:
            t = (target_year - years[i]) / (years[i + 1] - years[i])
            v0 = INTERMEDIATE_SLR_FEET_BY_YEAR[years[i]]
            v1 = INTERMEDIATE_SLR_FEET_BY_YEAR[years[i + 1]]
            return v0 + t * (v1 - v0)
    return INTERMEDIATE_SLR_FEET_BY_YEAR[years[-1]]


def snap_to_published_depth(slr_feet: float, state: str = "FL") -> float:
    """Snap an interpolated SLR amount to the nearest depth that NOAA
    actually publishes for the given state. Florida has a denser grid
    than the other coastal states."""
    grid = (
        DENSE_PUBLISHED_DEPTHS_FT
        if state in DENSE_GRID_STATES
        else SPARSE_PUBLISHED_DEPTHS_FT
    )
    # Pick the grid value with the smallest absolute difference. Break
    # ties in favor of the larger depth — slightly more conservative
    # (buyer-protective) than the symmetric alternative.
    snapped = min(grid, key=lambda d: (abs(d - slr_feet), -d))
    return snapped


def _region_for(lat: float, lon: float) -> tuple[str, str] | None:
    for state, region, lat_min, lat_max, lon_min, lon_max in COASTAL_REGIONS:
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return state, region
    return None


def _url_for(state: str, region: str, slr_ft: float) -> str:
    whole = int(slr_ft)
    half = int(round((slr_ft - whole) * 10))  # 0 or 5
    return NOAA_DEPTH_URL_TMPL.format(
        state=state, region=region, whole=whole, half=half
    )


# 21x21 cell window ≈ 63m radius at NOAA's ~3m raster resolution. This
# is roughly the scale of a city block. Single-cell sampling is too
# precise: geocoded points often land on building rooftops which are
# above the SLR threshold while the surrounding street floods. A small
# neighborhood (parcel only) misses these cases — e.g., Charleston's
# historic district was reading as dry at 4.5ft SLR with a 9-cell
# window even though 87% of nearby cells were flooded. The 21-cell
# window captures the buyer-meaningful question of "does flooding
# reach my property" without going so wide that we conflate distant
# neighbors with the lot itself.
_NEIGHBORHOOD_CELLS = 21


def _sample_depth_feet(lat: float, lon: float, slr_ft: float) -> float | None:
    """Sample the NOAA depth raster for (lat, lon) at the given SLR amount.

    Reads a small window around the point and returns the maximum
    inundation depth (in feet) over that neighborhood — see the
    ``_NEIGHBORHOOD_CELLS`` comment for the rationale.

    Returns None for no signal (outside region coverage, all neighborhood
    cells nodata, raster fetch failure).
    """
    region = _region_for(lat, lon)
    if region is None:
        return None
    state, region_name = region
    url = _url_for(state, region_name, slr_ft)
    half = _NEIGHBORHOOD_CELLS // 2
    try:
        with rasterio.open(url) as ds:
            row, col = ds.index(lon, lat)
            w = Window(
                col_off=max(0, col - half),
                row_off=max(0, row - half),
                width=_NEIGHBORHOOD_CELLS,
                height=_NEIGHBORHOOD_CELLS,
            )
            data = ds.read(1, window=w)
    except (RasterioIOError, IndexError, ValueError, OSError):
        return None
    arr = np.asarray(data, dtype=np.float64)
    # Keep cells that are: finite, positive (NOAA encodes dry land as
    # nodata), below sentinel range, and below the open-water threshold.
    valid = arr[
        (np.abs(arr) < _SENTINEL_LIMIT)
        & (arr > 0)
        & (arr < _OPEN_WATER_M_THRESHOLD)
        & np.isfinite(arr)
    ]
    if valid.size == 0:
        return None
    max_meters = float(valid.max())
    feet = max_meters * _METERS_TO_FEET
    if feet <= 0:
        return None
    return min(feet, _MAX_REASONABLE_FEET)


def horizon_to_projection_year(horizon_years: int, now_year: int) -> int:
    """Used by callers that just want the calendar year a horizon points at."""
    target = now_year + horizon_years
    return round(target / 10) * 10


def lookup_noaa(
    latitude: float,
    longitude: float,
    horizon_years: int,
    *,
    now_year: int,
) -> NoaaLookup:
    """Look up projected NOAA inundation depth (feet) at (lat, lon) for a
    FloodIQ horizon. Properties outside Florida/South Carolina coverage
    return inundation_feet=None with data_available=False — Section 9.3
    inland handling applies."""
    projection_year = horizon_to_projection_year(horizon_years, now_year)
    region = _region_for(latitude, longitude)
    if region is None:
        return NoaaLookup(
            inundation_feet=None,
            projection_year=projection_year,
            scenario=NOAA_SCENARIO,
            data_available=False,
        )

    state, _ = region
    slr_ft = horizon_to_slr_feet(horizon_years, now_year)
    snapped = snap_to_published_depth(slr_ft, state)
    feet = _sample_depth_feet(latitude, longitude, snapped)
    return NoaaLookup(
        inundation_feet=feet,
        projection_year=projection_year,
        scenario=NOAA_SCENARIO,
        data_available=True,
    )
