"""Validation sweep for the multi-state NOAA SLR rollout.

One or two well-known coastal addresses per newly-covered state. Hits
the full pipeline with persist=False (no seed fill, no DB writes).
Surfaces NOAA-signal coverage, FEMA zone, and the climate-adjusted
100-year composite so we can confirm coastal scoring is firing.
"""

from __future__ import annotations

import time

from floodiq.pipeline import score_address


# Two waterfront addresses per state where possible — pick well-known
# landmarks that Census geocodes cleanly.
ADDRESSES_BY_STATE = {
    "LA": [
        "1 Canal St, New Orleans, LA 70130",
        "100 Beach Blvd, Biloxi, MS 39530",  # nearby, leans LA/MS boundary
    ],
    "TX": [
        "2200 Seawall Blvd, Galveston, TX 77550",
        "100 N Shoreline Blvd, Corpus Christi, TX 78401",
    ],
    "MS": [
        "100 Beach Blvd, Gulfport, MS 39501",
    ],
    "AL": [
        "1 Battleship Pkwy, Mobile, AL 36602",
        "100 W Beach Blvd, Gulf Shores, AL 36542",
    ],
    "GA": [
        "1 Bay St, Savannah, GA 31401",
        "100 Tybrisa St, Tybee Island, GA 31328",
    ],
    "NC": [
        "100 Front St, Beaufort, NC 28516",
        "100 S Lumina Ave, Wrightsville Beach, NC 28480",
    ],
    "VA": [
        "300 Atlantic Ave, Virginia Beach, VA 23451",
        "1 Waterside Dr, Norfolk, VA 23510",
    ],
    "MD": [
        "100 Main St, Annapolis, MD 21401",
        "1 Boardwalk, Ocean City, MD 21842",
    ],
    "DE": [
        "100 Rehoboth Ave, Rehoboth Beach, DE 19971",
    ],
    "NJ": [
        "1 S Beach Blvd, Atlantic City, NJ 08401",
        "100 Atlantic Ave, Long Branch, NJ 07740",
    ],
    "NY": [
        "1 Wall St, New York, NY 10005",
        "100 W 33rd St, New York, NY 10001",  # Penn Station area, inland-ish but in NYC SLR coverage
    ],
    "CT": [
        "1 Long Wharf Dr, New Haven, CT 06511",
    ],
    "RI": [
        "10 Memorial Blvd, Newport, RI 02840",
    ],
    "MA": [
        "1 Long Wharf, Boston, MA 02110",
        "100 Atlantic Ave, Boston, MA 02110",
    ],
    "NH": [
        "100 Marcy St, Portsmouth, NH 03801",
    ],
    "ME": [
        "100 Commercial St, Portland, ME 04101",
    ],
    "CA": [
        "1 Ferry Building, San Francisco, CA 94111",
        "100 Pacific Coast Hwy, Huntington Beach, CA 92648",
    ],
    "OR": [
        "100 NW Naito Pkwy, Portland, OR 97209",  # river, may be inland-mapped
        "100 Broadway St, Seaside, OR 97138",
    ],
    "WA": [
        "100 Alaskan Way, Seattle, WA 98104",
    ],
}


def main() -> None:
    for state, addrs in ADDRESSES_BY_STATE.items():
        print(f"==== {state} ====")
        for a in addrs:
            t0 = time.time()
            r = score_address(a, persist=False)
            dt = time.time() - t0
            if r.error:
                print(f"  {a}  ERR ({dt:.1f}s): {r.error[:60]}")
                continue
            h10 = r.horizons[10]
            h100 = r.horizons[100]
            print(
                f"  {a}  ({dt:.1f}s)\n"
                f"    FEMA={r.fema_zone_normalized:<10} "
                f"NOAA-signal={r.noaa_data_available!s:<5} "
                f"inland={r.is_inland!s:<5} "
                f"10y-comp={h10.composite_absolute:5.1f} "
                f"100y-comp={h100.composite_absolute:5.1f} "
                f"100y-conf={h100.confidence_label}"
            )
        print()


if __name__ == "__main__":
    main()
