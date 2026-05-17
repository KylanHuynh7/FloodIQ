"""End-to-end smoke: form GET, score POST, PDF GET.

Exercises the full FastAPI wiring with a real address that we already know
(from scripts/smoke_inland.py) round-trips correctly through the upstream
APIs. Failure modes we're hunting for: HTML rendering errors, broken
record_score → get_score → build_pdf round-trip, malformed PDF bytes.
"""

from __future__ import annotations

import re
import sys

from fastapi.testclient import TestClient

from floodiq.web.app import app


ADDR = "200 W River Dr, Davenport, IA 52801"


def main() -> int:
    client = TestClient(app)

    print("1. GET /")
    r = client.get("/")
    assert r.status_code == 200, r.status_code
    assert "<form" in r.text
    assert "student-built" in r.text  # disclaimer present
    print("   ok: 200, form + disclaimers present")

    print(f"2a. POST /score address={ADDR!r} (expect loading shell)")
    r = client.post("/score", data={"address": ADDR}, follow_redirects=True)
    assert r.status_code == 200, r.status_code
    assert "Working on it" in r.text, "loading shell did not render"
    assert "fetch('/api/score'" in r.text, "loading shell missing JS call"
    print("   ok: 200, loading shell rendered with JS hook")

    print("2b. POST /api/score (browser would do this)")
    r = client.post("/api/score", json={"address": ADDR})
    assert r.status_code == 200, r.status_code
    data = r.json()
    assert not data.get("error"), data.get("error")
    score_id = data["score_id"]
    assert score_id, "API did not return score_id"
    print(f"   ok: 200, score_id={score_id}")

    print(f"2c. GET /result/{score_id} (loading-shell redirect target)")
    r = client.get(f"/result/{score_id}")
    assert r.status_code == 200, r.status_code
    body = r.text
    assert "Davenport" in body or "DAVENPORT" in body, "matched address missing"
    assert "10-year" in body and "30-year" in body and "100-year" in body
    m = re.search(r'href="(/report/(\d+)\.pdf)"', body)
    assert m, "PDF link not found in result page"
    pdf_url = m.group(1)
    print(f"   ok: 200, result page rendered, PDF link = {pdf_url}")

    # Print the visible score table for sanity (5 columns: horizon,
    # county, national, absolute, confidence).
    rows = re.findall(
        r"<tr>\s*<td>(\d+-year)</td>\s*<td>([^<]+)</td>\s*<td>([^<]+)</td>"
        r"\s*<td>([^<]+)</td>\s*<td>([^<]+)</td>",
        body,
    )
    for row in rows:
        print(
            f"   {row[0]:<10} county={row[1]:<10} national={row[2]:<10} "
            f"abs={row[3]:<6} conf={row[4]}"
        )

    print(f"3. GET {pdf_url}")
    r = client.get(pdf_url)
    assert r.status_code == 200, r.status_code
    assert r.headers["content-type"].startswith("application/pdf"), r.headers
    pdf = r.content
    assert pdf.startswith(b"%PDF-"), "not a PDF (bad magic bytes)"
    assert pdf.rstrip().endswith(b"%%EOF"), "PDF missing %%EOF trailer"
    print(f"   ok: 200, {len(pdf)} bytes, valid PDF magic + EOF")

    # Quick content check: PDF should mention the address and methodology.
    text_blob = pdf.decode("latin-1", errors="ignore")
    assert "FloodIQ" in text_blob
    print("   ok: PDF contains 'FloodIQ' marker")

    print("\nALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
