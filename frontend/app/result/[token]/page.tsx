"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CONFIDENCE,
  FloodScoreResponse,
  HorizonScore,
  ordinalSuffix,
  riskColor,
} from "@/lib/tokens";
import { DownloadIcon, InfoIcon, PinIcon, WarnIcon } from "@/components/icons";
import { ConfirmationMap } from "@/components/ConfirmationMap";
import { DistHistogram } from "@/components/DistHistogram";

export default function ResultPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<FloodScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/result/${token}`)
      .then(async (r) => {
        const text = await r.text();
        let body: FloodScoreResponse | { detail?: string; error?: string } | null =
          null;
        try {
          body = JSON.parse(text);
        } catch {
          /* not JSON */
        }
        if (cancelled) return;
        if (!r.ok) {
          const d = (body as { detail?: string; error?: string }) ?? {};
          setError(d.detail || d.error || text || `HTTP ${r.status}`);
          return;
        }
        setData(body as FloodScoreResponse);
      })
      .catch((e) => {
        if (!cancelled) setError(`Network error: ${e?.message ?? e}`);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-paper px-5 py-12 lg:max-w-[1200px] lg:px-12">
        <header className="mb-8 font-mono text-[11px] font-semibold tracking-[1.6px] text-ink">
          FLOODIQ
        </header>
        <div className="border border-ink bg-surface px-4 py-4">
          <div className="mb-1 font-mono text-[10px] font-semibold tracking-[1.4px] text-signal">
            ERROR
          </div>
          <div className="font-sans text-[14px] leading-[1.5] text-ink-2">{error}</div>
          <a
            href="/"
            className="mt-3 inline-block font-mono text-[11px] font-medium tracking-[0.6px] text-ink underline underline-offset-4"
          >
            ← Try another address
          </a>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto min-h-screen max-w-[480px] bg-paper px-5 py-12 lg:max-w-[1200px] lg:px-12">
        <div className="font-mono text-[11px] tracking-[1.4px] text-ink-3">LOADING…</div>
      </main>
    );
  }

  const approximate = data.geocoder_match_is_approximate;
  const horizons: HorizonScore[] = [
    data.horizons["10"],
    data.horizons["30"],
    data.horizons["100"],
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-paper pb-16 lg:max-w-[1200px] lg:pb-24">
      <header className="flex items-baseline justify-between px-5 pt-3 font-mono text-[11px] font-semibold tracking-[1.6px] text-ink lg:px-12 lg:pt-8 lg:text-[12px]">
        <a href="/" className="text-ink underline-offset-4 hover:underline">
          FLOODIQ
        </a>
        <span className="text-[10px] font-medium text-ink-3 lg:text-[11px]">
          METHOD V{data.methodology_version}
        </span>
      </header>

      {/* Matched address block */}
      <section className="mx-5 mt-6 border-b border-ink bg-surface px-4 py-4 lg:mx-12 lg:mt-10 lg:px-6 lg:py-6">
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:text-[11px]">
          <PinIcon size={12} />
          MATCHED · {approximate ? "APPROXIMATE" : "ROOFTOP"}
        </div>
        <h1 className="font-sans text-[22px] font-medium leading-[1.15] tracking-[-0.6px] text-ink lg:text-[30px] lg:tracking-[-1px]">
          {data.matched_address}
        </h1>
        <div className="mt-1 font-sans text-[13px] text-ink-2 lg:text-[14px]">
          {data.county_name}
          {" · "}
          <span className="font-mono text-[11px] tracking-[0.5px] text-ink-3">
            {data.is_inland ? "INLAND" : data.noaa_region_covered ? "COASTAL" : "OUTSIDE NOAA COVERAGE"}
          </span>
        </div>
        {approximate && (
          <div className="mt-3 flex items-start gap-2 border border-signal border-l-[3px] bg-paper px-3 py-2">
            <WarnIcon size={14} className="mt-0.5 text-signal" />
            <div className="font-sans text-[12px] leading-[1.45] text-ink-2">
              <span className="font-mono text-[10px] font-semibold tracking-[1.2px] text-signal">
                APPROX
              </span>{" "}
              Approximate location. Verify this matches the property you&apos;re
              researching.
            </div>
          </div>
        )}
      </section>

      {/* Confirmation map */}
      <section className="mx-5 mt-4 lg:mx-12 lg:mt-6">
        <ConfirmationMap
          lat={data.latitude}
          lon={data.longitude}
          approximate={approximate}
          height={240}
        />
      </section>

      {/* Headline summary */}
      <section className="mx-5 mt-4 border border-line-soft bg-surface px-4 py-4 lg:mx-12 lg:mt-6 lg:px-6 lg:py-6">
        <div className="font-sans text-[15px] leading-[1.5] text-ink-2 lg:text-[18px] lg:leading-[1.45]">
          {data.summary_headline}
        </div>
      </section>

      {/* Horizon cards — stacked on mobile, 3-col on desktop */}
      <section className="mx-5 mt-3 grid gap-3 lg:mx-12 lg:mt-6 lg:grid-cols-3 lg:gap-6">
        {horizons.map((h, i) => (
          <HorizonCard
            key={h.horizon_years}
            h={h}
            index={i}
            total={horizons.length}
            countyName={data.county_name}
          />
        ))}
      </section>

      {/* PDF CTA */}
      <a
        href={`/report/${data.score_id}.pdf`}
        className="mx-5 mt-6 flex items-center justify-between bg-ink px-4 py-4 text-surface no-underline lg:mx-12 lg:mt-10 lg:px-6 lg:py-5"
      >
        <div>
          <div className="font-sans text-[15px] font-medium leading-tight lg:text-[17px]">
            Download full report
          </div>
          <div className="mt-0.5 font-mono text-[10px] tracking-[1px] text-ink-4 lg:text-[11px]">
            PDF · 3 PAGES
          </div>
        </div>
        <DownloadIcon size={18} />
      </a>

      {/* How to read this score */}
      <details className="group mx-5 mt-6 border border-ink bg-surface lg:mx-12 lg:mt-10">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-sans text-[13px] font-medium text-ink lg:px-6 lg:py-4 lg:text-[14px]">
          <span className="flex items-center gap-2">
            <InfoIcon size={14} />
            How to read this score
          </span>
          <span className="text-ink-3 group-open:hidden">＋</span>
          <span className="hidden text-ink-3 group-open:inline">−</span>
        </summary>
        <div className="px-4 pb-4 font-sans text-[12.5px] leading-[1.55] text-ink-2 lg:px-6 lg:pb-5 lg:text-[14px]">
          <p className="mb-2">
            <b className="font-semibold text-ink">County percentile</b> compares this address to other residential properties in {data.county_name}. 50 is the county median; a 78 means this address has higher modeled flood risk than 78% of the county.
          </p>
          <p>
            <b className="font-semibold text-ink">Confidence</b> reflects FEMA/NOAA agreement plus source-data age. A high score with low confidence should be read with caution — and that&apos;s why we surface the caveats on each horizon card.
          </p>
        </div>
      </details>

      {/* Source data */}
      <section className="mx-5 mt-4 border border-ink bg-surface lg:mx-12 lg:mt-6">
        <div className="border-b border-line px-4 py-3 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:px-6 lg:py-4 lg:text-[11px]">
          SOURCE DATA / FOR THIS ADDRESS
        </div>
        <dl className="divide-y divide-line-soft">
          <SourceRow label="FEMA NFHL" value={`Zone ${data.fema_zone_raw ?? "—"}`} />
          <SourceRow
            label="FEMA map age"
            value={
              data.fema_map_age_years != null
                ? `${data.fema_map_age_years.toFixed(1)} years`
                : "unknown"
            }
            flag={
              data.fema_map_age_years != null && data.fema_map_age_years > 5
                ? "Older than 5 years — confidence penalty applied"
                : undefined
            }
          />
          <SourceRow
            label="NOAA SLR"
            value={
              data.noaa_data_available
                ? "Coastal SLR projection applied"
                : data.noaa_region_covered
                  ? "Coverage available, no inundation at this point"
                  : "Outside coverage — FEMA only"
            }
          />
          <SourceRow
            label="Geocode"
            value={
              data.geocoder_match_is_approximate
                ? "Approximate (OSM fallback)"
                : "Rooftop (Census)"
            }
          />
        </dl>
      </section>

      <footer className="mx-5 mt-10 font-mono text-[10px] leading-[1.6] tracking-[0.4px] text-ink-3 lg:mx-12 lg:mt-14 lg:text-[11px]">
        <div className="mb-1 font-semibold tracking-[1.2px] text-ink lg:tracking-[1.6px]">
          METHODOLOGY V{data.methodology_version}
        </div>
        Not professional advice. FloodIQ is an educational tool; not flood-insurance underwriting and not a substitute for professional flood assessment. See full disclaimers on the PDF report.
      </footer>
    </main>
  );
}

function HorizonCard({
  h,
  index,
  total,
  countyName,
}: {
  h: HorizonScore;
  index: number;
  total: number;
  countyName: string;
}) {
  const pct = Math.round(h.composite_county_percentile);
  const band = riskColor(pct);
  const conf = CONFIDENCE[h.confidence_label];
  const yearLabel = h.horizon_years === 10
    ? "BY 2036"
    : h.horizon_years === 30
      ? "BY 2056"
      : "BY 2125";

  return (
    <article className="flex flex-col border border-ink bg-surface-alt shadow-[4px_4px_0_0_rgba(10,10,10,0.06)]">
      {/* Eyebrow */}
      <div className="flex items-center justify-between border-b border-line bg-surface-alt px-3 py-2 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink-3">
        <span>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} · +{h.horizon_years} YEARS · {yearLabel}
        </span>
        <ConfMeter level={h.confidence_label} />
      </div>

      {/* Stat */}
      <div className="grid grid-cols-[auto_1fr] items-end gap-3 bg-surface px-4 py-4">
        <div className="flex items-start">
          <span className="font-sans text-[54px] font-medium leading-[0.9] tracking-[-2px] text-ink tabular-nums">
            {pct}
          </span>
          <span className="ml-0.5 mt-1 font-sans text-[18px] font-medium text-ink-2">
            {ordinalSuffix(pct)}
          </span>
        </div>
        <div className="flex flex-col items-start gap-2">
          <div className="font-sans text-[13px] leading-[1.3] text-ink-2">
            percentile in
            <br />
            <span className="text-ink">{countyName}</span>
          </div>
          <span
            className="px-2 py-1 font-mono text-[10px] font-semibold tracking-[1.2px]"
            style={{ backgroundColor: band.fill, color: band.ink }}
          >
            {band.label.toUpperCase()} RISK
          </span>
        </div>
      </div>

      {/* Histogram tray */}
      <div className="border-y border-line bg-paper-alt px-3 pt-2 pb-1">
        <div className="flex items-center justify-between px-2 pb-1 font-mono text-[9px] font-medium tracking-[1.2px] text-ink-2">
          <span>▼ THIS ADDRESS</span>
          <span>COUNTY DISTRIBUTION</span>
        </div>
        <DistHistogram percentile={pct} conf={h.confidence_label} />
      </div>

      {/* Footer details */}
      <div className="grid grid-cols-3 divide-x divide-line-soft bg-surface px-2 py-3">
        <FootStat label="NATIONAL" value={`${Math.round(h.composite_national_percentile)}${ordinalSuffix(Math.round(h.composite_national_percentile))}`} />
        <FootStat label="RAW" value={`${Math.round(h.composite_absolute)}/100`} />
        <FootStat label="CONF." value={conf.desc} />
      </div>

      {/* Caveat row */}
      {h.confidence_drivers.length > 0 && (
        <div className="grid grid-cols-[auto_1fr] gap-2 border-t border-line bg-surface-alt px-3 py-2.5">
          <span className="font-mono text-[10px] font-semibold tracking-[1.2px] text-ink-3">
            ↘ CAVEAT
          </span>
          <span className="font-sans text-[12px] leading-[1.4] text-ink-2">
            {h.confidence_drivers.join("; ")}
          </span>
        </div>
      )}
    </article>
  );
}

function ConfMeter({ level }: { level: "High" | "Medium" | "Low" }) {
  const filled = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <span className="flex items-center gap-1" aria-label={`Confidence: ${level}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-[5px] w-[12px] border border-ink ${i < filled ? "bg-ink" : "bg-transparent"}`}
        />
      ))}
    </span>
  );
}

function FootStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center first:pl-0 last:pr-0">
      <div className="mb-0.5 font-mono text-[9px] font-semibold tracking-[1.2px] text-ink-3">
        {label}
      </div>
      <div className="font-sans text-[14px] font-medium tabular-nums text-ink">{value}</div>
    </div>
  );
}

function SourceRow({
  label,
  value,
  flag,
}: {
  label: string;
  value: string;
  flag?: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-4 py-3 lg:grid-cols-[160px_1fr] lg:px-6 lg:py-4">
      <dt className="font-mono text-[10px] font-semibold tracking-[1.2px] text-ink-3 lg:text-[11px]">
        {label}
      </dt>
      <dd className="font-sans text-[13px] leading-[1.4] text-ink-2 lg:text-[14px]">
        <span className={flag ? "text-signal" : undefined}>{value}</span>
        {flag && (
          <div className="mt-0.5 font-mono text-[10px] tracking-[0.4px] text-signal">
            {flag}
          </div>
        )}
      </dd>
    </div>
  );
}

