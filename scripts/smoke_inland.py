"""Smoke test scenario 3: inland property in a non-trivial FEMA zone.

We try a handful of addresses far from any coast that are in or near
known inland floodplains (Cedar River, Mississippi, Red River). The
goal isn't to validate the score — it's to see what the pipeline
actually does with the spec when NOAA is 0 and FEMA is AE / A / etc.

Run: .venv/bin/python scripts/smoke_inland.py
"""

from __future__ import annotations

from floodiq.pipeline import score_address


ADDRESSES = [
    # Cedar Rapids, IA — devastated by 2008 Cedar River flood. The
    # downtown riverfront is in zone AE.
    "100 1st St SE, Cedar Rapids, IA 52401",
    # Davenport, IA — Mississippi riverfront, well-known AE areas.
    "200 W River Dr, Davenport, IA 52801",
    # Grand Forks, ND — Red River floodplain, post-1997 levee.
    "200 N 3rd St, Grand Forks, ND 58203",
    # An inland address that should be solidly X-unshaded for contrast.
    "1600 Pennsylvania Ave NW, Washington, DC 20500",
]


def main() -> None:
    for addr in ADDRESSES:
        print("=" * 78)
        print(f"INPUT: {addr}")
        try:
            r = score_address(addr, persist=False)
        except Exception as e:
            print(f"  pipeline error: {e}")
            continue

        if r.error:
            print(f"  ERROR (Section 9 edge case): {r.error}")
            continue

        print(f"  matched: {r.matched_address}")
        print(
            f"  county:  {r.county_name} ({r.county_fips}) "
            f"@ ({r.latitude:.4f}, {r.longitude:.4f})"
        )
        print(
            f"  FEMA:    zone={r.fema_zone_raw} (norm={r.fema_zone_normalized}) "
            f"map effective={r.fema_map_effective_date} "
            f"age={r.fema_map_age_years:.1f}y"
            if r.fema_map_age_years is not None
            else f"  FEMA:    zone={r.fema_zone_raw} (norm={r.fema_zone_normalized}) "
            f"map effective={r.fema_map_effective_date} age=unknown"
        )
        print(
            f"  NOAA:    data_available={r.noaa_data_available} "
            f"is_inland={r.is_inland}"
        )
        for h in (10, 30, 100):
            hr = r.horizons[h]
            drivers = "; ".join(hr.confidence_drivers) or "no reductions"
            print(
                f"  {h:>3}y:   FEMA={hr.fema_component:>3} NOAA={hr.noaa_component:>3} "
                f"composite={hr.composite_absolute:6.1f}  "
                f"confidence={hr.confidence_label:<6}  "
                f"disagree={hr.disagreement}"
            )
            print(f"         drivers: {drivers}")
        print(f"  summary: {r.summary_headline}")


if __name__ == "__main__":
    main()
