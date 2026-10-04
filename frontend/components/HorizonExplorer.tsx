"use client";

import { useEffect, useRef, useState } from "react";
import { WarnIcon } from "@/components/icons";
import { PercentileScale } from "@/components/PercentileScale";
import {
  ConfidenceLevel,
  HorizonScore,
  RISK_BANDS,
  horizonYear,
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
}: {
  horizons: HorizonScore[];
  scoredAt: string;
  countyName: string;
}) {
  const [sel, setSel] = useState(0);
  const h = horizons[sel];
  const pct = Math.round(h.composite_county_percentile);
  const band = riskColor(pct);
  const shown = Math.round(useCountUp(pct));
  const nat = h.composite_national_percentile != null ? Math.round(h.composite_national_percentile) : null;

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
    <div className="border-[1.5px] border-ink bg-surface shadow-[6px_6px_0_0_#0f2430]">
      <div
        role="tablist"
        aria-label="Time horizon"
        onKeyDown={onKey}
        className="grid grid-cols-3 divide-x-[1.5px] divide-ink border-b-[1.5px] border-ink"
      >
        {horizons.map((hz, i) => {
          const active = i === sel;
          const p = Math.round(hz.composite_county_percentile);
          return (
            <button
              key={hz.horizon_years}
              role="tab"
              id={`hz-tab-${i}`}
              aria-selected={active}
              aria-controls="hz-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setSel(i)}
              className={`group relative min-h-[60px] px-3 py-2.5 text-left transition-colors sm:px-5 ${
                active ? "bg-ink text-white" : "bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[16px] font-bold leading-none sm:text-[18px]">
                  +{hz.horizon_years}y
                </span>
                <span className={`font-mono text-[12px] tabular-nums ${active ? "text-signal" : "text-ink-3"}`}>
                  {p}
                  <span className="hidden sm:inline">{ordinalSuffix(p)}</span>
                </span>
              </div>
              <div className={`mt-1 font-mono text-[10.5px] ${active ? "text-white/60" : "text-ink-4"}`}>
                by {horizonYear(scoredAt, hz.horizon_years)}
              </div>
              <span
                className="absolute inset-x-0 bottom-0 h-[3px]"
                style={{ backgroundColor: riskColor(p).fill }}
              />
            </button>
          );
        })}
      </div>

      <div id="hz-panel" role="tabpanel" aria-labelledby={`hz-tab-${sel}`} className="grid md:grid-cols-12">
        {/* Readout */}
        <div className="p-5 sm:p-7 md:col-span-7 md:border-r md:border-ink/15">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                County percentile · by {horizonYear(scoredAt, h.horizon_years)}
              </div>
              <div className="mt-2 flex items-start">
                <span className="font-display text-[84px] font-bold leading-[0.85] tracking-[-4px] text-ink tabular-nums sm:text-[104px]">
                  {shown}
                </span>
                <span className="mt-1 ml-1 font-display text-[24px] font-bold text-ink-3">
                  {ordinalSuffix(shown)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span
                className="border-[1.5px] px-2.5 py-1 font-mono text-[11.5px] font-medium uppercase tracking-[0.1em]"
                style={{ backgroundColor: band.soft, color: band.ink, borderColor: band.fill }}
              >
                {band.label} risk
              </span>
              <ConfMeter level={h.confidence_label} />
            </div>
          </div>

          <p className="mt-4 max-w-[460px] text-[14.5px] leading-[1.55] text-ink-2">
            Ranks at the <strong className="font-semibold text-ink">{pct}{ordinalSuffix(pct)} percentile</strong>{" "}
            among sampled homes in {countyName}, where the 50th is the county median.
          </p>

          <div className="mt-6">
            <PercentileScale percentile={pct} conf={h.confidence_label} />
          </div>

          <dl className="mt-6 grid grid-cols-3 divide-x divide-ink/15 border-y border-ink/15">
            <Stat label="National" value={nat != null ? `${nat}${ordinalSuffix(nat)}` : "—"} />
            <Stat label="Raw score" value={`${Math.round(h.composite_absolute)}/100`} />
            <Stat label="FEMA · NOAA" value={`${Math.round(h.fema_component)} · ${Math.round(h.noaa_component)}`} />
          </dl>

          {h.confidence_drivers.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5">
              {h.confidence_drivers.map((d) => (
                <li key={d} className="flex gap-2 text-[13.5px] leading-[1.45] text-ink-2">
                  <WarnIcon size={14} className="mt-0.5 shrink-0 text-warn" />
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Trajectory */}
        <div className="border-t border-ink/15 p-5 sm:p-7 md:col-span-5 md:border-t-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
            Trajectory
          </div>
          <Trajectory horizons={horizons} sel={sel} onSelect={setSel} />
          <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-3">
            Select a point or tab to compare horizons. Percentiles are relative
            to the county, so a flat line can still mean rising absolute risk.
          </p>
        </div>
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
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="#87979f">
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
            <text
              x={pts[i].x}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fontFamily="var(--font-mono)"
              fill={active ? "#0f2430" : "#87979f"}
              fontWeight={active ? 600 : 400}
            >
              +{h.horizon_years}y
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
    <span className="flex items-center gap-2 font-mono text-[11px] text-ink-3">
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
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-4">{label}</dt>
      <dd className="mt-1 font-display text-[17px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
