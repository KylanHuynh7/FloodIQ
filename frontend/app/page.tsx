"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowIcon } from "@/components/icons";

function HorizonChip({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex-1 min-w-0 border border-ink bg-surface px-2.5 py-2.5">
      <div className="font-sans text-[18px] font-semibold leading-none tracking-[-0.5px] text-ink">
        {label}
      </div>
      <div className="mt-1 font-mono text-[9px] font-medium tracking-[0.8px] text-ink-3">
        {sub}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [addr, setAddr] = useState("");
  const canSubmit = addr.trim().length > 4;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    router.push(`/score?address=${encodeURIComponent(addr.trim())}`);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-paper pb-12 lg:max-w-[1200px] lg:pb-24">
      <header className="flex items-baseline justify-between px-5 pt-3 font-mono text-[11px] font-semibold tracking-[1.6px] text-ink lg:px-12 lg:pt-8 lg:text-[12px]">
        <span>FLOODIQ</span>
        <span className="text-[10px] font-medium text-ink-3 lg:text-[11px]">
          METHOD V1.1
        </span>
      </header>

      {/* Hero — single column on mobile, 12-col grid on desktop */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pt-20">
        <section className="px-5 pt-10 pb-2 lg:col-span-7 lg:px-0 lg:pt-0">
          <div className="mb-3.5 font-mono text-[10px] font-semibold tracking-[1.6px] text-signal lg:mb-5 lg:text-[11px] lg:tracking-[2px]">
            FLOOD-RISK SCORING
          </div>
          <h1 className="font-sans text-[32px] font-medium leading-[1.05] tracking-[-1.5px] text-ink text-balance lg:text-[56px] lg:leading-[1.02] lg:tracking-[-2.5px]">
            How exposed is your address to flooding — now and through 2125?
          </h1>
          <p className="mt-3.5 font-sans text-[14px] leading-[1.5] text-ink-2 text-pretty lg:mt-6 lg:max-w-[520px] lg:text-[17px] lg:leading-[1.55]">
            FloodIQ scores any U.S. residential address against FEMA flood maps
            and NOAA sea-level projections across three time horizons.
          </p>
        </section>

        <section className="px-5 pt-6 pb-1.5 lg:col-span-5 lg:px-0 lg:pt-0">
          <label
            htmlFor="addr"
            className="mb-1.5 block font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:text-[11px] lg:tracking-[1.6px]"
          >
            U.S. STREET ADDRESS
          </label>
          <form
            onSubmit={onSubmit}
            className="flex border border-ink bg-surface"
          >
            <input
              id="addr"
              name="address"
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="123 Main St, Charleston, SC"
              maxLength={200}
              aria-label="U.S. street address"
              className="min-w-0 flex-1 border-none bg-transparent px-3.5 py-3.5 font-sans text-[15px] font-medium tracking-[-0.2px] text-ink outline-none placeholder:text-ink-3 lg:px-4 lg:py-4 lg:text-[16px]"
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex items-center gap-1.5 border-l border-ink px-4 font-mono text-[11px] font-semibold tracking-[1.2px] lg:px-5 lg:text-[12px] ${
                canSubmit
                  ? "cursor-pointer bg-ink text-surface"
                  : "cursor-not-allowed bg-surface-alt text-ink-3"
              }`}
            >
              SCORE <ArrowIcon size={13} />
            </button>
          </form>
          <p className="mt-2 font-mono text-[10px] leading-[1.4] tracking-[0.4px] text-ink-3 lg:mt-3 lg:text-[11px]">
            Residential addresses only. First lookup in a new county takes ~30 s.
          </p>

          <div className="pt-7 lg:pt-10">
            <div className="mb-2.5 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink-3 lg:text-[11px] lg:tracking-[1.6px]">
              WHAT YOU&apos;LL GET
            </div>
            <div className="flex gap-2">
              <HorizonChip label="+10y" sub="BY 2036" />
              <HorizonChip label="+30y" sub="BY 2056" />
              <HorizonChip label="+100y" sub="BY 2125" />
            </div>
            <p className="mt-3 font-sans text-[13px] leading-[1.5] text-ink-2 lg:mt-4 lg:text-[14px]">
              A county percentile, a national percentile, and a confidence
              label — for each horizon. Plus a 3-page PDF report.
            </p>
          </div>
        </section>
      </div>

      {/* Supporting zone — single column on mobile, 2-col on desktop */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:px-12 lg:pt-16">
        <section className="mx-5 mt-6 border border-ink bg-surface px-3.5 py-3.5 lg:mx-0 lg:mt-0 lg:px-5 lg:py-5">
          <div className="mb-2 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:mb-3 lg:text-[11px] lg:tracking-[1.6px]">
            EDUCATIONAL TOOL — NOT INSURANCE
          </div>
          <ul className="flex flex-col gap-1 font-sans text-[12px] leading-[1.55] text-ink-2 lg:gap-2 lg:text-[14px]">
            {[
              "Not flood-insurance underwriting",
              "Not an official FEMA flood-map reading",
              "Not a substitute for professional flood assessment",
            ].map((line) => (
              <li key={line} className="grid grid-cols-[14px_1fr] gap-1.5">
                <span className="font-mono text-ink-3">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <a
          href="#methodology"
          className="mx-5 mt-3 flex items-center justify-between border border-dashed border-line px-3.5 py-3 lg:mx-0 lg:mt-0 lg:px-5 lg:py-5"
        >
          <div>
            <div className="font-sans text-[13px] font-medium text-ink lg:text-[15px]">
              Read the methodology
            </div>
            <div className="mt-0.5 font-mono text-[10px] tracking-[0.3px] text-ink-3 lg:mt-1 lg:text-[11px]">
              V1.1 · HOW THE SCORE IS BUILT
            </div>
          </div>
          <ArrowIcon size={14} />
        </a>
      </div>

      <footer className="px-5 pt-5 font-mono text-[10px] leading-[1.6] tracking-[0.4px] text-ink-3 lg:px-12 lg:pt-16 lg:text-[11px]">
        <div className="mb-1 font-semibold tracking-[1.2px] text-ink lg:mb-2 lg:tracking-[1.6px]">
          SOURCES
        </div>
        FEMA National Flood Hazard Layer · NOAA Sea Level Rise V2022
      </footer>
    </main>
  );
}
