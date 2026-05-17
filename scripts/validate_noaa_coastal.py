"""Coastal validation for the NOAA SLR integration.

Hits a curated set of FL and SC coastal addresses, prints per-horizon
composites, and contrasts with one DC inland control. Skips persistence
(no DB writes, no seed fill). Designed to be run after changes to
floodiq/sources/noaa.py to confirm the climate-adjusted scoring is
actually firing for coastal properties.
"""

from __future__ import annotations

import time

from floodiq.pipeline import score_address


ADDRESSES = [
    # Florida — known waterfront / flood-prone
    "1 Bayshore Blvd, Tampa, FL 33606",
    "100 Beach Dr NE, St Petersburg, FL 33701",
    "100 Ocean Dr, Miami Beach, FL 33139",
    "1100 Collins Ave, Miami Beach, FL 33139",
    "100 Atlantic Ave, Fort Lauderdale, FL 33304",
    # Florida — Keys
    "1100 Truman Ave, Key West, FL 33040",
    # South Carolina — Charleston historic district + Sullivan's / Folly
    "100 East Bay St, Charleston, SC 29401",
    "100 Meeting St, Charleston, SC 29401",
    "100 Center St, Folly Beach, SC 29439",
    # Inland controls — should be NOAA-uncovered
    "1600 Pennsylvania Ave NW, Washington, DC 20500",
    "100 1st St SE, Cedar Rapids, IA 52401",
]


def main() -> None:
    for a in ADDRESSES:
        t0 = time.time()
        r = score_address(a, persist=False)
        dt = time.time() - t0
        print(f"=== {a}  ({dt:.1f}s)")
        if r.error:
            print(f"   ERROR: {r.error[:80]}")
            print()
            continue
        print(
            f"   FEMA: {r.fema_zone_normalized}  "
            f"inland={r.is_inland}  NOAA-signal={r.noaa_data_available}  "
            f"approx={r.geocoder_match_is_approximate}"
        )
        for h in (10, 30, 100):
            hr = r.horizons[h]
            print(
                f"     {h:>3}y: F={hr.fema_component:>2} N={hr.noaa_component:>3} "
                f"comp={hr.composite_absolute:5.1f}  {hr.confidence_label:<6} "
                f"disagree={hr.disagreement}"
            )
        print()


if __name__ == "__main__":
    main()
