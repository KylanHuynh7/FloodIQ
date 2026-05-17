// Shared tokens, mock data, and atoms — Space Grotesk + JetBrains Mono system.

const FLOOD_DATA = {
  methodology_version: "1.1",
  scored_at: "2026-05-17T14:22:00Z",
  input_address: "123 Main St, Charleston, SC",
  matched_address: "123 MAIN ST, CHARLESTON, SC, 29401",
  latitude: 32.7765,
  longitude: -79.9311,
  county_fips: "45019",
  county_name: "Charleston County, SC",
  fema_zone_raw: "AE",
  fema_zone_normalized: "high_risk_sfha",
  fema_map_effective_date: "2021-01-29",
  fema_map_age_years: 5.3,
  noaa_region_covered: true,
  noaa_data_available: true,
  is_inland: false,
  geocoder_match_is_approximate: false,
  horizons: {
    "10":  { horizon_years: 10,  year_label: "by 2036", fema_component: 72, noaa_component: 30, composite_absolute: 58, composite_county_percentile: 78, composite_national_percentile: 91, confidence_label: "High",   confidence_drivers: [], disagreement: 0.12 },
    "30":  { horizon_years: 30,  year_label: "by 2056", fema_component: 72, noaa_component: 55, composite_absolute: 66, composite_county_percentile: 84, composite_national_percentile: 94, confidence_label: "Medium", confidence_drivers: ["FEMA map > 5 years old"], disagreement: 0.18 },
    "100": { horizon_years: 100, year_label: "by 2125", fema_component: 72, noaa_component: 88, composite_absolute: 82, composite_county_percentile: 93, composite_national_percentile: 98, confidence_label: "Medium", confidence_drivers: ["FEMA map > 5 years old"], disagreement: 0.22 },
  },
  summary_headline: "Higher than 78% of properties in Charleston County over the next 10 years, rising to 93% by 2125.",
  inland_note: null,
  error: null,
  score_id: "abc123def456ghi789",
};

// Risk ramp tuned for cool-beige backgrounds.
// Tan → terracotta → brick. Reads as publication / archival, not alarmist.
function riskColor(pct) {
  if (pct < 25)  return { fill: '#c8d2bd', ink: '#1f3a2a', label: 'Low' };
  if (pct < 50)  return { fill: '#e2c98a', ink: '#5a4516', label: 'Moderate' };
  if (pct < 70)  return { fill: '#d8a070', ink: '#5a2c14', label: 'Elevated' };
  if (pct < 88)  return { fill: '#c87858', ink: '#3a1208', label: 'High' };
  return                  { fill: '#8a3a2a', ink: '#f0ece0', label: 'Very High' };
}

const CONFIDENCE = {
  High:   { dash: 'none',     icon: '●●●', desc: 'High' },
  Medium: { dash: '6 4',      icon: '●●○', desc: 'Medium' },
  Low:    { dash: '2 4',      icon: '●○○', desc: 'Low' },
};

const TOK = {
  ink:        '#0a0a0a',     // pure black for headings/primary actions
  ink2:       '#2a2620',     // near-black with beige undertone
  ink3:       '#5a554a',     // mid stone
  ink4:       '#8a8474',     // muted stone
  paper:      '#ffffff',     // page bg — clean white
  paperAlt:   '#e8e2d0',     // light cream section band (inside cards)
  surface:    '#f0ece0',     // card surface — the cream they like
  surfaceAlt: '#e8e2d0',     // alt cream (eyebrows, caveats)
  line:       '#b8b09c',     // hairline on beige/cream
  lineSoft:   '#d6cfba',     // softer hairline
  rule:       '#0a0a0a',
  accent:     '#0a0a0a',     // black is the accent
  signal:     '#8a3a2a',     // brick — used very sparingly
  sans:       "'Geist', system-ui, sans-serif",
  mono:       "'Geist Mono', ui-monospace, monospace",
};

function fmtPct(n) { return Math.round(n); }
function ordinalSuffix(n) {
  const s = ["th","st","nd","rd"], v = n%100;
  return s[(v-20)%10] || s[v] || s[0];
}

// Confidence badge — uses glyph + text + dashed underline. No color coding.
function ConfBadge({ level, small }) {
  const c = CONFIDENCE[level] || CONFIDENCE.Medium;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: TOK.mono,
      fontSize: small ? 10 : 11, letterSpacing: 0.4,
      textTransform: 'uppercase', color: TOK.ink,
      padding: small ? '2px 6px' : '3px 8px',
      border: `1px solid ${TOK.ink}`,
      borderRadius: 0, background: TOK.surface,
      fontWeight: 500,
    }}>
      <span style={{ letterSpacing: -1, fontSize: small ? 8 : 9 }}>{c.icon}</span>
      <span>{c.desc}</span>
    </span>
  );
}

// Tiny inline icon set
const Icon = {
  Download: (p) => (<svg width={p.s||14} height={p.s||14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v9m0 0l3-3m-3 3L5 8M3 13h10"/></svg>),
  Info:     (p) => (<svg width={p.s||14} height={p.s||14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5"/></svg>),
  Pin:      (p) => (<svg width={p.s||14} height={p.s||14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 14V8.5M8 8.5a3 3 0 100-6 3 3 0 000 6z"/></svg>),
  Warn:     (p) => (<svg width={p.s||14} height={p.s||14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2.5l6 11H2l6-11zM8 7v3M8 11.5v.5"/></svg>),
  Map:      (p) => (<svg width={p.s||14} height={p.s||14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l4-1.5 4 1.5 4-1.5v9.5L10 13.5 6 12 2 13.5V4zM6 2.5v9.5M10 4v9.5"/></svg>),
  Wave:     (p) => (<svg width={p.s||14} height={p.s||14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6c1 0 1 1.5 2 1.5S5 6 6 6s1 1.5 2 1.5S9 6 10 6s1 1.5 2 1.5S13 6 14 6M2 10c1 0 1 1.5 2 1.5S5 10 6 10s1 1.5 2 1.5S9 10 10 10s1 1.5 2 1.5S13 10 14 10"/></svg>),
  Arrow:    (p) => (<svg width={p.s||14} height={p.s||14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10m0 0l-4-4m4 4l-4 4"/></svg>),
};

// Mobile shell — generic; each direction restyles its top chrome.
function MobileShell({ children, label="result", chrome="default", bg }) {
  const dark = chrome === 'dark';
  const pageBg = bg || (chrome === 'editorial' ? TOK.surface : TOK.paper);
  return (
    <div style={{
      width: '100%', height: '100%',
      background: pageBg,
      color: TOK.ink, fontFamily: TOK.sans,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* phone status bar */}
      <div style={{
        height: 28, padding: '6px 18px 4px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        fontFamily: TOK.mono, fontSize: 11,
        color: TOK.ink, fontWeight: 500,
        background: pageBg,
      }}>
        <span>9:41</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: TOK.ink2 }}>
          <span style={{ fontSize: 9 }}>●●●●</span>
          <span style={{ fontSize: 9 }}>WiFi</span>
          <span>100%</span>
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  );
}

Object.assign(window, {
  FLOOD_DATA, riskColor, CONFIDENCE, TOK, fmtPct, ordinalSuffix,
  ConfBadge, Icon, MobileShell,
});
