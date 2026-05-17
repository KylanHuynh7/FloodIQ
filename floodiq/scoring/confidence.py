"""Confidence calculation from METHODOLOGY.md Section 7 and Section 8.

Confidence is computed independently of the score itself. Starting tier is
High; each qualifying factor reduces by N tiers; floor is Low. Disagreement
(Section 8) forces Low regardless of other factors.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum


class ConfidenceTier(IntEnum):
    LOW = 0
    MEDIUM = 1
    HIGH = 2

    @property
    def label(self) -> str:
        return self.name.title()


# Section 8: significant disagreement threshold.
DISAGREEMENT_THRESHOLD = 30


@dataclass
class ConfidenceInputs:
    fema_map_age_years: float | None
    fema_normalized: int
    noaa_normalized: int
    # True iff the local NOAA SLR dataset returned a projection for this
    # location at any horizon. Per Section 8 the disagreement check is
    # only evaluated when this is True — see the "inland carve-out".
    noaa_signal_available: bool
    is_inland: bool
    horizon_years: int
    geocoder_match_is_approximate: bool


@dataclass
class ConfidenceResult:
    tier: ConfidenceTier
    drivers: list[str] = field(default_factory=list)
    disagreement: bool = False

    @property
    def label(self) -> str:
        return self.tier.label


def disagreement_flag(fema_normalized: int, noaa_normalized: int) -> bool:
    return abs(fema_normalized - noaa_normalized) > DISAGREEMENT_THRESHOLD


def compute_confidence(inputs: ConfidenceInputs) -> ConfidenceResult:
    tier = ConfidenceTier.HIGH
    drivers: list[str] = []

    age = inputs.fema_map_age_years
    if age is not None:
        if age > 20:
            tier = _reduce(tier, 2)
            drivers.append("FEMA map is more than 20 years old (-2 tiers)")
        elif age > 10:
            tier = _reduce(tier, 1)
            drivers.append("FEMA map is more than 10 years old (-1 tier)")

    if inputs.geocoder_match_is_approximate:
        tier = _reduce(tier, 1)
        drivers.append("Geocoder match is approximate (-1 tier)")

    # Section 9.3: inland property at 100-year horizon loses one tier.
    if inputs.is_inland and inputs.horizon_years == 100:
        tier = _reduce(tier, 1)
        drivers.append(
            "Inland property, 100-year horizon — no forward-looking signal (-1 tier)"
        )

    # Section 8: disagreement check only applies when NOAA actually has
    # a signal for this property. Skipping for inland-no-coverage cases
    # prevents the absence of NOAA data from masquerading as disagreement.
    if inputs.noaa_signal_available:
        disagrees = disagreement_flag(inputs.fema_normalized, inputs.noaa_normalized)
    else:
        disagrees = False
    if disagrees:
        tier = ConfidenceTier.LOW
        drivers.append("FEMA and NOAA components disagree significantly (forced Low)")

    return ConfidenceResult(tier=tier, drivers=drivers, disagreement=disagrees)


def _reduce(tier: ConfidenceTier, steps: int) -> ConfidenceTier:
    new_value = max(int(ConfidenceTier.LOW), int(tier) - steps)
    return ConfidenceTier(new_value)
