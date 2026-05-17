"""3-page PDF report (METHODOLOGY.md Section 10.2)."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from floodiq.pipeline import ScoreReport
from floodiq.report.disclaimers import DISCLAIMER_BULLETS, METHODOLOGY_FOOTER


def build_pdf(report: ScoreReport) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        title=f"FloodIQ report — {report.matched_address or report.input_address}",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=18, spaceAfter=8)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=13)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontSize=8, leading=10, textColor=HexColor("#444"))

    story: list = []

    if report.error:
        story.extend(_error_page(report, h1, body))
    else:
        story.extend(_page_1_headline(report, h1, h2, body))
        story.append(PageBreak())
        story.extend(_page_2_sources(report, h1, h2, body))
        story.append(PageBreak())
        story.extend(_page_3_talking_points(report, h1, h2, body))

    doc.build(
        story,
        onFirstPage=_footer_factory(report, small),
        onLaterPages=_footer_factory(report, small),
    )
    return buf.getvalue()


def _page_1_headline(report, h1, h2, body):
    out = [
        Paragraph("FloodIQ Report", h1),
        Paragraph(report.matched_address or report.input_address, body),
        Spacer(1, 0.15 * inch),
    ]

    rows = [
        ["Horizon", "County", "National", "Absolute (0-100)", "Confidence"]
    ]
    for h in (10, 30, 100):
        hr = report.horizons[h]
        county = (
            f"{hr.composite_county_percentile:.0f}"
            if hr.composite_county_percentile is not None
            else "pending"
        )
        national = (
            f"{hr.composite_national_percentile:.0f}"
            if hr.composite_national_percentile is not None
            else "pending"
        )
        rows.append(
            [
                f"{h}-year",
                county,
                national,
                f"{hr.composite_absolute:.0f}",
                hr.confidence_label,
            ]
        )
    table = Table(
        rows,
        colWidths=[0.9 * inch, 1.1 * inch, 1.1 * inch, 1.5 * inch, 1.2 * inch],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#e8eef5")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, HexColor("#999")),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    out += [
        table,
        Spacer(1, 0.2 * inch),
        Paragraph("Summary", h2),
        Paragraph(report.summary_headline, body),
        Spacer(1, 0.15 * inch),
        Paragraph("Recommended action", h2),
        Paragraph(_recommended_action(report), body),
    ]
    if report.inland_note:
        out += [Spacer(1, 0.15 * inch), Paragraph(report.inland_note, body)]
    return out


def _page_2_sources(report, h1, h2, body):
    out = [
        Paragraph("Source breakdown", h1),
        Paragraph("FEMA — National Flood Hazard Layer", h2),
    ]
    age_str = (
        f"{report.fema_map_age_years:.1f} years old"
        if report.fema_map_age_years is not None
        else "map age unknown"
    )
    out += [
        Paragraph(
            f"Zone: <b>{report.fema_zone_raw or 'n/a'}</b> "
            f"(normalized to {report.fema_zone_normalized or 'n/a'}). "
            f"Effective date: {report.fema_map_effective_date or 'unknown'} ({age_str}).",
            body,
        ),
        Spacer(1, 0.1 * inch),
        Paragraph("NOAA — Sea Level Rise inundation", h2),
    ]
    if report.noaa_data_available:
        noaa_lines = []
        for h in (10, 30, 100):
            hr = report.horizons[h]
            noaa_lines.append(
                f"{h}-year: NOAA component = {hr.noaa_component}/100"
            )
        out.append(Paragraph("<br/>".join(noaa_lines), body))
    elif report.noaa_region_covered:
        out.append(
            Paragraph(
                "Coastal coverage applies to this address, but NOAA's "
                "Intermediate-scenario inundation does not reach this point "
                "at the horizons checked. NOAA component is 0 for all "
                "horizons; the composite falls back to FEMA-only weighting.",
                body,
            )
        )
    else:
        out.append(
            Paragraph(
                "This address is outside FloodIQ v1.1's NOAA SLR coverage "
                "(CONUS coastal states only). NOAA component = 0 for all "
                "horizons; scoring is FEMA-only.",
                body,
            )
        )

    out += [
        Spacer(1, 0.15 * inch),
        Paragraph("Source agreement", h2),
    ]
    disagreements = [h for h, hr in report.horizons.items() if hr.disagreement]
    if disagreements:
        out.append(
            Paragraph(
                f"FEMA and NOAA disagree significantly at horizon(s): "
                f"{', '.join(f'{h}-year' for h in disagreements)}. "
                f"This typically indicates a coastal property whose FEMA map "
                f"predates current climate projections, or an inland property "
                f"in a FEMA-designated flood zone where no NOAA SLR signal "
                f"applies. Confidence is reduced to Low for affected horizons.",
                body,
            )
        )
    else:
        out.append(Paragraph("No significant source disagreement detected.", body))

    out += [Spacer(1, 0.15 * inch), Paragraph("Confidence drivers", h2)]
    for h in (10, 30, 100):
        hr = report.horizons[h]
        drivers = "; ".join(hr.confidence_drivers) if hr.confidence_drivers else "no reductions"
        out.append(
            Paragraph(
                f"<b>{h}-year ({hr.confidence_label}):</b> {drivers}",
                body,
            )
        )
    return out


def _page_3_talking_points(report, h1, h2, body):
    out = [
        Paragraph("Buyer talking points", h1),
        Paragraph("Ask your insurance agent", h2),
        Paragraph(
            "1. Is this property in a FEMA Special Flood Hazard Area, and is "
            "flood insurance mandatory under my mortgage?",
            body,
        ),
        Paragraph(
            "2. Does this property qualify for the lower-risk Preferred Risk "
            "Policy, or only the standard NFIP policy?",
            body,
        ),
        Paragraph(
            "3. What does flood insurance cost annually at this address, and "
            "how has the premium changed in the past five years?",
            body,
        ),
        Spacer(1, 0.1 * inch),
        Paragraph("Ask the seller or listing agent", h2),
        Paragraph(
            "1. Has the property ever flooded? If so, when and how deep?",
            body,
        ),
        Paragraph(
            "2. Are there past NFIP or private flood insurance claims on this "
            "address that I can request from the seller in writing?",
            body,
        ),
        Paragraph(
            "3. Is there an Elevation Certificate available, and what is the "
            "first finished floor elevation relative to the Base Flood Elevation?",
            body,
        ),
        Spacer(1, 0.1 * inch),
        Paragraph("Things worth asking about", h2),
        Paragraph(
            "Elevation certificates · Substantial Improvement / Substantial "
            "Damage history · Flood vents in any below-grade space · Sump "
            "pumps and backflow prevention · Local floodplain administrator's "
            "records · Recent FEMA map revisions or pending LOMAs / LOMRs.",
            body,
        ),
        Spacer(1, 0.2 * inch),
        Paragraph("Disclaimers", h2),
    ]
    for bullet in DISCLAIMER_BULLETS:
        out.append(Paragraph("• " + bullet, body))
    return out


def _error_page(report, h1, body):
    return [
        Paragraph("FloodIQ — Score not available", h1),
        Paragraph(report.input_address, body),
        Spacer(1, 0.15 * inch),
        Paragraph(report.error or "Unknown error.", body),
    ]


def _recommended_action(report: ScoreReport) -> str:
    high_risk = any(
        hr.composite_absolute >= 70 for hr in report.horizons.values()
    )
    any_disagreement = any(hr.disagreement for hr in report.horizons.values())
    if high_risk and any_disagreement:
        return (
            "Treat as elevated flood risk and verify with the local floodplain "
            "administrator and a licensed insurance agent before proceeding. "
            "Source disagreement at one or more horizons warrants extra "
            "diligence."
        )
    if high_risk:
        return (
            "Treat as elevated flood risk. Request an elevation certificate and "
            "obtain a flood insurance quote before signing."
        )
    if any_disagreement:
        return (
            "Risk appears modest but sources disagree — review the source "
            "breakdown on page 2 before deciding."
        )
    return (
        "Risk appears modest by both available sources. Consult your insurer "
        "to confirm coverage requirements."
    )


def _footer_factory(report: ScoreReport, small_style):
    footer_text = METHODOLOGY_FOOTER.format(version=report.methodology_version)
    retrieval = f"Scored at {report.scored_at}."
    # Section 10.2 requires the disclaimer to be visible on every page.
    # We render a one-line pointer here; the full Section 12 bullets live
    # on page 3 so the footer doesn't crowd the headline content.
    disclaimer_line = (
        "Not professional advice. Educational tool using public FEMA + NOAA data. "
        "See page 3 for full disclaimers."
    )

    def draw(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica-Oblique", 7)
        canvas.setFillColor(HexColor("#444"))
        canvas.drawCentredString(LETTER[0] / 2.0, 0.55 * inch, disclaimer_line)
        canvas.setFont("Helvetica", 7)
        canvas.drawString(0.6 * inch, 0.4 * inch, footer_text)
        canvas.drawRightString(LETTER[0] - 0.6 * inch, 0.4 * inch, retrieval)
        canvas.restoreState()

    return draw
