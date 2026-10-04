"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AddressForm, SiteFooter, SiteHeader } from "@/components/chrome";
import { WarnIcon } from "@/components/icons";

type Kind = "notfound" | "unsupported" | "upstream" | "ratelimit" | "server";

const COPY: Record<Kind, { eyebrow: string; title: string; retry: boolean }> = {
  notfound: {
    eyebrow: "Address not found",
    title: "We couldn't match that address.",
    retry: false,
  },
  unsupported: {
    eyebrow: "Not covered",
    title: "We can't score this location yet.",
    retry: false,
  },
  upstream: {
    eyebrow: "Data source unavailable",
    title: "A federal data source didn't respond.",
    retry: true,
  },
  ratelimit: {
    eyebrow: "Too many requests",
    title: "Slow down a moment.",
    retry: true,
  },
  server: {
    eyebrow: "Server error",
    title: "Something went wrong on our end.",
    retry: true,
  },
};

const CAUSES: Array<[string, string]> = [
  ["Missing city or state", "Use the full form: 123 Main St, Charleston, SC 29401."],
  ["Apartment or unit numbers", "FloodIQ scores buildings, so drop the unit."],
  ["PO boxes", "They have no geographic location."],
  ["Non-U.S. addresses", "FEMA and NOAA data cover the U.S. only."],
  ["Very new construction", "It may not be in the Census address database yet."],
];

function ErrorInner() {
  const params = useSearchParams();
  const badInput = params.get("address") ?? "";
  const kindParam = params.get("kind") as Kind | null;
  const kind: Kind = kindParam && kindParam in COPY ? kindParam : "notfound";
  const reason =
    kind === "ratelimit"
      ? "You've made several lookups in the last minute. Wait about a minute, then try again."
      : (params.get("reason") ?? "");
  const copy = COPY[kind];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="contours border-b border-ink/10">
        <div className="mx-auto grid w-full max-w-[1160px] gap-10 px-4 pt-10 pb-14 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-14">
          <section className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 border-[1.5px] border-ink bg-signal px-3 py-1 text-[13px] font-semibold text-ink">
              <WarnIcon size={13} />
              {copy.eyebrow}
            </div>
            <h1 className="mt-5 font-display text-[34px] font-bold leading-[1.05] tracking-[-1.2px] text-ink text-balance sm:text-[48px] sm:tracking-[-1.8px]">
              {copy.title}
            </h1>
            {badInput && (
              <p className="mt-5 text-[15px] text-ink-3">
                You searched for{" "}
                <span className="break-words border-b-2 border-signal font-medium text-ink">{badInput}</span>
              </p>
            )}
            {reason && (
              <p className="mt-3 max-w-[560px] text-[15px] leading-[1.6] text-ink-2 text-pretty">
                {reason}
              </p>
            )}

            {kind === "notfound" && (
              <div className="mt-8 border-[1.5px] border-ink bg-surface">
                <h2 className="border-b border-ink/15 px-5 py-3 font-display text-[16px] font-bold text-ink">
                  Common causes
                </h2>
                <ul className="divide-y divide-ink/10">
                  {CAUSES.map(([k, v]) => (
                    <li key={k} className="px-5 py-3 text-[14.5px] leading-[1.5]">
                      <span className="font-medium text-ink">{k}.</span>{" "}
                      <span className="text-ink-3">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="lg:col-span-5 lg:pt-14">
            {copy.retry && badInput && (
              <a
                href={`/score?address=${encodeURIComponent(badInput)}`}
                className="mb-6 flex h-[52px] items-center justify-center border-[1.5px] border-ink bg-ink text-[15px] font-semibold text-white transition hover:bg-accent-deep"
              >
                Try again
              </a>
            )}
            <div className="mb-2 text-[14px] font-semibold text-ink-2">
              {copy.retry ? "Or try a different address" : "Try another address"}
            </div>
            <AddressForm label="Retry U.S. street address" />
            <a href="/" className="mt-5 inline-flex min-h-[44px] items-center text-[14.5px] font-medium text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-signal">
              ← Back to home
            </a>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorInner />
    </Suspense>
  );
}
