# FloodIQ — Methodology

> **Status:** v1 specification. This document defines what FloodIQ's score means, how it is calculated, and what its known limitations are. It is the source of truth for implementation. Where this document and code disagree, the code must change.

> **Audience:** Two readers. First, the developer (or AI assistant) implementing FloodIQ. Second, the buyer using FloodIQ — they should be able to read this and understand exactly what the score they're getting represents and how it was produced. If a section is written in a way only one of those two audiences could follow, it needs to be rewritten.

---

## 1. What FloodIQ's Score Represents

**Definition:**

> FloodIQ scores the relative likelihood of a property experiencing a federally-declared flood disaster event or an NFIP insurance claim exceeding $25,000, compared to the county median, across three time horizons (10-year, 30-year, 100-year).

**Plain-language version (for the buyer-facing PDF and web app):**

> The FloodIQ score tells you how this property's flood risk compares to other properties in the same county, based on public data from FEMA and NOAA. A score of 50 means roughly average for the county. A score of 80 means substantially higher risk than the county median. A score of 20 means substantially lower. The score is calculated for three timeframes — 10 years, 30 years, and 100 years — because flood risk changes over time as sea levels rise and flood patterns shift.

**What the score is not:**

- Not an absolute probability of flooding.
- Not a substitute for a professional flood risk assessment, elevation certificate, or insurance underwriting decision.
- Not validated against insurance industry models.
- Not a prediction of damage cost — only of relative likelihood.

---

## 2. Time Horizons

FloodIQ outputs three scores per property, one for each horizon:

- **10-year horizon** — near-term risk, dominated by current flood patterns.
- **30-year horizon** — mortgage-length risk, where current patterns and climate projections begin to balance.
- **100-year horizon** — long-term risk, dominated by climate projections.

All three are shown together on both the web app and the PDF. The buyer does not toggle between them — they see the trajectory of risk over time. This is intentional. A single horizon hides whether risk is stable, rising, or accelerating.

---

## 3. Data Sources

FloodIQ aggregates two public data sources for v1.

### 3.1 FEMA — National Flood Hazard Layer (NFHL)

- **What it provides:** Flood zone designation (categorical: VE, AE, A, AH, AO, X-shaded, X-unshaded, undetermined), Base Flood Elevation where established, and map effective date.
- **Why we use it:** Authoritative federal designation of current flood risk, broadly accepted by insurers and mortgage lenders.
- **Known limitation:** FEMA maps are updated infrequently. Many areas have maps that are 10–20+ years old and do not reflect current climate conditions. Map age is incorporated into the confidence calculation.
- **Access method:** Public API (FEMA's NFHL REST service), queried by lat/long.

### 3.2 NOAA — Sea Level Rise Inundation Projections

- **What it provides:** Projected inundation depth (in feet) at a given location for specified future years, derived from NOAA's 2022 sea level rise technical report and supporting datasets.
- **Why we use it:** Forward-looking, climate-model-based projections that compensate for FEMA's historical orientation.
- **Known limitation:** Sea level rise inundation is a **coastal-only signal**. Inland properties receive a NOAA score of 0, meaning their composite score is FEMA-driven across all horizons. This limitation is explicitly disclosed to users.
- **Access method:** NOAA publishes the depth rasters as Cloud Optimized GeoTIFFs (COGs) at `coast.noaa.gov/slrdata/`. FloodIQ reads these remotely via HTTP range requests using rasterio, so no bulk download is required. Per-state coverage is described in the implementation; v1 covers all CONUS coastal states (FL, SC, LA, TX, MS, AL, GA, NC, VA, MD, DE, NJ, NY, CT, RI, MA, NH, ME, CA, OR, WA). The Washington Pacific Coast outer shore is listed by NOAA but the rasters are 404 as of v1.0.
- **Neighborhood sampling:** A geocoded address point can land on an elevated building footprint while the surrounding street floods; querying a single 3-meter raster cell would systematically under-report risk for those properties. FloodIQ samples a 21x21 cell neighborhood (~63m, roughly a city block) and takes the maximum non-open-water inundation depth — methodologically closer to the buyer-meaningful question "does projected flooding reach my property." Cells encoding existing open water (depth > 15m) are filtered out so ocean/bay surfaces don't masquerade as flooded land.
- **Per-state grid:** NOAA publishes the rasters on two different SLR-amount grids. Florida and four Northeast states (CT, RI, MA, NH) provide 0.5-ft increments from 0 through 10 ft. Other coastal states publish only odd half-foot increments (0.5, 1.5, ..., 9.5). FloodIQ snaps the interpolated horizon-target SLR to the nearest published value for the matched state, breaking ties in favor of the higher depth (buyer-protective).

### 3.3 Geocoding

Property addresses are converted to latitude/longitude using the **U.S. Census Bureau Geocoder** (free, public). Geocoder match confidence is captured and used in the confidence calculation.

---

## 4. Normalization

Both sources must produce values on a comparable 0–100 scale before they can be combined.

### 4.1 FEMA Zone → 0–100 Mapping

FEMA flood zones are categorical, not numeric. FloodIQ uses a documented risk-tier mapping based on FEMA's own descriptions of zone risk and NFIP flood insurance requirements:

| FEMA Zone | Description | FloodIQ Component Score |
|-----------|-------------|-------------------------|
| VE | Coastal high-velocity flood, 1% annual chance | 90 |
| AE | 1% annual chance flood, established BFE | 75 |
| A | 1% annual chance flood, no BFE established | 65 |
| AH | Shallow flooding (1–3 ft), 1% annual chance | 55 |
| AO | Shallow sheet flow flooding | 50 |
| X (shaded) | 0.2% annual chance flood (500-year) | 30 |
| X (unshaded) | Minimal flood hazard | 10 |
| Undetermined / Unmapped | See edge case handling | n/a |

**These numbers are methodology judgment calls.** They are not provided by FEMA. The author's reasoning: VE zones carry mandatory insurance and coastal velocity hazard, justifying the highest score; AE/A differ primarily in whether elevation has been formally established, with AE scoring higher because the data is more reliable; X-shaded reflects real but lower-frequency risk; X-unshaded reflects minimal but nonzero risk. The mapping is open to revision in future versions as user feedback and validation data accumulate.

### 4.2 NOAA Sea Level Rise → 0–100 Mapping

NOAA projected inundation depth (in feet) is normalized as follows:

| Projected Inundation at Horizon | FloodIQ Component Score |
|----------------------------------|-------------------------|
| 0 feet (no projected inundation) | 0 |
| 0.1 – 1.0 feet | 25 |
| 1.0 – 2.0 feet | 50 |
| 2.0 – 3.0 feet | 75 |
| 3.0+ feet | 100 |

Stepped rather than continuous mapping because NOAA projections themselves have meaningful uncertainty; over-precise interpolation implies confidence the underlying data does not support.

For inland properties (no NOAA inundation projection available), the NOAA component is 0 for all horizons. This is treated as a known limitation, not missing data — see Section 7 (Edge Cases).

---

## 5. Combination — Horizon-Weighted Aggregation

The composite score for each horizon is a weighted average of the normalized FEMA and NOAA component scores:

| Horizon | FEMA Weight | NOAA Weight |
|---------|-------------|-------------|
| 10-year | 100% | 0% |
| 30-year | 70% | 30% |
| 100-year | 30% | 70% |

**Composite Score Formula:**

```
composite_score(horizon) = (FEMA_weight × FEMA_normalized) + (NOAA_weight × NOAA_normalized)
```

**Why these weights:**

- **FEMA dominates the 10-year horizon** because FEMA flood maps are calibrated against historical flood patterns within the past several decades, making them the strongest signal for near-term risk.
- **NOAA dominates the 100-year horizon** because climate-driven sea level rise becomes the primary driver of long-term coastal flood risk, and FEMA's historical calibration becomes less relevant at centennial timescales.
- **30-year horizon balances both** because it overlaps the period where both historical patterns and climate trajectory are meaningful contributors. The 70/30 split toward FEMA reflects that 30 years is still within the lifetime of current flood patterns, though climate effects are no longer negligible.

The specific weights are methodology judgment calls. They are documented here and subject to revision as validation data accumulates.

---

## 6. Baseline — Relative to County Median

FloodIQ's score is not an absolute risk number — it is **relative to the county median**.

**Why county-level:**

- National median is too coarse: every coastal property scores extremely high relative to inland Kansas, obscuring useful intra-region variation.
- State median is too noisy: state lines are arbitrary for flood risk and produce strange comparisons.
- ZIP code is too sparse: many ZIP codes lack enough scored properties for a stable baseline.
- County strikes the balance: large enough for meaningful variance, small enough to be locally relevant.

**Implementation:**

For each county, compute the median composite score across a reference set of addresses. The user-facing score is the property's percentile rank within the county distribution, normalized to 0–100, where 50 represents the county median.

Secondary display: alongside the county-relative score, the PDF also shows a national-relative score for context. The web app shows only the county-relative number to avoid overwhelming the user.

**Reference set:**

The reference set used to compute county medians is the set of addresses for which FloodIQ has scored — supplemented at v1 launch with a seed set of sampled addresses per county to ensure the median is stable from day one. Reference set composition is documented in a public methodology log.

---

## 7. Confidence Calculation

Every FloodIQ score is accompanied by a confidence label: **High**, **Medium**, or **Low**. The label is computed independently of the score and reflects how much trust the buyer should place in the number.

### 7.1 Confidence Drivers

The following factors reduce confidence:

| Factor | Effect on Confidence |
|--------|----------------------|
| FEMA map for the area is more than 10 years old | Reduces by one tier |
| FEMA map for the area is more than 20 years old | Reduces by two tiers |
| FEMA and NOAA components disagree significantly (see Section 8) | Forces to Low |
| Property is inland (NOAA component is 0), 100-year horizon | Reduces by one tier |
| Geocoder match confidence is low (e.g., approximate match) | Reduces by one tier |
| FEMA zone is undetermined or unmapped | Score is not returned at all — see Section 9 |

### 7.2 Confidence Tiers

Starting tier is **High**. Each qualifying factor reduces by the specified number of tiers. Floor is **Low**.

### 7.3 Display

- **Web app:** Score is shown as a number with a confidence label (e.g., "Score: 65 — Medium confidence").
- **PDF (page 2):** Per-component breakdown is shown — FEMA component score, FEMA map age, NOAA component score, source agreement status, and which factors contributed to the confidence tier.

This split is deliberate: the web score is digestible for the casual user, the PDF is transparent for the engaged user.

---

## 8. Source Disagreement Handling

When FEMA and NOAA components disagree significantly, this is itself a meaningful signal — typically indicating a coastal property whose FEMA map predates current climate projections.

**Implementation:**

- The composite score is still computed using the horizon weights from Section 5.
- A **disagreement flag** is computed separately, **only for properties with a NOAA signal available** (i.e., the local NOAA SLR dataset returned a projection for at least one horizon at this location). For inland properties without NOAA coverage, the FEMA component is the sole driver and the disagreement flag is not applicable — Section 9.3's inland confidence penalty still applies.
- When the property has a NOAA signal: if `|FEMA_normalized − NOAA_normalized| > 30`, the sources are considered to be in significant disagreement.
- When the disagreement flag is set, **confidence is forced to Low** regardless of other factors.
- The PDF source breakdown (page 2) explicitly notes the disagreement (or its non-applicability, in the inland case) and explains its likely cause to the user.

**Why the inland carve-out:** A NOAA component of 0 has two distinct meanings — "NOAA projects no inundation at this coastal point" (real signal) and "no NOAA dataset coverage for this inland location" (absence of signal). Treating absence-of-signal as disagreement would force every inland property in a real FEMA flood zone (AE, A, VE, etc.) to Low confidence, which inverts the meaning of the label: those are precisely the inland properties where FEMA's signal is strongest. Disagreement is reserved for the case it was designed for — a coastal property whose two available sources point in different directions.

**Why this approach:**

Averaging disagreement into the composite score without flagging it hides the most actionable signal the methodology produces. Surfacing disagreement matches FloodIQ's transparency principle: the buyer learns not just "your score is X," but "your sources don't agree — here's what that means."

---

## 9. Edge Case Handling

### 9.1 FEMA Zone is Undetermined or Unmapped

**Behavior:** FloodIQ returns no score. The user-facing message is:

> "FloodIQ does not have sufficient public data to score this address. This typically occurs for addresses in unmapped rural areas or recent annexations. We recommend consulting your local floodplain administrator."

Inventing a score from county-level or interpolated data would imply precision the data does not support.

### 9.2 Imprecise Geocoding

**Behavior:** FloodIQ accepts the geocoder's best match, flags confidence as Low (via Section 7.1), and includes the matched coordinates in the PDF so the user can verify.

The user is not blocked from receiving a score, but is explicitly informed that the address match is approximate.

### 9.3 Inland Properties

**Behavior:** NOAA component is 0 across all horizons. Composite scores are effectively FEMA-driven (with the horizon weights still applied — the NOAA contribution is just zero). Confidence is reduced by one tier for the 100-year horizon, reflecting the missing forward-looking signal.

The PDF includes the note:

> "This property is inland and does not face coastal sea level rise risk. The 100-year projection is based on FEMA flood zone data only, which reflects historical patterns and may not capture changing inland flood risks from increased precipitation. This is a known limitation of FloodIQ v1."

### 9.4 Addresses Outside the Continental United States

**Behavior:** v1 supports continental US only. US territories (Puerto Rico, USVI, Guam, etc.) and addresses outside the US return:

> "FloodIQ v1 supports addresses in the continental United States only. Support for US territories is planned for a future version."

### 9.5 New Construction

**Behavior:** No special handling. FEMA zone designation is location-based, not building-age-based, so the lookup proceeds normally. The methodology does not account for property-specific factors such as elevation modifications, flood-resistant construction, or post-mapping mitigation work. This is documented in the limitations section of the PDF.

---

## 10. Output Specifications

### 10.1 Web App Output (per address query)

- **Three composite scores**, one per horizon (10/30/100-year), each on a 0–100 scale relative to county median.
- **One confidence label** per horizon (High / Medium / Low).
- **A summary headline finding** in plain language (e.g., "Elevated long-term flood risk; sources disagree on near-term risk").
- **A "download PDF report" button.**

### 10.2 PDF Report (3 pages)

- **Page 1 — Headline:** Address, all three horizon scores with confidence labels, plain-language summary, recommended action.
- **Page 2 — Source Breakdown:** FEMA component (zone, map age, score), NOAA component (projected inundation, score), agreement/disagreement status, per-factor confidence drivers.
- **Page 3 — Buyer Talking Points:** Three specific questions for the insurer, three for the seller/listing agent, what to ask about (elevation certificates, flood insurance requirements, historical claims).
- **Footer on every page:** Methodology link (URL to this document), source citations with retrieval dates, full disclaimer text.

---

## 11. Reproducibility

Given the same address, the same source data snapshot, and the same methodology version, FloodIQ must produce the same score every time. To support this:

- All source data pulls are cached locally with retrieval timestamps.
- Methodology version is included in every PDF and stored alongside every cached score.
- When source data is refreshed, prior scores are not silently overwritten — historical scores remain accessible with their original methodology version.

---

## 12. Limitations and Disclaimers

These must appear prominently on the web app and PDF. They are not optional.

- FloodIQ is a student-built educational tool aggregating public data sources. It is not professional flood risk assessment, insurance underwriting, legal advice, or real estate advice.
- FEMA flood maps are updated infrequently and may not reflect current climate conditions. FloodIQ attempts to compensate using NOAA projections, but is not validated against insurance industry models.
- NOAA sea level rise projections are subject to scientific uncertainty and assume specific climate scenarios. FloodIQ v1 uses NOAA's intermediate scenario.
- Inland flood risk projections are a known limitation in v1 — see Section 9.3.
- Past flood patterns and climate projections do not guarantee future outcomes for any specific property.
- For purchase, insurance, or risk mitigation decisions, consult licensed professionals.

---

## 13. Versioning

This document is **FloodIQ Methodology v1.1**. Material changes (new sources, changed weights, changed normalization tables) increment the version. Editorial changes (clarifying language, fixing typos) do not.

Every PDF generated by FloodIQ embeds the methodology version it was scored under. This protects users from silent methodology drift.

### Version history

- **v1.0** — Initial methodology. NOAA SLR was a stub returning no data; all properties scored FEMA-only.
- **v1.1** — NOAA SLR integration completed. Reads NOAA SLR Viewer COGs over HTTP for all CONUS coastal states (FL, SC, LA, TX, MS, AL, GA, NC, VA, MD, DE, NJ, NY, CT, RI, MA, NH, ME, CA, OR, WA). Section 8 amended to skip the disagreement check when the property has no NOAA signal (inland carve-out). 21-cell neighborhood sampling, per-state SLR-amount grid, open-water cell filtering. Seed-set composite scores from v1.0 are invalidated by the version bump and must be regenerated on first query per county.

---

## 14. Implementation Notes for Claude Code

This section is for the AI assistant implementing FloodIQ. It is not part of the user-facing methodology.

- **Do not invent weights, thresholds, or mappings that are not specified in this document.** If a value is needed and not specified, surface the question for human decision rather than picking a default.
- **The numerical tables in Sections 4 and 5 are authoritative.** Do not "improve" them without explicit human approval.
- **Confidence calculation must be implemented as specified in Section 7.** It is not a freeform heuristic.
- **Edge case behavior in Section 9 is mandatory.** All edge cases must be handled as specified, including the explicit user-facing language.
- **The disclaimer text in Section 12 must appear on the web app and PDF.** It is not optional, and its wording is not to be softened.
- **Reproducibility (Section 11) is a hard requirement.** All scoring functions must be deterministic given the same inputs and methodology version.
- When in doubt about whether something is a methodology decision (requires human input) vs. an implementation decision (Claude Code can choose), default to surfacing it for human review. Methodology integrity is more important than implementation speed.
- **Do not commit anything to the git repository.** Do not run `git add`, `git commit`, `git push`, or any other git command that modifies repository state. Staging, committing, and pushing are reserved for the human developer, who will review changes before any code enters version control. If git operations seem necessary to complete a task, surface the question rather than acting.
