# NOAA Sea Level Rise data — drop zone

FloodIQ v1 uses NOAA's sea level rise inundation projections (Section 3.2 of METHODOLOGY.md) under the **intermediate** scenario (Section 12).

NOAA publishes this data as bulk downloads, not a query API, so it must be downloaded once and stored here.

## What to drop in

Source: NOAA Office for Coastal Management, [Sea Level Rise Viewer data downloads](https://coast.noaa.gov/slr/) — the "Depth and elevation data" products.

For each region of interest (coastal CONUS), download the per-decade inundation depth GeoTIFFs for the **intermediate** scenario at projection years that cover the FloodIQ horizons. With the v1 horizon-to-projection-year mapping in `floodiq/sources/noaa.py`, the typical targets are:

- 10-year horizon → projection year (current + 10), rounded to the nearest decade
- 30-year horizon → projection year (current + 30)
- 100-year horizon → projection year (current + 100) — note: NOAA's published projection ceiling may not extend this far for all scenarios. The closest available year should be used and the limitation surfaced in the PDF.

Drop the files in this directory. Once any `.tif`, `.tiff`, `.parquet`, or `.csv` file is present, `data_available()` in `floodiq/sources/noaa.py` will return True and the lookup function will need its raster-sampling implementation completed (see the `TODO(human-input)` in that file).

## v1 fallback when this directory is empty

Per METHODOLOGY.md Section 9.3, properties without a NOAA inundation projection are treated as inland: NOAA component = 0 for all horizons, composite scores become FEMA-driven, and confidence on the 100-year horizon is reduced by one tier. This is documented in the user-facing output.

## Open methodology question

The exact regional coverage and the handling of the 100-year horizon when NOAA's published data does not reach that far out are both unresolved. Please specify before populating this directory.
