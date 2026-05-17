"""Diversity validation sweep — runs ~150 curated addresses through the
full pipeline and reports aggregate statistics, surfacing anomalies for
methodology review.

Runs with persist=False so the user-facing DB stays clean and no seed
fills are triggered. Five concurrent threads. Expected wall time: 2-3
minutes.

Output: distribution of FEMA zones, confidence labels, errors, plus the
score distribution and any unexpected patterns flagged for review.
"""

from __future__ import annotations

import collections
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from floodiq.pipeline import score_address


# ---- Address roster ---------------------------------------------------------

STATE_CAPITOLS = [
    "100 N Carson St, Carson City, NV 89701",
    "1007 E Grand Ave, Des Moines, IA 50319",
    "1700 W Washington St, Phoenix, AZ 85007",
    "200 E Colfax Ave, Denver, CO 80203",
    "201 E Main St, Frankfort, KY 40601",
    "206 Washington St SW, Atlanta, GA 30334",
    "210 Capitol Ave, Hartford, CT 06106",
    "300 SW 10th Ave, Topeka, KS 66612",
    "303 Walnut St, Des Moines, IA 50309",
    "350 N State St, Salt Lake City, UT 84114",
    "400 S Monroe St, Tallahassee, FL 32301",
    "403 Park Ave, Helena, MT 59601",
    "415 E State Capitol Ave, Pierre, SD 57501",
    "500 E Capitol Ave, Pierre, SD 57501",
    "500 E Capitol St, Jackson, MS 39201",
    "500 E Main St, Richmond, VA 23219",
    "500 Woodlane St, Little Rock, AR 72201",
    "525 W Allegan St, Lansing, MI 48933",
    "600 Dexter Ave, Montgomery, AL 36130",
    "600 E Boulevard Ave, Bismarck, ND 58505",
    "700 Capitol Ave, Frankfort, KY 40601",
    "700 E Broadway, Bismarck, ND 58501",
    "800 N Congress Ave, Austin, TX 78701",
    "900 Court St NE, Salem, OR 97301",
    "900 N 3rd St, Harrisburg, PA 17120",
    "1100 N Congress Ave, Austin, TX 78701",
    "100 Washington St, Boston, MA 02108",
    "115 State St, Montpelier, VT 05633",
    "10 N Senate Ave, Indianapolis, IN 46204",
    "10 State Cir, Annapolis, MD 21401",
    "82 Smith St, Providence, RI 02903",
    "Empire State Plaza, Albany, NY 12224",
    "401 S Carson St, Carson City, NV 89701",
    "320 Sixth Ave N, Nashville, TN 37243",
    "207 W High St, Jefferson City, MO 65101",
    "2 N Charles St, Baltimore, MD 21201",
    "200 W 24th St, Cheyenne, WY 82002",
    "401 N Main St, Columbia, SC 29201",
    "1 N Pearl St, Albany, NY 12207",
    "1445 K St, Sacramento, CA 95814",
    "1 W Wilson St, Madison, WI 53703",
    "2 Capitol Hill, Providence, RI 02908",
    "210 N State St, Olympia, WA 98501",
    "1900 Kanawha Blvd E, Charleston, WV 25305",
    "1313 N Market St, Wilmington, DE 19801",
    "60 Washington St, Hartford, CT 06106",
    "411 W Ottawa St, Lansing, MI 48933",
    "75 Rev Dr Martin Luther King Jr Blvd, St Paul, MN 55155",
    "490 Old Santa Fe Trail, Santa Fe, NM 87501",
    "301 W Jefferson St, Phoenix, AZ 85003",
    "100 Constitution Ave, Augusta, ME 04330",
    "1 Constitution Plaza, Concord, NH 03301",
    "125 State St, Trenton, NJ 08625",
    "1 Capitol Square, Springfield, IL 62701",
    "1 N State Capitol Ave, Lincoln, NE 68508",
    "1500 Capitol Ave, Sacramento, CA 95814",
    "1100 L St NW, Washington, DC 20005",
    "401 N Carson St, Carson City, NV 89701",
    "2300 N Lincoln Blvd, Oklahoma City, OK 73105",
    "900 N 3rd St, Baton Rouge, LA 70802",
    "1 Capitol Hill, Providence, RI 02908",
    "203 N Carson St, Carson City, NV 89701",
    "201 W Capitol Ave, Little Rock, AR 72201",
    "16 Francis St, Annapolis, MD 21401",
    "120 State St, Boise, ID 83702",
    "700 N Carson St, Carson City, NV 89701",
    "1 W Capitol Ave, Bismarck, ND 58501",
    "401 S Main St, Springfield, IL 62701",
    "631 Park Ave, Helena, MT 59601",
]

COASTAL_FLOOD_PRONE = [
    "1100 Collins Ave, Miami Beach, FL 33139",
    "2100 Collins Ave, Miami Beach, FL 33139",
    "100 Ocean Dr, Miami Beach, FL 33139",
    "2200 Seawall Blvd, Galveston, TX 77550",
    "3402 Seawall Blvd, Galveston, TX 77550",
    "100 N Lumina Ave, Wrightsville Beach, NC 28480",
    "200 S Lumina Ave, Wrightsville Beach, NC 28480",
    "100 East Bay St, Charleston, SC 29401",
    "100 Meeting St, Charleston, SC 29401",
    "1 S Beach Blvd, Atlantic City, NJ 08401",
    "100 Boardwalk, Atlantic City, NJ 08401",
    "300 Atlantic Ave, Virginia Beach, VA 23451",
    "100 24th St, Virginia Beach, VA 23451",
    "1 Liberty Plaza, Brooklyn, NY 11201",
    "100 Front St, Brooklyn, NY 11201",
    "1 Wall St, New York, NY 10005",
    "10 Bay St, Hilton Head Island, SC 29928",
    "1 Sandlapper Ct, Hilton Head Island, SC 29928",
    "100 Beach Rd, Sarasota, FL 34242",
    "100 Ocean Blvd, Myrtle Beach, SC 29577",
    "1100 N Ocean Blvd, Myrtle Beach, SC 29577",
    "100 Bay Ave, Ocean City, NJ 08226",
    "1 Boardwalk, Ocean City, NJ 08226",
    "100 Atlantic Ave, Long Branch, NJ 07740",
    "1 Beach Rd, Tybee Island, GA 31328",
    "100 Tybrisa St, Tybee Island, GA 31328",
    "1 Beach St, Daytona Beach, FL 32114",
    "100 N Ocean Blvd, Daytona Beach, FL 32118",
    "1 Bayshore Blvd, Tampa, FL 33606",
    "100 N Tampa St, Tampa, FL 33602",
]

RIVERINE_FLOOD_PRONE = [
    "200 W River Dr, Davenport, IA 52801",
    "100 1st St SE, Cedar Rapids, IA 52401",
    "200 N 3rd St, Grand Forks, ND 58203",
    "100 Riverfront Pkwy, Chattanooga, TN 37402",
    "100 Riverside Dr, Memphis, TN 38103",
    "200 Riverside Dr, Memphis, TN 38103",
    "1 N Front St, Memphis, TN 38103",
    "100 N Front St, St Louis, MO 63102",
    "200 N Broadway, St Louis, MO 63102",
    "100 N Front St, Wilmington, NC 28401",
    "100 Riverwalk, Tulsa, OK 74103",
    "100 Riverside Dr, Tulsa, OK 74103",
    "100 Decatur St, New Orleans, LA 70130",
    "200 Decatur St, New Orleans, LA 70130",
    "1 Canal St, New Orleans, LA 70130",
    "1 N Riverfront St, Hannibal, MO 63401",
    "100 N Main St, Hannibal, MO 63401",
    "100 Riverwalk Dr, Sacramento, CA 95814",
    "100 Mississippi River Dr, La Crosse, WI 54601",
    "100 N Front St, Marietta, OH 45750",
    "1 Riverside Plaza, Cincinnati, OH 45202",
    "100 W Mehring Way, Cincinnati, OH 45202",
    "100 Riverfront Dr, Louisville, KY 40202",
    "100 Riverside Dr, Jacksonville, FL 32202",
    "100 Wharf St, Portland, ME 04101",
    "100 Commercial St, Portland, ME 04101",
    "100 Front St, Natchez, MS 39120",
    "1 Casino Center Blvd, Tunica Resorts, MS 38664",
    "100 Riverside Dr, Wichita, KS 67203",
    "200 N Main St, Vicksburg, MS 39180",
]

EDGE_CASES = [
    # Famous addresses Census + FEMA both know well.
    "1600 Pennsylvania Ave NW, Washington, DC 20500",
    "11 Wall St, New York, NY 10005",
    "1 Apple Park Way, Cupertino, CA 95014",
    "350 5th Ave, New York, NY 10118",  # Empire State
    "1060 W Addison St, Chicago, IL 60613",  # Wrigley
    # Inland-but-flood-prone (might or might not be in SFHA depending on map).
    "100 Main St, Anywhere, KS 66101",
    # Rural addresses that may or may not be mapped.
    "1234 County Road 100, Marfa, TX 79843",
    "100 Main St, Lostine, OR 97857",
    # A non-CONUS address — should hit Section 9.4.
    "1 Aloha Tower Dr, Honolulu, HI 96813",
    # Typically ambiguous / not present in TIGER — exercises OSM fallback.
    "1 The Lane, Nowhere, MT 59000",
    # Tribal land — historically prone to be unmapped.
    "100 Indian Route 12, Window Rock, AZ 86515",
    # Brand-new development (may not yet be mapped).
    "100 Innovation Way, The Woodlands, TX 77380",
    "100 Sun City Blvd, Sun City, AZ 85351",
    "100 N Main St, Mountain View, CA 94040",
    "100 Universal City Plaza, Universal City, CA 91608",
]

ADDRESSES = STATE_CAPITOLS + COASTAL_FLOOD_PRONE + RIVERINE_FLOOD_PRONE + EDGE_CASES


# ---- Runner ----------------------------------------------------------------

def score_one(address: str):
    t0 = time.monotonic()
    try:
        r = score_address(address, persist=False)
        return address, r, time.monotonic() - t0, None
    except Exception as e:
        return address, None, time.monotonic() - t0, repr(e)


def main() -> None:
    print(f"Running {len(ADDRESSES)} addresses with 5 concurrent workers...\n")
    t_start = time.monotonic()
    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(score_one, a) for a in ADDRESSES]
        for i, fut in enumerate(as_completed(futures), 1):
            results.append(fut.result())
            if i % 25 == 0 or i == len(ADDRESSES):
                print(f"  ...{i}/{len(ADDRESSES)} done "
                      f"({time.monotonic() - t_start:.0f}s elapsed)")
    total_sec = time.monotonic() - t_start
    print(f"\nFinished {len(results)} addresses in {total_sec:.1f}s "
          f"({total_sec/len(results):.2f}s avg).\n")

    summarize(results)


def summarize(results):
    zones = collections.Counter()
    confs = collections.Counter()
    errors = collections.Counter()
    inland_count = 0
    approx_geocode_count = 0
    osm_fallback_count = 0  # approximate=True with OSM-style match (verbose)
    disagreements = 0
    durations = []
    score_abs_10y = []
    score_abs_100y = []

    for address, r, dt, exc in results:
        durations.append(dt)
        if exc is not None:
            errors[f"exception: {exc[:60]}"] += 1
            continue
        if r.error:
            errors[r.error[:80]] += 1
            continue
        zones[r.fema_zone_normalized or "n/a"] += 1
        for h in (10, 30, 100):
            confs[(h, r.horizons[h].confidence_label)] += 1
            if r.horizons[h].disagreement:
                disagreements += 1
        if r.is_inland:
            inland_count += 1
        if r.geocoder_match_is_approximate:
            approx_geocode_count += 1
            if len(r.matched_address) > 50:
                osm_fallback_count += 1
        score_abs_10y.append(r.horizons[10].composite_absolute)
        score_abs_100y.append(r.horizons[100].composite_absolute)

    successes = sum(1 for r in results if r[1] and not r[1].error)
    print(f"==== Aggregate ====")
    print(f"Successes: {successes}/{len(results)}  "
          f"errors: {len(results) - successes}")
    print(f"Inland: {inland_count}  Approx-geocode: {approx_geocode_count} "
          f"(OSM-fallback: {osm_fallback_count})  Disagreements (any horizon): {disagreements}")

    print(f"\n==== FEMA zones encountered ====")
    for z, n in zones.most_common():
        print(f"  {z:<14} {n:>4}")

    print(f"\n==== Confidence label by horizon ====")
    for h in (10, 30, 100):
        line = "  " + f"{h:>3}y:"
        for label in ("High", "Medium", "Low"):
            line += f"  {label}={confs.get((h, label), 0):>3}"
        print(line)

    if score_abs_10y:
        print(f"\n==== Absolute score distribution ====")
        for label, vals in [("10y", score_abs_10y), ("100y", score_abs_100y)]:
            vals = sorted(vals)
            n = len(vals)
            p = lambda q: vals[max(0, min(n - 1, int(q * (n - 1))))]
            print(f"  {label}: min={p(0):.1f}  p25={p(0.25):.1f}  "
                  f"median={p(0.5):.1f}  p75={p(0.75):.1f}  max={p(1.0):.1f}  "
                  f"mean={statistics.mean(vals):.1f}")

    if durations:
        durations.sort()
        print(f"\n==== Response time (seconds) ====")
        n = len(durations)
        p = lambda q: durations[max(0, min(n - 1, int(q * (n - 1))))]
        print(f"  min={p(0):.2f}  p50={p(0.5):.2f}  p90={p(0.9):.2f}  "
              f"p99={p(0.99):.2f}  max={p(1.0):.2f}")

    if errors:
        print(f"\n==== Errors ====")
        for msg, n in errors.most_common(15):
            print(f"  {n:>3}x  {msg}")

    # Surface anomalies for methodology review.
    print(f"\n==== Anomalies flagged for review ====")
    flagged = 0
    for address, r, dt, exc in results:
        if not r or r.error:
            continue
        # An AE/VE/A property that came back Low because of disagreement
        # might be the very edge case Section 8 handles — log a few.
        if r.fema_zone_normalized in {"AE", "VE", "A"}:
            if all(r.horizons[h].confidence_label == "Low" for h in (10, 30)):
                flagged += 1
                if flagged <= 5:
                    print(f"  [{r.fema_zone_normalized}+Low] {address}")
                    print(f"     map age={r.fema_map_age_years:.1f}y  "
                          f"approx={r.geocoder_match_is_approximate}  "
                          f"inland={r.is_inland}  "
                          f"disagreement(10y)={r.horizons[10].disagreement}")
    if flagged == 0:
        print("  none")
    elif flagged > 5:
        print(f"  ...and {flagged - 5} more similar cases")


if __name__ == "__main__":
    main()
