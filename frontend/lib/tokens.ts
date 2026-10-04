export type RiskBand = {
  fill: string;
  ink: string;
  soft: string;
  label: "Low" | "Moderate" | "Elevated" | "High" | "Very High";
};

// Band cut points (county percentile). Kept in one place so the scale bar,
// badges, and legend can't drift apart.
export const RISK_BANDS: Array<{ from: number; to: number } & RiskBand> = [
  { from: 0, to: 25, fill: "#5fa8a0", ink: "#0b4640", soft: "#e2f1ef", label: "Low" },
  { from: 25, to: 50, fill: "#e3c15a", ink: "#5a4300", soft: "#fbf3d8", label: "Moderate" },
  { from: 50, to: 70, fill: "#e0914a", ink: "#5c2b00", soft: "#fbebdc", label: "Elevated" },
  { from: 70, to: 88, fill: "#cf5c3c", ink: "#5c1505", soft: "#f9e3dc", label: "High" },
  { from: 88, to: 100, fill: "#9e2a1f", ink: "#6e140c", soft: "#f7e2e0", label: "Very High" },
];

export function riskColor(pct: number): RiskBand {
  // Inclusive upper bounds, so the county median (50th) reads Moderate.
  return RISK_BANDS.find((b) => pct <= b.to) ?? RISK_BANDS[RISK_BANDS.length - 1];
}

export type ConfidenceLevel = "High" | "Medium" | "Low";

export function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Horizon target year, anchored to when the score was computed rather than
// to a hard-coded year, so old reports keep their original labels.
export function horizonYear(scoredAt: string | undefined, horizonYears: number): number {
  const base = scoredAt ? new Date(scoredAt).getFullYear() : new Date().getFullYear();
  return (Number.isFinite(base) ? base : new Date().getFullYear()) + horizonYears;
}

export type HorizonScore = {
  horizon_years: 10 | 30 | 100;
  fema_component: number;
  noaa_component: number;
  composite_absolute: number;
  composite_county_percentile: number;
  composite_national_percentile: number | null;
  confidence_label: ConfidenceLevel;
  confidence_drivers: string[];
  disagreement: number;
};

export type FloodScoreResponse = {
  methodology_version: string;
  scored_at: string;
  input_address: string;
  matched_address: string;
  latitude: number;
  longitude: number;
  county_fips: string;
  county_name: string;
  fema_zone_raw: string | null;
  fema_zone_normalized: string | null;
  fema_map_effective_date: string | null;
  fema_map_age_years: number | null;
  noaa_region_covered: boolean;
  noaa_data_available: boolean;
  is_inland: boolean;
  geocoder_match_is_approximate: boolean;
  horizons: { "10": HorizonScore; "30": HorizonScore; "100": HorizonScore };
  summary_headline: string;
  inland_note: string | null;
  error: string | null;
  score_id: string;
};

export const METHODOLOGY_URL =
  "https://github.com/KylanHuynh7/FloodIQ/blob/main/METHODOLOGY.md";
