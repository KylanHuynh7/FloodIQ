# Handoff: FloodIQ — Core Flow (Mobile)

## Overview

FloodIQ is a flood-risk scoring tool for U.S. residential addresses. The user enters an address, the backend scores it against FEMA flood maps and NOAA sea-level projections across three time horizons (10 / 30 / 100 years), and the result page shows county + national percentiles plus a confidence label. This bundle contains the **four-screen core flow** mocked at mobile width (412 px):

1. **Landing** — Address entry, editorial headline, what-you'll-get chips, trust signals.
2. **Loading** — Live elapsed timer + pipeline status timeline; message swaps at 8 s for first-time-in-county lookups.
3. **Result** — Matched address + confirmation map, headline summary, three horizon cards with county-distribution histograms, PDF CTA, source data block. Two variants: *rooftop match* (default) and *approximate match* (warning badge over the pin).
4. **Error** — Address-not-found state with common causes and retry input.

## About the Design Files

The files in this bundle are **design references created in HTML/React** — prototypes showing the intended look and behavior, not production code to copy directly. Your job is to **recreate these designs in the FloodIQ codebase's existing environment** (whatever framework + styling system you're using), following its established patterns and conventions. If no environment exists yet, choose the most appropriate stack for the project (e.g. Next.js + Tailwind, or SwiftUI for native iOS) and implement the designs there.

The JSX in these files leans heavily on inline `style={{ ... }}` objects because they were prototyped in an in-browser Babel environment. **Do not ship inline styles.** Lift the design tokens (see the section below) into your project's theme/token system, then re-express the components using your codebase's conventions (CSS Modules, Tailwind, styled-components, SwiftUI modifiers, etc.).

## Fidelity

**High-fidelity (hifi).** All four screens are pixel-level mockups with final colors, typography, spacing, copy, and interaction shape. The histogram, distribution pin, confidence meter, map tile layout, and pipeline animation are all final design intent. Recreate them pixel-perfectly using your codebase's libraries and patterns.

The map specifically uses live OpenStreetMap (Carto Light) tiles for the comp. In production, **swap the tile URL for Mapbox Static Images API** (or your preferred static-tile provider). The tile-math helper in `map.jsx` (`tilesForLocation`) is generic Web Mercator and works against any XYZ tile source.

---

## Design System / Tokens

All tokens live in `shared.jsx` under the `TOK` object. Lift these verbatim into your theme.

### Colors

| Token | Hex | Usage |
|---|---|---|
| `ink` | `#0a0a0a` | Headings, primary actions, hairlines on cream |
| `ink2` | `#2a2620` | Body text (slight beige undertone) |
| `ink3` | `#5a554a` | Meta/secondary text, mono labels |
| `ink4` | `#8a8474` | Disabled/muted, dim icons |
| `paper` | `#ffffff` | Page background |
| `paperAlt` | `#e8e2d0` | Cream section band inside cards (histogram tray) |
| `surface` | `#f0ece0` | Primary card surface — the warm cream |
| `surfaceAlt` | `#e8e2d0` | Alt cream — eyebrows, caveats |
| `line` | `#b8b09c` | Hairline on beige/cream |
| `lineSoft` | `#d6cfba` | Softer internal divider |
| `signal` | `#8a3a2a` | Brick red — used very sparingly (the "FLOOD-RISK SCORING" eyebrow, error warnings, approximate-match badge) |

### Risk Ramp (publication / archival, not alarmist)

Used for the distribution histogram bars and the "HIGH RISK" pill on each horizon card. Function `riskColor(pct)` in `shared.jsx`:

| Percentile range | Fill | Ink | Label |
|---|---|---|---|
| `< 25` | `#c8d2bd` (sage) | `#1f3a2a` | Low |
| `25–49` | `#e2c98a` (wheat) | `#5a4516` | Moderate |
| `50–69` | `#d8a070` (tan) | `#5a2c14` | Elevated |
| `70–87` | `#c87858` (terracotta) | `#3a1208` | High |
| `≥ 88` | `#8a3a2a` (brick) | `#f0ece0` | Very High |

### Typography

- **Sans:** `Geist` (Google Fonts; weights 300/400/500/600/700). System fallback: `system-ui, sans-serif`.
- **Mono:** `Geist Mono` (Google Fonts; weights 400/500/600/700). System fallback: `ui-monospace, monospace`.

Both are loaded from Google Fonts in `FloodIQ Result Page.html`. Self-host or use your project's font pipeline in production.

#### Type scale (px)

| Use | Family | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|---|
| Editorial headline (Landing/Error) | Geist | 30–32 | 500 | -1.2 to -1.5 | 1.05–1.08 |
| Address (Result header) | Geist | 22 | 500 | -0.6 | 1.15 |
| Address (Loading) | Geist | 19 | 500 | -0.5 | 1.25 |
| Stat numeral (horizon card) | Geist | 54 | 500 | -2 | 0.9 |
| Stat ordinal suffix | Geist | 18 | 500 | -0.4 | — |
| Card body | Geist | 13–14.5 | 400–500 | — | 1.35–1.5 |
| Eyebrow / meta label | Geist Mono | 10 | 600 | 1.4–1.6 | — |
| Tiny mono caption | Geist Mono | 9 | 500–600 | 0.5–1.2 | 1.5 |
| Elapsed timer | Geist Mono | 44 | 600 | -1 | 1 (tabular-nums) |
| Histogram tick labels | Geist Mono | 9 | 400 | 0.5 | — |

All numeric displays use `font-feature-settings: "tnum"` / `font-variant-numeric: tabular-nums`.

### Spacing & shape

- **Border radius: 0 everywhere.** Architectural / civic feel. No rounded corners on cards, inputs, buttons, or badges.
- **Borders:** Cards use `1px solid TOK.ink` (the strong black hairline). Internal dividers inside cards use `1px solid TOK.line` or `lineSoft`. Methodology link uses `1px dashed TOK.line`.
- **Card shadow (horizon cards only):** `4px 4px 0 0 rgba(10,10,10,0.06)` — a soft offset, not a drop shadow. Everything else is flat.
- **Page gutters:** Outer page padding 20 px; card-rail gutter 14 px; in-card padding 14 × 14 px.

### Iconography

Six inline 16×16 stroke icons in `shared.jsx` (`Icon.Download`, `Info`, `Pin`, `Warn`, `Map`, `Wave`, `Arrow`). Stroke width `1.5`, `currentColor`. Swap for your icon library's equivalents (Lucide, Phosphor, Heroicons all have direct matches).

---

## Screens

### 1. Landing (`landing.jsx`)

**Purpose:** Address entry + tool framing.

**Layout (top to bottom, 20 px gutter unless noted):**

- **Masthead row** — `FLOODIQ` (mono 11, ls 1.6) left; `METHOD V1.1` (mono 10, ink3) right.
- **Editorial block** — `FLOOD-RISK SCORING` eyebrow in brick (`TOK.signal`), then 32 px sans headline ("How exposed is your address to flooding — now and through 2125?"), then 14 px supporting paragraph.
- **Search input** — `U.S. STREET ADDRESS` mono label, then a flush input + black "SCORE →" submit (the submit is full-height, mono uppercase, `letterSpacing: 1.2`, with a left border separating it from the input). Disabled until `addr.trim().length > 4`.
- **Helper line** — mono 10, ink3: "Residential addresses only. First lookup in a new county takes ~30 s."
- **What you'll get** — three horizon chips in a flex row, each `+10y / +30y / +100y` (Geist 18, weight 600) with `BY 2036 / BY 2056 / BY 2125` mono sublabels.
- **Trust signals card** — cream-on-white block with `EDUCATIONAL TOOL — NOT INSURANCE` eyebrow and a 3-item bullet list ("Not flood-insurance underwriting" / "Not an official FEMA flood-map reading" / "Not a substitute for professional flood assessment").
- **Methodology link row** — dashed border, "Read the methodology" + "V1.1 · HOW THE SCORE IS BUILT", arrow icon on the right. Clickable.
- **Sources footer** — `SOURCES` mono eyebrow, then "FEMA National Flood Hazard Layer · NOAA Sea Level Rise V2022".

### 2. Loading (`loading.jsx`)

**Purpose:** Show progress transparently while the backend runs the 4-step pipeline. Set expectation for slow first-time-in-county lookups.

**Behavior:**

- Elapsed timer ticks live (`mm:ss`, tabular numerals).
- Pipeline steps derive their state from `elapsed`:
  - `geocodeDone` at 1 s
  - `femaDone` at 4 s
  - `noaaDone` at 7 s
  - `baselineRunning` at 7 s, `baselinePhase` at 8 s
- The status box's message **swaps at 8 s** from "WORKING — Looking up FEMA flood data" to "FIRST LOOKUP IN THIS AREA — Building a county comparison baseline. One-time per county, instant after that. Expect 30 s – 3 min." The 8-second swap is intentional UX: it sets expectation only once we've confirmed the area is uncached.
- Running steps spin (`◐` glyph with a 2.4 s linear `spin` keyframe). Done steps show `✓`. Pending steps show `○` at 0.55 opacity.
- 3-bar indeterminate `BarSpinner` pulses at `1.2 s ease-in-out` with staggered `0.2 s` per bar.

**Layout:**

- Masthead: `FLOODIQ ▸ SCORING`.
- "SCORING ADDRESS" eyebrow + the address (Geist 19, weight 500).
- **Elapsed block:** cream card, grid 1fr/auto. `ELAPSED` eyebrow + the live `mm:ss` numeral (Geist Mono 44, weight 600). Bar spinner on the right.
- **Pipeline card:** cream, `PIPELINE` header with `N / 4` counter, then four `StatusStep` rows.
- **Message box:** state-dependent left border accent (3 px brick when in baseline phase, 3 px ink otherwise) + matching background.
- **Cancel link:** "← Cancel and go back" centered, 1 px solid bottom border.

### 3. Result (`direction-3-distribution.jsx` + `map.jsx`)

**Purpose:** Deliver the score with full provenance.

**Layout:**

- **Header block** (cream surface, ink bottom border): `MATCHED · ROOFTOP` or `MATCHED · APPROXIMATE` eyebrow with pin icon → matched address as `123 Main Street` (Geist 22) → meta line `Charleston, SC 29401 · Charleston County · coastal` (the trailing tag is mono).
- **Confirmation map** (full description below).
- **Headline summary card** — cream surface, soft line border, single sentence: "Higher than **78%** of Charleston County properties over the next 10 years, rising to **93%** by 2125." The two percentages are highlighted with risk-ramp fills (`#d8a070` for the 78, `#c87858` for the 93).
- **Three horizon cards** — see `StatHorizonCard` breakdown below. Rendered for horizons 10, 30, 100.
- **PDF CTA** — full-width black slab button, white text, mono meta ("PDF · 3 PAGES") + arrow on the right.
- **Collapsible "How to read this score"** — `<details>` element, cream surface, ink border.
- **Source data card** — cream surface, `SOURCE DATA / FOR THIS ADDRESS` header with internal hairline, then 4 rows (FEMA NFHL, FEMA map age, NOAA SLR, Geocode). The "FEMA map age" row has its value flagged in brick to indicate a confidence driver.
- **Methodology footer** — mono meta line + disclaimer paragraph.

#### `StatHorizonCard` — the centerpiece

For each horizon, the card has 5 stacked regions:

1. **Eyebrow row** (cream-alt bg, internal hairline below): `01 / 03 · +10 YEARS · BY 2036` mono label left; `ConfMeter` right (three 12×5 px slots, filled = ink, hollow = bordered).
2. **Stat row** (cream bg, 16 px padding): grid `auto 1fr` — left is the giant numeral `78ᵗʰ` (Geist 54, weight 500, letter-spacing -2; ordinal suffix is 18 px ink2 superscript). Right is two-line label "percentile in / Charleston County" plus a risk pill underneath (`HIGH RISK`, mono 10, fill + ink from the risk ramp).
3. **Histogram tray** (`paperAlt` bg, hairlines top and bottom): `▼ THIS ADDRESS / COUNTY DISTRIBUTION` mono header, then the `DistHistogram` SVG.
4. **Footer details row** (cream bg, 3 equal columns): `NATIONAL` percentile, `RAW` /100 score, `CONF.` label.
5. **Caveat row** (only if `confidence_drivers.length > 0`, cream-alt bg, internal hairline): `↘ CAVEAT` mono tag + driver text. Used when FEMA map age > 5 years.

#### `DistHistogram` — county distribution

16 bins, fixed bucket shape `[18, 24, 30, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 11, 8, 5]` (replace with real county data in production). Each bar is colored from the risk ramp based on its bin's midpoint percentile. The bin containing this address's percentile is rendered in `r.ink` (the dark counterpart of its ramp color) with an extra 2.5 px black cap. A black triangle "you-are-here" pin sits above the bar with a dashed dropline (dash pattern varies with confidence: solid / `4 2` / `2 2`). Axis labels mono 9: `SAFER` / `MEDIAN` (with a small tick) / `HIGHER →`.

#### Confirmation Map (`map.jsx`)

- **Tile source (prototype):** Carto Light tiles (`https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`). **Production: swap for Mapbox Static Images or your team's static-tile endpoint.**
- **Tile math:** `tilesForLocation(lat, lon, zoom=12, viewportW, viewportH)` returns the tile list + grid offsets + pin position. Standard Web Mercator. Re-implement using your platform's map SDK if you'd rather use a live map.
- **Viewport:** 240 px tall, full content width (~384 px after 14 px gutters), `1 px solid ink` border.
- **Pin** (`MapPin` component, 34×44 svg): cream outer circle (`#f0ece0`), 2 px black stroke, 5 px black center dot, triangular tail; drop shadow `0 2px 4px rgba(0,0,0,0.35)`.
- **Approximate match badge:** When `approximate={true}`, a banner at top of map (10 px inset all sides): cream bg, `1 px solid signal`, **3 px left signal accent border**, `⚠ APPROX` mono tag in brick + "Approximate location. Verify this matches the property you're researching."
- **Chips (bottom corners):** 
  - Bottom-left: `© OSM · CARTO` attribution. Replace with your tile provider's required attribution.
  - Bottom-right: 18×3 px black scale bar + `~5 KM` label.
  - Both: white 92 %-opacity bg, mono 9, 1 px line border.
- **Subtle bottom vignette:** linear gradient `rgba(255,255,255,0) → rgba(10,10,10,0.04)` over the bottom 25 % so the chips remain legible.
- **Caption below map:** mono 10, ink3: "**PIN SHOWS GEOCODED LOCATION.** Score reflects neighborhood-level flood data, not parcel boundaries."

### 4. Error (`error.jsx`)

**Purpose:** Recover from geocode failure with specific causes and a retry path.

**Layout:**

- Masthead (same as Landing).
- Brick `⚠ ADDRESS NOT FOUND` eyebrow → 30 px Geist headline "We couldn't match that address." → supporting line showing the failed input in a mono inline-code chip ("`456 Nonexistent Way, Atlantis, ZZ` didn't resolve to a U.S. residential address.")
- **Common causes card** (cream, ink border): `COMMON CAUSES` eyebrow + 5 bulleted reasons (apartments + units, PO boxes, commercial properties, non-U.S. addresses, misspellings).
- **Retry input** — same address-input + black SCORE submit as Landing.
- **Back home** — dashed-border row, "← Back to home" + small "FLOODIQ /" trailing mono.
- **Support footer** — mono 10 meta + paragraph.

---

## Interactions & Behavior

| Surface | State | Behavior |
|---|---|---|
| Address input (Landing, Error) | Default | Cream surface, ink border, Geist 15 placeholder |
| SCORE submit | `addr.trim().length <= 4` | `surfaceAlt` bg, `ink3` text, `cursor: not-allowed` |
| SCORE submit | Enabled | `ink` bg, `surface` text, `cursor: pointer` |
| Loading status step | `pending` | 0.55 opacity, `○` glyph |
| Loading status step | `running` | Full opacity, `◐` glyph spinning at 2.4 s linear |
| Loading status step | `done` | Full opacity, `✓` glyph |
| Loading message | `elapsed < 8s` | "WORKING — Looking up FEMA flood data" |
| Loading message | `elapsed ≥ 8s` | "FIRST LOOKUP IN THIS AREA — Building a county comparison baseline…" with brick left accent |
| BarSpinner | Always | 3 bars, `pulse 1.2s ease-in-out` with `0.2 s` stagger |
| How-to-read details | Closed | Show summary row with `+` glyph |
| How-to-read details | Open | Native `<details>` reveal |

No hover states defined in the prototype beyond the default browser button cursor. Add hover/focus states matching your codebase's interaction conventions (e.g. darken the SCORE button to `#1a1a1a` on hover, add a 2 px focus ring for keyboard nav).

---

## State Management

```ts
// Address entry (Landing + Error retry)
addr: string                 // current input value
canSubmit: addr.trim().length > 4

// Loading
elapsed: number              // seconds since scoring began (interval at 1 s)
// derived booleans drive each pipeline step
geocodeDone = elapsed >= 1
femaDone    = elapsed >= 4
noaaDone    = elapsed >= 7
baselineRunning = elapsed >= 7
baselinePhase   = elapsed >= 8   // controls message swap

// Result
data: FloodScoreResponse     // see "Data shape" below
approximate: boolean         // derived from data.geocoder_match_is_approximate
```

In production, derive the loading pipeline state from real backend events (SSE / WebSocket / polling), not a simulated timer. The four steps mirror the actual backend pipeline (geocode → FEMA → NOAA → baseline).

### Data shape

The mock `FLOOD_DATA` in `shared.jsx` is the canonical response shape. Key fields:

```ts
{
  methodology_version: string,
  scored_at: ISO8601,
  input_address: string,
  matched_address: string,
  latitude: number,
  longitude: number,
  county_fips: string,
  county_name: string,
  fema_zone_raw: string,             // e.g. "AE"
  fema_zone_normalized: string,      // e.g. "high_risk_sfha"
  fema_map_effective_date: ISO8601,
  fema_map_age_years: number,
  noaa_region_covered: boolean,
  noaa_data_available: boolean,
  is_inland: boolean,
  geocoder_match_is_approximate: boolean,
  horizons: {
    "10":  HorizonScore,
    "30":  HorizonScore,
    "100": HorizonScore,
  },
  summary_headline: string,
  inland_note: string | null,
  error: string | null,
  score_id: string,
}

type HorizonScore = {
  horizon_years: 10 | 30 | 100,
  year_label: string,              // "by 2036"
  fema_component: number,          // 0-100
  noaa_component: number,          // 0-100
  composite_absolute: number,      // 0-100
  composite_county_percentile: number,    // 0-100
  composite_national_percentile: number,  // 0-100
  confidence_label: 'High' | 'Medium' | 'Low',
  confidence_drivers: string[],    // shown in caveat row
  disagreement: number,            // 0-1
}
```

---

## Assets

- **Fonts:** Geist + Geist Mono from Google Fonts. Self-host in production.
- **Map tiles:** Carto Light via OpenStreetMap (prototype only — see "Confirmation Map" section for swap-out notes and required attribution).
- **Icons:** 7 inline SVG glyphs in `shared.jsx` (`Download`, `Info`, `Pin`, `Warn`, `Map`, `Wave`, `Arrow`). Replace with your icon library.
- **No raster assets.** Everything is HTML/SVG/CSS.

---

## Files in this Bundle

### Screenshots (`screenshots/`)

Flat PNG renders of each screen at native mobile width (412 px). Useful for quick visual reference without spinning up the prototype.

| File | Screen | Dimensions |
|---|---|---|
| `screenshots/01-landing.png` | Landing | 412 × 1200 |
| `screenshots/02-loading.png` | Loading (captured at elapsed ≈ 16 s, showing the "FIRST LOOKUP IN THIS AREA" message-swap state with all preceding pipeline steps complete) | 412 × 1200 |
| `screenshots/03-result-rooftop.png` | Result · rooftop match | 412 × 2000 |
| `screenshots/04-result-approximate.png` | Result · approximate match (shows the `⚠ APPROX` warning badge over the pin) | 412 × 2000 |
| `screenshots/05-error.png` | Error · address not found | 412 × 1100 |

### Source files

| File | What it contains |
|---|---|
| `FloodIQ Result Page.html` | Entry point — loads React, Babel, and all JSX scripts. |
| `app.jsx` | Top-level layout — arranges the 4 screens in a side-by-side design canvas with annotation note. |
| `design-canvas.jsx` | Pan/zoom canvas component used to present the 4 artboards. **Not part of the product UI — presentation chrome only.** |
| `shared.jsx` | Design tokens (`TOK`), mock response (`FLOOD_DATA`), risk-ramp function (`riskColor`), confidence config (`CONFIDENCE`), `ConfBadge`, icon set, `MobileShell`. |
| `landing.jsx` | Landing screen. |
| `loading.jsx` | Loading screen + `StatusStep` + `BarSpinner`. |
| `direction-3-distribution.jsx` | Result screen, `StatHorizonCard`, `DistHistogram`, `ConfMeter`, `StatSourceRow`. |
| `map.jsx` | `ConfirmationMap`, `MapPin`, `tilesForLocation` Web Mercator helper. |
| `error.jsx` | Error screen. |

**To preview the prototype locally:** open `FloodIQ Result Page.html` in a browser (no build step required — Babel transpiles in-browser). You can pan/zoom the canvas and double-click any artboard to view it fullscreen.

---

## Implementation Notes

1. **Drop the inline-style pattern.** Lift `TOK` into your theme system (CSS variables, Tailwind config, or Swift enum), then re-author each component using your codebase's conventions. The structure of each screen and the visual relationships (sizes, gaps, borders) are what matter — not the inline `style={{}}` blobs.
2. **Map provider.** Replace Carto Light tiles with Mapbox Static Images, MapTiler, or your platform's map SDK. The `tilesForLocation` helper is standard Web Mercator and portable, but if you switch to a live/interactive map, you can drop it entirely and let the SDK handle tile layout.
3. **Live pipeline state.** Wire the loading screen's step states to real backend signals. Preserve the **8-second message swap** UX — it's an intentional expectation-setter for first-time-in-county lookups.
4. **Accessibility.** Add proper `aria-label`s on the address input, button states, and pipeline progress. The histogram SVG needs an `aria-label` summarizing the percentile result. The risk pill colors meet AA contrast against the cream surface; verify against your background choices.
5. **Responsive.** The designs are mobile-first at 412 px. For tablet/desktop, the most natural pattern is the same single-column layout centered with a max-width around 480–520 px — this is a "result page" not a dashboard. Do not stretch the cards full-width on desktop.
6. **No rounded corners.** This is a deliberate aesthetic choice — keeps the civic / publication feel. Resist the urge to soften.
