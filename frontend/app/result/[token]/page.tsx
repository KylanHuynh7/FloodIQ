"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FloodScoreResponse, HorizonScore } from "@/lib/tokens";
import { DownloadIcon } from "@/components/icons";
import { AddressForm, Kicker, SiteFooter, SiteHeader } from "@/components/chrome";
import { ConfirmationMap } from "@/components/ConfirmationMap";
import { HorizonExplorer } from "@/components/HorizonExplorer";
import { apiUrl } from "@/lib/api";

export default function ResultPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<FloodScoreResponse | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/result/${token}`))
      .then(async (r) => {
        const text = await r.text();
        let body: FloodScoreResponse | { detail?: string; error?: string } | null = null;
        try {
          body = JSON.parse(text);
        } catch {
          /* not JSON */
        }
        if (cancelled) return;
        if (!r.ok) {
          const d = (body as { detail?: string; error?: string }) ?? {};
          setError({ status: r.status, message: d.detail || d.error || `HTTP ${r.status}` });
          return;
        }
        setData(body as FloodScoreResponse);
      })
      .catch(() => {
        if (!cancelled) setError({ status: 0, message: "Couldn't reach the FloodIQ server." });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <ResultError status={error.status} message={error.message} />;
  if (!data) return <ResultSkeleton />;

  const approximate = data.geocoder_match_is_approximate;
  const horizons: HorizonScore[] = [data.horizons["10"], data.horizons["30"], data.horizons["100"]];
  const coverage = data.noaa_data_available
    ? "Sea-level rise projected here"
    : data.noaa_region_covered
      ? "No projected inundation here"
      : "Outside NOAA coverage";
  const scoredOn = new Date(data.scored_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* Address band */}
        <section className="contours border-b border-ink/10">
          <div className="mx-auto grid w-full max-w-[1160px] gap-8 px-4 pt-8 pb-10 sm:px-6 sm:pt-12 lg:grid-cols-12 lg:gap-10">
            <div className="rise flex min-w-0 flex-col lg:col-span-6">
              <Kicker>Flood risk report, {scoredOn}</Kicker>
              <h1 className="mt-4 break-words font-display text-[28px] font-bold leading-[1.08] tracking-[-0.9px] text-ink text-balance sm:text-[38px] sm:tracking-[-1.3px]">
                {data.matched_address}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <Tag tone={approximate ? "signal" : "ink"}>
                  {approximate ? "Approximate match" : "Exact match"}
                </Tag>
                <Tag>{data.county_name}</Tag>
                <Tag>{data.fema_zone_raw ? `FEMA Zone ${data.fema_zone_raw}` : "FEMA zone n/a"}</Tag>
                <Tag>{coverage}</Tag>
              </div>

              <div className="mt-6 border-l-[3px] border-signal bg-surface px-5 py-4">
                <p className="text-[16px] leading-[1.55] font-medium text-ink sm:text-[17px]">
                  {data.summary_headline}
                </p>
                {data.inland_note && (
                  <details className="group mt-2">
                    <summary className="inline-flex min-h-[32px] cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-accent">
                      <span className="group-open:hidden">Why? Read the data note</span>
                      <span className="hidden group-open:inline">Hide data note</span>
                    </summary>
                    <p className="mt-1 text-[13.5px] leading-[1.6] text-ink-3">{data.inland_note}</p>
                  </details>
                )}
              </div>

              <a
                href={apiUrl(`/report/${data.score_id}.pdf`)}
                target="_blank"
                rel="noreferrer"
                className="group mt-5 flex min-h-[56px] items-center justify-between gap-4 border-[1.5px] border-ink bg-ink px-5 py-3 text-white transition hover:bg-accent-deep"
              >
                <div>
                  <div className="text-[15px] font-semibold">Download the full report</div>
                  <div className="text-[13px] text-white/60">3-page PDF with sources and disclaimers</div>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-signal text-ink transition-transform group-hover:translate-y-0.5">
                  <DownloadIcon size={16} />
                </span>
              </a>
            </div>

            <div className="rise min-w-0 lg:col-span-6" style={{ animationDelay: "80ms" }}>
              <ConfirmationMap lat={data.latitude} lon={data.longitude} approximate={approximate} height={340} />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1160px] px-4 sm:px-6">
          {/* Horizons */}
          <section className="mt-12 sm:mt-16">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <Kicker>Risk over time</Kicker>
                <h2 className="mt-3 font-display text-[26px] font-bold tracking-[-0.7px] text-ink sm:text-[30px]">
                  How this home compares over time
                </h2>
              </div>
            </div>
            <HorizonExplorer
              horizons={horizons}
              scoredAt={data.scored_at}
              countyName={data.county_name}
              femaZone={data.fema_zone_raw}
            />
          </section>

          {/* Sources + how to read */}
          <section className="mt-14 grid gap-6 lg:grid-cols-12">
            <div className="min-w-0 border-[1.5px] border-ink bg-surface lg:col-span-7">
              <h2 className="border-b-[1.5px] border-ink px-5 py-3.5 font-display text-[17px] font-bold text-ink sm:px-6">
                Source data
              </h2>
              <dl className="divide-y divide-ink/10">
                <SourceRow label="FEMA flood zone" value={data.fema_zone_raw ? `Zone ${data.fema_zone_raw}` : "Not available"} />
                <SourceRow
                  label="FEMA map age"
                  value={data.fema_map_age_years != null ? `${data.fema_map_age_years.toFixed(1)} years` : "Unknown"}
                  flag={
                    data.fema_map_age_years != null && data.fema_map_age_years > 5
                      ? "Older than 5 years, so confidence is reduced"
                      : undefined
                  }
                />
                <SourceRow
                  label="NOAA sea-level rise"
                  value={
                    data.noaa_data_available
                      ? "Inundation projected at this location"
                      : data.noaa_region_covered
                        ? "Covered region, no projected inundation here"
                        : "Outside coverage, FEMA data only"
                  }
                />
                <SourceRow
                  label="Location match"
                  value={approximate ? "Approximate (OpenStreetMap fallback)" : "Exact (U.S. Census geocoder)"}
                  flag={approximate ? "Approximate match, so confidence is reduced" : undefined}
                />
                <SourceRow label="Coordinates" value={`${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`} mono />
              </dl>
            </div>

            <div className="min-w-0 lg:col-span-5">
              <h2 className="font-display text-[17px] font-bold text-ink">How to read this report</h2>
              <div className="mt-2 divide-y divide-ink/10 border-y border-ink/15">
                <Explainer title="County percentile">
                  Ranks this address against locations we sampled across {data.county_name}. The
                  50th percentile is the middle of the county. When most of the county scores
                  exactly the same, we say &ldquo;typical for this county&rdquo; instead, because a
                  ranking among identical scores doesn&apos;t mean much.
                </Explainer>
                <Explainer title="Confidence">
                  Drops when FEMA and NOAA disagree, when maps are old, or when the address could only be
                  located approximately. Treat a high score with low confidence with caution.
                </Explainer>
                <Explainer title="Raw score">
                  The underlying 0–100 composite before ranking: FEMA&apos;s zone hazard, blended with
                  NOAA&apos;s projection more heavily at longer horizons.
                </Explainer>
              </div>
            </div>
          </section>

          <section className="mt-14 border-[1.5px] border-ink bg-surface p-5 sm:p-7">
            <div className="mb-3 font-display text-[18px] font-bold text-ink">Check another address</div>
            <AddressForm />
          </section>
        </div>
      </main>

      <SiteFooter version={data.methodology_version} />
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "ink" | "signal" }) {
  const cls =
    tone === "ink"
      ? "border-ink bg-ink text-white"
      : tone === "signal"
        ? "border-ink bg-signal text-ink"
        : "border-ink/25 bg-surface text-ink-2";
  return (
    <span className={`inline-flex items-center border px-2.5 py-1 text-[12.5px] font-medium leading-tight ${cls}`}>
      {children}
    </span>
  );
}

function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[14.5px] font-medium text-ink">
        {title}
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center border border-ink/30 font-mono text-[13px] transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="pb-4 text-[14px] leading-[1.6] text-ink-2">{children}</p>
    </details>
  );
}

function SourceRow({ label, value, flag, mono }: { label: string; value: string; flag?: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 px-5 py-3.5 transition-colors hover:bg-surface-2/60 sm:grid-cols-[170px_1fr] sm:gap-4 sm:px-6">
      <dt className="text-[13.5px] text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-[14.5px] text-ink">
        <span className={mono ? "font-mono text-[13px]" : undefined}>{value}</span>
        {flag && <div className="mt-0.5 text-[12.5px] text-warn">{flag}</div>}
      </dd>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1160px] animate-pulse px-4 pt-10 sm:px-6" aria-busy="true" aria-label="Loading result">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="h-4 w-48 bg-ink/10" />
            <div className="mt-5 h-10 w-full bg-ink/10" />
            <div className="mt-2 h-10 w-2/3 bg-ink/10" />
            <div className="mt-6 h-24 bg-ink/10" />
          </div>
          <div className="h-[340px] bg-ink/10 lg:col-span-6" />
        </div>
        <div className="mt-14 h-96 bg-ink/10" />
      </main>
    </div>
  );
}

function ResultError({ status, message }: { status: number; message: string }) {
  const notFound = status === 404;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[680px] px-4 pt-16 sm:px-6">
        <Kicker>{notFound ? "Not found" : "Error"}</Kicker>
        <h1 className="mt-4 font-display text-[32px] font-bold tracking-[-1px] text-ink">
          {notFound ? "This report doesn't exist." : "We couldn't load this report."}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-ink-2">
          {notFound
            ? "The link may be mistyped, or the report may have been cleared from the server. Run a new lookup below."
            : message}
        </p>
        <div className="mt-8">
          <AddressForm />
        </div>
      </main>
    </div>
  );
}
