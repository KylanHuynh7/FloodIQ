"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowIcon } from "@/components/icons";
import { METHODOLOGY_URL } from "@/lib/tokens";

// Mark: a tide-gauge staff, with graduated ticks and a water line.
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <rect x="0.5" y="0.5" width="25" height="25" fill="#0f2430" />
      <path d="M8 5v16" stroke="#eef2f1" strokeWidth="1.5" />
      <path d="M8 6h4M8 9h2.5M8 12h4M8 15h2.5" stroke="#eef2f1" strokeWidth="1.2" />
      <path
        d="M3 18.2c1.5 0 1.5-1.2 3-1.2s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 2-1.2"
        stroke="#f2b544"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1160px] items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 font-display text-[17px] font-bold tracking-[-0.3px] text-ink"
        >
          <span className="transition-transform duration-300 group-hover:-rotate-6">
            <Logo />
          </span>
          FloodIQ
        </Link>
        <nav className="flex items-center gap-1 text-[13.5px] font-medium text-ink-2">
          {right ?? (
            <a
              href={METHODOLOGY_URL}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-2 underline decoration-transparent underline-offset-[6px] transition hover:text-ink hover:decoration-signal hover:decoration-2"
            >
              Methodology
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ version = "1.2" }: { version?: string }) {
  return (
    <footer className="mt-20 bg-ink text-white/70">
      <div className="mx-auto grid w-full max-w-[1160px] gap-6 px-4 py-10 text-[13px] leading-[1.65] sm:px-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="flex items-center gap-2.5 font-display text-[15px] font-bold text-white">
            <Logo size={20} />
            FloodIQ
          </div>
          <p className="mt-3 max-w-[520px]">
            An educational tool. Not flood-insurance underwriting, not an official
            FEMA flood-map determination, and not a substitute for a professional
            flood assessment.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] md:col-span-5">
          <div>
            <dt className="text-white/45">Hazard</dt>
            <dd className="text-white/80">FEMA NFHL</dd>
          </div>
          <div>
            <dt className="text-white/45">Sea level</dt>
            <dd className="text-white/80">NOAA SLR 2022</dd>
          </div>
          <div>
            <dt className="text-white/45">Geocoding</dt>
            <dd className="text-white/80">U.S. Census · OSM</dd>
          </div>
          <div>
            <dt className="text-white/45">Method</dt>
            <dd>
              <a
                href={METHODOLOGY_URL}
                target="_blank"
                rel="noreferrer"
                className="-my-2 inline-flex min-h-[44px] min-w-[44px] items-center text-white/80 underline decoration-white/30 underline-offset-4 hover:decoration-signal"
              >
                v{version}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </footer>
  );
}

export function AddressForm({
  autoFocus = false,
  label = "U.S. street address",
}: {
  autoFocus?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [addr, setAddr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = addr.trim().length > 4 && !submitting;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    router.push(`/score?address=${encodeURIComponent(addr.trim())}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="w-full">
      <label htmlFor="addr" className="sr-only">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
        <div className="relative min-w-0 flex-1">
          <input
            id="addr"
            name="address"
            type="text"
            inputMode="text"
            autoComplete="street-address"
            autoFocus={autoFocus}
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="123 Main St, Charleston, SC 29401"
            maxLength={200}
            /* 16px minimum so iOS Safari doesn't zoom the page on focus */
            className="peer h-[52px] w-full border-2 border-ink bg-surface px-4 text-[16px] text-ink shadow-[3px_3px_0_0_#0f2430] outline-none transition-shadow placeholder:text-ink-4 focus:shadow-[3px_3px_0_0_#f2b544] focus-visible:outline-none sm:border-r-0 sm:shadow-none sm:focus:shadow-none"
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[3px] origin-left scale-x-0 bg-signal transition-transform duration-300 peer-focus:scale-x-100 sm:block" />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`group flex h-[52px] shrink-0 items-center justify-center gap-2 border-2 px-5 text-[15px] font-semibold transition ${
            canSubmit
              ? "cursor-pointer border-ink bg-ink text-white hover:bg-accent-deep"
              : "cursor-not-allowed border-ink bg-surface-2 text-ink-4"
          }`}
        >
          {submitting ? "Starting…" : "Check flood risk"}
          <ArrowIcon
            size={15}
            className={canSubmit ? "transition-transform group-hover:translate-x-0.5" : undefined}
          />
        </button>
      </div>
    </form>
  );
}

// Section marker: a little wave and a sentence-case label in the accent.
export function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-[14px] font-semibold text-accent ${className}`}>
      <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden className="shrink-0">
        <path
          d="M1 4c2 0 2-2.5 4-2.5S7 4 9 4s2-2.5 4-2.5S15 4 17 4"
          stroke="#f2b544"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {children}
    </div>
  );
}
