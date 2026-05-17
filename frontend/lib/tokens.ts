export type RiskBand = {
  fill: string;
  ink: string;
  label: "Low" | "Moderate" | "Elevated" | "High" | "Very High";
};

export function riskColor(pct: number): RiskBand {
  if (pct < 25) return { fill: "#c8d2bd", ink: "#1f3a2a", label: "Low" };
  if (pct < 50) return { fill: "#e2c98a", ink: "#5a4516", label: "Moderate" };
  if (pct < 70) return { fill: "#d8a070", ink: "#5a2c14", label: "Elevated" };
  if (pct < 88) return { fill: "#c87858", ink: "#3a1208", label: "High" };
  return { fill: "#8a3a2a", ink: "#f0ece0", label: "Very High" };
}

export type ConfidenceLevel = "High" | "Medium" | "Low";

export const CONFIDENCE: Record<
  ConfidenceLevel,
  { dash: string; icon: string; desc: ConfidenceLevel }
> = {
  High: { dash: "none", icon: "●●●", desc: "High" },
  Medium: { dash: "6 4", icon: "●●○", desc: "Medium" },
  Low: { dash: "2 4", icon: "●○○", desc: "Low" },
};

export function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export type HorizonScore = {
  horizon_years: 10 | 30 | 100;
  year_label: string;
  fema_component: number;
  noaa_component: number;
  composite_absolute: number;
  composite_county_percentile: number;
  composite_national_percentile: number;
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
  fema_zone_raw: string;
  fema_zone_normalized: string;
  fema_map_effective_date: string;
  fema_map_age_years: number;
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
