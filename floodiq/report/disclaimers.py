"""Section 12 disclaimer text — verbatim, not optional, not to be softened."""

DISCLAIMER_BULLETS = [
    "FloodIQ is a student-built educational tool aggregating public data sources. "
    "It is not professional flood risk assessment, insurance underwriting, legal "
    "advice, or real estate advice.",
    "FEMA flood maps are updated infrequently and may not reflect current "
    "climate conditions. FloodIQ attempts to compensate using NOAA projections, "
    "but is not validated against insurance industry models.",
    "NOAA sea level rise projections are subject to scientific uncertainty and "
    "assume specific climate scenarios. FloodIQ v1 uses NOAA's intermediate "
    "scenario.",
    "Inland flood risk projections are a known limitation in v1 — see Section 9.3 "
    "of the methodology.",
    "Past flood patterns and climate projections do not guarantee future "
    "outcomes for any specific property.",
    "For purchase, insurance, or risk mitigation decisions, consult licensed "
    "professionals.",
]

METHODOLOGY_FOOTER = (
    "FloodIQ Methodology v{version}. Sources: FEMA NFHL, NOAA SLR, "
    "U.S. Census Geocoder. See METHODOLOGY.md for the full specification."
)
