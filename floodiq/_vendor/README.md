# Vendored native libraries

## libexpat.so.1 (Expat 2.8.5, MIT — see LICENSE-expat)

rasterio's Linux wheels bundle GDAL, which links against the system
`libexpat.so.1`. Vercel's Python runtime doesn't ship it, so importing
rasterio there fails with `ImportError: libexpat.so.1: cannot open shared
object file`. `floodiq/sources/noaa.py` loads this copy with
`RTLD_GLOBAL` (Linux only, before `import rasterio`) so GDAL resolves to it.
On macOS and on Linux hosts that have expat, it is unused.

- Source: conda-forge `linux-64/libexpat-2.8.5-hd2095e1_0.conda`
  (built for glibc >= 2.17)
- Package sha256 (as published by conda-forge):
  `6de73033a7c5f712c9c5a54124e4581e025691029835e5bceaf10a333a7e7bc0`
- `libexpat.so.1` sha256: `8b61b41a8f5bee8d8d336e8bc5318233d6b435d482a7510f4e01788b618a6598`
