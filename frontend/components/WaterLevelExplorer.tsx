"use client";

import { useEffect, useState } from "react";

// Illustrative coastal cross-section. Visitors step through the three
// horizons and watch the water line climb toward a house. Deliberately
// unitless: it explains the idea of horizons, not anyone's real data.

const W = 480;
const H = 260;

// Ground profile: low shoreline on the left rising to a bluff with a house.
const GROUND =
  "M0 205 C 60 205, 90 200, 130 192 S 210 170, 250 160 S 320 138, 360 132 L 480 128 L 480 260 L 0 260 Z";

const LEVELS = [
  { h: 10, y: 196, note: "Water stays below the shoreline." },
  { h: 30, y: 178, note: "Higher tides reach the low ground." },
  { h: 100, y: 134, note: "Flooding can reach the house itself." },
] as const;

export function WaterLevelExplorer() {
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % LEVELS.length), 2600);
    return () => clearInterval(id);
  }, [auto]);

  const level = LEVELS[idx];
  const wave = (y: number) =>
    `M0 ${y} q 30 -6 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 V ${H} H 0 Z`;

  return (
    <figure className="border-[1.5px] border-ink bg-surface shadow-[6px_6px_0_0_#0f2430]">
      <div className="flex items-center justify-between border-b border-ink/15 px-4 py-2.5">
        <figcaption className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
          Why three horizons
        </figcaption>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-4">
          Illustration
        </span>
      </div>

      <div className="relative overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Illustration: water level by ${year + level.h}. ${level.note}`}>
          <defs>
            <linearGradient id="wl-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6f9f8" />
              <stop offset="1" stopColor="#e7eeec" />
            </linearGradient>
            <linearGradient id="wl-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3f8ea6" stopOpacity="0.85" />
              <stop offset="1" stopColor="#0f5e6e" />
            </linearGradient>
            <pattern id="wl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0v6" stroke="#0f2430" strokeOpacity="0.12" strokeWidth="1.5" />
            </pattern>
          </defs>

          <rect width={W} height={H} fill="url(#wl-sky)" />

          {/* depth ruler */}
          <g fontFamily="var(--font-mono)" fontSize="9" fill="#87979f">
            {[130, 150, 170, 190, 210].map((y) => (
              <g key={y}>
                <line x1={W - 18} x2={W - 8} y1={y} y2={y} stroke="#9caeb1" />
              </g>
            ))}
            <line x1={W - 8} x2={W - 8} y1={120} y2={220} stroke="#9caeb1" />
          </g>

          {/* water, animated by translating the whole group */}
          <g
            style={{
              transform: `translateY(${level.y - 196}px)`,
              transition: "transform 1.1s cubic-bezier(0.3, 0.7, 0.2, 1)",
            }}
          >
            <g style={{ animation: "wl-drift 4s linear infinite" }}>
              <path d={wave(196)} fill="url(#wl-water)" />
            </g>
            <line x1="0" x2={W} y1="196" y2="196" stroke="#f2b544" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x="10" y="190" fontFamily="var(--font-mono)" fontSize="10.5" fill="#0f2430" fontWeight="500">
              {year + level.h}
            </text>
          </g>

          {/* ground drawn over the water so the water reads as "behind" the shore */}
          <path d={GROUND} fill="#d7dfd6" />
          <path d={GROUND} fill="url(#wl-hatch)" />
          <path
            d="M0 205 C 60 205, 90 200, 130 192 S 210 170, 250 160 S 320 138, 360 132 L 480 128"
            fill="none"
            stroke="#0f2430"
            strokeWidth="1.5"
          />

          {/* house */}
          <g transform="translate(372 92)">
            <rect x="0" y="16" width="44" height="24" fill="#ffffff" stroke="#0f2430" strokeWidth="1.5" />
            <path d="M-4 18 L22 0 L48 18" fill="none" stroke="#0f2430" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x="18" y="26" width="9" height="14" fill="#0f2430" />
            <rect x="5" y="22" width="8" height="7" fill="#cde4ea" stroke="#0f2430" />
            <rect x="31" y="22" width="8" height="7" fill="#cde4ea" stroke="#0f2430" />
          </g>
        </svg>
      </div>

      <div className="border-t border-ink/15 p-3 sm:p-4">
        <div role="tablist" aria-label="Time horizon" className="grid grid-cols-3 divide-x-[1.5px] divide-ink border-[1.5px] border-ink">
          {LEVELS.map((l, i) => {
            const active = i === idx;
            return (
              <button
                key={l.h}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setAuto(false);
                  setIdx(i);
                }}
                className={`relative min-h-[44px] px-2 py-2 text-left transition-colors ${
                  active ? "bg-ink text-white" : "bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                <div className="font-display text-[15px] font-bold leading-none">+{l.h}y</div>
                <div className={`mt-1 font-mono text-[10.5px] ${active ? "text-white/70" : "text-ink-4"}`}>
                  {year + l.h}
                </div>
                {active && auto && (
                  <span
                    key={idx}
                    className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-signal"
                    style={{ animation: "wl-progress 2.6s linear both" }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 min-h-[2.6em] text-[13.5px] leading-[1.45] text-ink-2" aria-live="polite">
          {level.note} FloodIQ scores every address at all three horizons.
        </p>
      </div>
      <style>{`@keyframes wl-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } } @keyframes wl-drift { to { transform: translateX(-120px) } }`}</style>
    </figure>
  );
}
