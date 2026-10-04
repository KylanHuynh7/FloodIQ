"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Kicker, SiteHeader } from "@/components/chrome";
import { CheckIcon } from "@/components/icons";
import { apiUrl } from "@/lib/api";

type Step = "pending" | "running" | "done";
type ErrorKind = "notfound" | "unsupported" | "upstream" | "ratelimit" | "server";

const STEPS = [
  { label: "Finding the address", detail: "U.S. Census geocoder" },
  { label: "Reading the FEMA flood map", detail: "National Flood Hazard Layer" },
  { label: "Checking sea-level projections", detail: "NOAA sea-level rise, 2022" },
  { label: "Comparing with the county", detail: "Local baseline" },
] as const;

// Map backend responses to a user-facing error category. The backend
// returns the same 200 + `error` shape for every pipeline failure, so we
// key off the message text for the categories that need different copy.
function classify(status: number, message: string): ErrorKind {
  if (status === 429) return "ratelimit";
  if (status >= 500) return "server";
  const m = message.toLowerCase();
  if (m.includes("did not respond") || m.includes("try again")) return "upstream";
  if (m.includes("continental") || m.includes("sufficient public data")) return "unsupported";
  return "notfound";
}

function ScoringInner() {
  const router = useRouter();
  const params = useSearchParams();
  const address = params.get("address") ?? "";

  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!address.trim()) {
      router.replace("/");
      return;
    }

    const goError = (kind: ErrorKind, reason: string) => {
      const q = new URLSearchParams({ address, kind, reason });
      router.replace(`/error-page?${q.toString()}`);
    };

    fetch(apiUrl("/api/score"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
      .then(async (r) => {
        const text = await r.text();
        let data: { score_id?: string; error?: string; detail?: string } | null = null;
        try {
          data = JSON.parse(text);
        } catch {
          /* not JSON */
        }
        if (!r.ok) {
          const msg = data?.detail || data?.error || `HTTP ${r.status}`;
          goError(classify(r.status, msg), msg);
          return;
        }
        if (data?.error) {
          goError(classify(r.status, data.error), data.error);
          return;
        }
        if (data?.score_id) {
          router.replace(`/result/${data.score_id}`);
          return;
        }
        setError("The score was computed but couldn't be saved. Please try again.");
      })
      .catch(() =>
        goError("upstream", "Couldn't reach the FloodIQ server. Check your connection and try again."),
      );
  }, [address, router]);

  // Progress is time-based (the API is a single long call); the final step
  // stays "running" until the response actually arrives.
  const e = elapsed;
  const stepStates: Step[] = [
    e >= 1 ? "done" : "running",
    e < 1 ? "pending" : e >= 4 ? "done" : "running",
    e < 4 ? "pending" : e >= 7 ? "done" : "running",
    e < 7 ? "pending" : "running",
  ];
  const baselinePhase = elapsed >= 10;
  // Gauge fill: eases toward full but never claims to be done until the
  // response arrives (the API is one long call with no progress events).
  const fill = 1 - Math.exp(-elapsed / 14);

  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <a href="/" className="px-2 py-2 transition hover:text-ink">
            Cancel
          </a>
        }
      />
      <main className="contours min-h-[calc(100vh-56px)]">
        <div className="mx-auto w-full max-w-[760px] px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
          <Kicker>Checking this address</Kicker>
          <h1 className="mt-3 break-words font-display text-[26px] font-bold leading-[1.15] tracking-[-0.8px] text-ink sm:text-[34px]">
            {address || "—"}
          </h1>

          <section
            aria-live="polite"
            className="mt-8 grid border-[1.5px] border-ink bg-surface shadow-[6px_6px_0_0_#0f2430] sm:grid-cols-[120px_1fr]"
          >
            <TideGauge fill={fill} elapsed={elapsed} />
            <ol className="divide-y divide-ink/10 px-5 sm:px-6">
              {STEPS.map((s, i) => (
                <StatusStep key={s.label} {...s} index={i} state={stepStates[i]} />
              ))}
            </ol>
          </section>

          {error ? (
            <div className="mt-5 border-[1.5px] border-danger bg-danger-soft px-5 py-4 text-[14.5px] text-ink-2">
              <div className="font-semibold text-danger">Something went wrong</div>
              <p className="mt-1">{error}</p>
              <a href="/" className="mt-2 inline-block font-medium text-accent underline underline-offset-4">
                Try another address
              </a>
            </div>
          ) : (
            <div
              className={`mt-5 border-l-[3px] px-5 py-4 text-[14.5px] leading-[1.6] transition-colors ${
                baselinePhase ? "border-signal bg-signal-soft text-ink-2" : "border-ink/20 bg-surface/70 text-ink-3"
              }`}
            >
              {baselinePhase ? (
                <>
                  <div className="font-semibold text-ink">First lookup in this county</div>
                  <p className="mt-1">
                    We&apos;re scoring a sample of nearby Census tracts to build a
                    local comparison baseline. This happens once per county and
                    usually takes 30 seconds to 2 minutes. Later lookups are fast.
                  </p>
                </>
              ) : (
                <p>Most lookups finish in a few seconds.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TideGauge({ fill, elapsed }: { fill: number; elapsed: number }) {
  const mm = String(Math.floor(elapsed / 60));
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="relative flex h-24 items-end overflow-hidden border-b-[1.5px] border-ink bg-surface-2 sm:h-auto sm:min-h-[280px] sm:border-r-[1.5px] sm:border-b-0">
      {/* water column (vertical on desktop, horizontal on mobile) */}
      <div
        className="absolute inset-y-0 left-0 bg-water/80 transition-[width] duration-1000 ease-out sm:hidden"
        style={{ width: `${fill * 100}%` }}
      />
      <div
        className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-b from-water to-accent transition-[height] duration-1000 ease-out sm:block"
        style={{ height: `${fill * 100}%` }}
      >
        <svg className="absolute -top-[7px] left-0 h-2 w-[200%]" viewBox="0 0 240 8" preserveAspectRatio="none" style={{ animation: "floodiq-wave 3s linear infinite" }} aria-hidden>
          <path d="M0 4 q 15 -4 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 V 8 H 0 Z" fill="#3f8ea6" />
        </svg>
      </div>
      {/* staff ticks */}
      <div className="pointer-events-none absolute inset-y-3 right-3 hidden flex-col justify-between sm:flex" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={`h-px bg-ink/50 ${i % 2 ? "w-2" : "w-4"}`} />
        ))}
      </div>
      <div className="relative z-10 p-4">
        <div className="text-[13px] font-semibold text-ink-2">Elapsed</div>
        <div className="font-display text-[32px] font-bold leading-none tabular-nums text-ink">
          {mm}:{ss}
        </div>
      </div>
    </div>
  );
}

function StatusStep({
  label,
  detail,
  index,
  state,
}: {
  label: string;
  detail: string;
  index: number;
  state: Step;
}) {
  return (
    <li className="flex items-center gap-4 py-4">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center border-[1.5px] font-display text-[13px] font-bold transition-colors ${
          state === "done"
            ? "border-ink bg-ink text-white"
            : state === "running"
              ? "border-ink bg-signal text-ink"
              : "border-ink/25 text-ink-4"
        }`}
        aria-hidden
      >
        {state === "done" ? <CheckIcon size={13} /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[15px] font-medium ${state === "pending" ? "text-ink-4" : "text-ink"}`}>
          {label}
        </div>
        <div className="text-[13px] text-ink-4">{detail}</div>
      </div>
      {state === "running" && (
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-signal" aria-hidden />
      )}
      <span className="sr-only">
        {state === "done" ? "complete" : state === "running" ? "in progress" : "pending"}
      </span>
    </li>
  );
}

export default function ScoringPage() {
  return (
    <Suspense fallback={null}>
      <ScoringInner />
    </Suspense>
  );
}
