"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowIcon, WarnIcon } from "@/components/icons";

const CAUSES: Array<[string, string]> = [
  ["Apartments + units", "FloodIQ scores buildings, not unit numbers."],
  ["PO boxes", "No geographic coordinates."],
  ["Commercial properties", "Residential addresses only."],
  ["Non-U.S. addresses", "FEMA data is U.S.-only."],
  [
    "Misspellings or missing details",
    "Try including city + state.",
  ],
];

function ErrorInner() {
  const router = useRouter();
  const params = useSearchParams();
  const badInput = params.get("address") ?? "";
  const reason = params.get("reason") ?? "didn't resolve to a U.S. residential address.";

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
        <a href="/" className="text-ink">FLOODIQ</a>
        <span className="text-[10px] font-medium text-ink-3 lg:text-[11px]">
          METHOD V1.1
        </span>
      </header>

      <div className="lg:grid lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pt-16">
        <section className="px-5 pt-10 lg:col-span-7 lg:px-0 lg:pt-0">
          <div className="mb-3.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[1.6px] text-signal lg:text-[11px] lg:tracking-[2px]">
            <WarnIcon size={12} />
            ADDRESS NOT FOUND
          </div>
          <h1 className="font-sans text-[30px] font-medium leading-[1.08] tracking-[-1.2px] text-ink text-balance lg:text-[48px] lg:tracking-[-2px]">
            We couldn&apos;t match that address.
          </h1>
          {badInput && (
            <p className="mt-3 font-sans text-[14px] leading-[1.5] text-ink-2 text-pretty lg:mt-5 lg:text-[16px]">
              <span className="inline-block border border-line bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink lg:text-[13px]">
                {badInput}
              </span>{" "}
              {reason}
            </p>
          )}

          <section className="mt-6 border border-ink bg-surface px-4 py-4 lg:mt-8 lg:px-5 lg:py-5">
            <div className="mb-2.5 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:text-[11px] lg:tracking-[1.6px]">
              COMMON CAUSES
            </div>
            <ul className="flex flex-col gap-1.5 font-sans text-[13px] leading-[1.55] text-ink-2 lg:gap-2 lg:text-[14px]">
              {CAUSES.map(([k, v]) => (
                <li key={k} className="grid grid-cols-[14px_1fr] gap-2">
                  <span className="font-mono text-ink-3">·</span>
                  <span>
                    <b className="font-medium text-ink">{k}.</b>{" "}
                    <span className="text-ink-3">{v}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </section>

        <section className="px-5 pt-6 lg:col-span-5 lg:px-0 lg:pt-0">
          <label
            htmlFor="addr"
            className="mb-1.5 block font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:text-[11px] lg:tracking-[1.6px]"
          >
            TRY ANOTHER ADDRESS
          </label>
          <form onSubmit={onSubmit} className="flex border border-ink bg-surface">
            <input
              id="addr"
              name="address"
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="123 Main St, Charleston, SC"
              maxLength={200}
              aria-label="Retry U.S. street address"
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

          <a
            href="/"
            className="mt-4 flex items-center justify-between border border-dashed border-line px-3.5 py-3 lg:mt-6 lg:px-5 lg:py-4"
          >
            <div className="font-sans text-[13px] font-medium text-ink lg:text-[15px]">
              ← Back to home
            </div>
            <div className="font-mono text-[10px] tracking-[0.3px] text-ink-3 lg:text-[11px]">
              FLOODIQ /
            </div>
          </a>

          <div className="mt-6 font-mono text-[10px] leading-[1.6] tracking-[0.4px] text-ink-3 lg:mt-8 lg:text-[11px]">
            <div className="mb-1 font-semibold tracking-[1.2px] text-ink lg:tracking-[1.6px]">
              SUPPORT
            </div>
            If you believe this address should score and doesn&apos;t, report it via the methodology page.
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorInner />
    </Suspense>
  );
}
