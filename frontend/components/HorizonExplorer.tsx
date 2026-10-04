"use client";

import { useEffect, useRef, useState } from "react";
import { WarnIcon } from "@/components/icons";
import { PercentileScale } from "@/components/PercentileScale";
import {
  ConfidenceLevel,
  HorizonScore,
  RISK_BANDS,
  horizonYear,
  isTypicalForCounty,
  ordinalSuffix,
  riskColor,
} from "@/lib/tokens";

// Animate a number toward `target` whenever it changes.
function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      fromRef.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function HorizonExplorer({
  horizons,
  scoredAt,
  countyName,
  femaZone,
}: {
  horizons: HorizonScore[];
  scoredAt: string;
  countyName: string;
  femaZone: string | null;
}) {
  const [sel, setSel] = useState(0);
  const h = horizons[sel];
  const typical = isTypicalForCounty(h);
  const pct = Math.round(h.composite_county_percentile);
  const band = riskColor(pct);
  const shown = Math.round(useCountUp(pct));
  const nat = h.composite_national_percentile != null ? Math.round(h.composite_national_percentile) : null;
  const year = horizonYear(scoredAt, h.horizon_years);

  // Roving tabindex: arrow keys move both the selection and keyboard focus.
  function onKey(e: React.KeyboardEvent) {
    const n = horizons.length;
    const next =
      e.key === "ArrowRight" ? (sel + 1) % n : e.key === "ArrowLeft" ? (sel - 1 + n) % n : null;
    if (next === null) return;
    e.preventDefault();
    setSel(next);
    document.getElementById(`hz-tab-${next}`)?.focus();
  }

  return (
    <div className="border-2 border-ink bg-surface shadow-[6px_6px_0_0_#0f2430]">
      <div
        role="tablist"
        aria-label="Time horizon"
        onKeyDown={onKey}
        className="grid grid-cols-3 divide-x-2 divide-ink border-b-2 border-ink"
      >
        {horizons.map((hz, i) => {
          const active = i === sel;
          const p = Math.round(hz.composite_county_percentile);
          const hzTypical = isTypicalForCounty(hz);
          return (
            <button
              key={hz.horizon_years}
              role="tab"
              id={`hz-tab-${i}`}
              aria-selected={active}
              aria-controls="hz-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setSel(i)}
              className={`group relative min-h-[64px] px-3 py-2.5 text-left transition-colors sm:px-5 ${
                active ? "bg-ink text-white" : "bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[17px] font-bold leading-none sm:text-[19px]">
                  +{hz.horizon_years} yrs
                </span>
                <span
                  className={`hidden font-display text-[14px] font-bold tabular-nums sm:inline ${
                    active ? "text-signal" : "text-ink-3"
                  }`}
                >
                  {hzTypical ? "Typical" : `${p}${ordinalSuffix(p)}`}
                </span>
              </div>
              <div className={`mt-1 text-[12.5px] ${active ? "text-white/65" : "text-ink-4"}`}>
                by {horizonYear(scoredAt, hz.horizon_years)}
              </div>
              <span
                className="absolute inset-x-0 bottom-0 h-[3px]"
                style={{ backgroundColor: hzTypical ? "#9caeb1" : riskColor(p).fill }}
              />
            </button>
          );
        })}
      </div>

      <div id="hz-panel" role="tabpanel" aria-labelledby={`hz-tab-${sel}`} className="grid md:grid-cols-12">
        {/* Readout */}
        <div key={sel} className="rise p-5 sm:p-7 md:col-span-7 md:border-r md:border-ink/15">
          {typical ? (
            <>
              <div className="text-[14px] font-semibold text-ink-3">By {year}, compared with {countyName}</div>
              <div className="mt-2 font-display text-[54px] font-extrabold leading-[0.95] tracking-[-2px] text-ink sm:text-[68px]">
                Typical
              </div>
              <div className="mt-1 font-display text-[20px] font-semibold text-ink-2">for this county</div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ConfMeter level={h.confidence_label} />
              </div>
              <p className="mt-4 max-w-[480px] text-[15px] leading-[1.6] text-ink-2">
                {Math.round((h.county_tie_share ?? 0) * 100)}% of the locations we sampled in{" "}
                {countyName} score exactly the same as this one
                {femaZone ? <> (they share FEMA Zone {femaZone})</> : null}, so ranking it against
                them wouldn&apos;t tell you much. Use the absolute score below instead.
              </p>
              <div className="mt-6">
                <AbsoluteMeter score={h.composite_absolute} />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[14px] font-semibold text-ink-3">County percentile by {year}</div>
                  <div className="mt-2 flex items-start">
                    <span className="font-display text-[84px] font-extrabold leading-[0.85] tracking-[-4px] text-ink tabular-nums sm:text-[104px]">
                      {shown}
                    </span>
                    <span className="mt-1 ml-1 font-display text-[24px] font-bold text-ink-3">
                      {ordinalSuffix(shown)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <span
                    className="border-2 px-3 py-1 text-[13.5px] font-bold"
                    style={{ backgroundColor: band.soft, color: band.ink, borderColor: band.fill }}
                  >
                    {band.label} risk
                  </span>
                  <ConfMeter level={h.confidence_label} />
                </div>
              </div>
              <p className="mt-4 max-w-[460px] text-[15px] leading-[1.6] text-ink-2">
                Riskier than about <strong className="font-bold text-ink">{pct}%</strong> of the places
                we sampled in {countyName}. The middle of the county sits at 50.
              </p>
              <div className="mt-6">
                <PercentileScale percentile={pct} conf={h.confidence_label} />
              </div>
            </>
          )}

          <dl className="mt-6 grid grid-cols-3 divide-x divide-ink/15 border-y border-ink/15">
            <Stat label="Nationally" value={nat != null ? `${nat}${ordinalSuffix(nat)}` : "—"} />
            <Stat label="Raw score" value={`${Math.round(h.composite_absolute)}/100`} />
            <Stat label="FEMA / NOAA" value={`${Math.round(h.fema_component)} / ${Math.round(h.noaa_component)}`} />
          </dl>

          {h.confidence_drivers.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5">
              {h.confidence_drivers.map((d) => (
                <li key={d} className="flex gap-2 text-[14px] leading-[1.45] text-ink-2">
                  <WarnIcon size={14} className="mt-0.5 shrink-0 text-warn" />
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Trajectory */}
        <div className="border-t border-ink/15 p-5 sm:p-7 md:col-span-5 md:border-t-0">
          <div className="font-display text-[17px] font-bold text-ink">How it shifts over time</div>
          <Trajectory horizons={horizons} sel={sel} onSelect={setSel} />
          <p className="mt-3 text-[13px] leading-[1.55] text-ink-3">
            Tap a point to jump to that year. These are rankings within the
            county, so a flat line can still hide rising risk overall.
            {horizons.some(isTypicalForCounty) && " Hollow points are typical for the county."}
          </p>
        </div>
      </div>
    </div>
  );
}

// 0-100 composite, for horizons where a county ranking isn't meaningful.
function AbsoluteMeter({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  return (
    <div role="img" aria-label={`Absolute score ${Math.round(s)} out of 100`}>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-ink-2">Absolute flood score</span>
        <span className="font-display text-[18px] font-bold text-ink tabular-nums">
          {Math.round(s)}
          <span className="text-[13px] font-semibold text-ink-4">/100</span>
        </span>
      </div>
      <div className="mt-2 h-3 border border-ink bg-surface-2">
        <div
          className="h-full transition-[width] duration-700"
          style={{ width: `${s}%`, backgroundColor: riskColor(s).fill }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-ink-4">
        <span>Minimal hazard</span>
        <span>Severe hazard</span>
      </div>
    </div>
  );
}

function Trajectory({
  horizons,
  sel,
  onSelect,
}: {
  horizons: HorizonScore[];
  sel: number;
  onSelect: (i: number) => void;
}) {
  const W = 320;
  const H = 200;
  const pad = { l: 30, r: 18, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  // Inset the points so the first one doesn't sit on the y-axis labels.
  const inset = 22;
  const x = (i: number) => pad.l + inset + ((iw - 2 * inset) * i) / (horizons.length - 1);
  const y = (p: number) => pad.t + ih * (1 - p / 100);
  const pts = horizons.map((h, i) => ({ x: x(i), y: y(h.composite_county_percentile) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full" aria-hidden>
      {RISK_BANDS.map((b) => (
        <rect
          key={b.label}
          x={pad.l}
          width={iw}
          y={y(b.to)}
          height={y(b.from) - y(b.to)}
          fill={b.fill}
          opacity="0.16"
        />
      ))}
      {[0, 50, 100].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="#0f2430" strokeOpacity={t === 50 ? 0.35 : 0.15} strokeDasharray={t === 50 ? "3 3" : undefined} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fontFamily="var(--font-sans)" fill="#87979f">
            {t}
          </text>
        </g>
      ))}
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="#0f2430"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {horizons.map((h, i) => {
        const active = i === sel;
        return (
          <g key={h.horizon_years} onClick={() => onSelect(i)} className="cursor-pointer">
            <line x1={pts[i].x} x2={pts[i].x} y1={pad.t} y2={pad.t + ih} stroke="#0f2430" strokeOpacity={active ? 0.5 : 0} strokeDasharray="2 3" />
            {/* generous invisible hit area for touch */}
            <rect x={pts[i].x - 24} y={pad.t} width={48} height={ih} fill="transparent" />
            {isTypicalForCounty(h) ? (
              <circle
                cx={pts[i].x}
                cy={pts[i].y}
                r={active ? 8 : 6}
                fill={active ? "#fdf3dc" : "#eef2f1"}
                stroke="#5a6e7c"
                strokeWidth="2"
                strokeDasharray="3 2"
                style={{ transition: "all 0.25s ease" }}
              />
            ) : (
              <rect
                x={pts[i].x - (active ? 7 : 5)}
                y={pts[i].y - (active ? 7 : 5)}
                width={active ? 14 : 10}
                height={active ? 14 : 10}
                fill={active ? "#f2b544" : "#ffffff"}
                stroke="#0f2430"
                strokeWidth="2"
                style={{ transition: "all 0.25s ease" }}
              />
            )}
            <text
              x={pts[i].x}
              y={H - 8}
              textAnchor="middle"
              fontSize="12"
              fontFamily="var(--font-display)"
              fill={active ? "#0f2430" : "#87979f"}
              fontWeight={active ? 600 : 400}
            >
              +{h.horizon_years} yrs
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ConfMeter({ level }: { level: ConfidenceLevel }) {
  const filled = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <span className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
      <span className="flex gap-[3px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-2.5 w-2.5 border border-ink ${i < filled ? "bg-ink" : "bg-transparent"}`} />
        ))}
      </span>
      {level} confidence
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3 text-center first:pl-0 last:pr-0">
      <dt className="text-[12.5px] text-ink-4">{label}</dt>
      <dd className="mt-0.5 font-display text-[18px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
