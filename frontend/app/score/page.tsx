"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

type Step = "pending" | "running" | "done";

const STEPS = ["Geocode address", "FEMA flood map", "NOAA sea-level", "County baseline"] as const;

function ScoringInner() {
  const router = useRouter();
  const params = useSearchParams();
  const address = params.get("address") ?? "";

  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Tick elapsed seconds.
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Kick the score call once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!address) {
      setError("No address provided.");
      return;
    }

    const goError = (reason: string) => {
      router.replace(
        `/error-page?address=${encodeURIComponent(address)}&reason=${encodeURIComponent(reason)}`,
      );
    };

    fetch("/api/score", {
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
          goError(data?.detail || data?.error || text || `HTTP ${r.status}`);
          return;
        }
        if (!data) {
          setError("Unexpected response from server.");
          return;
        }
        if (data.error) {
          goError(data.error);
          return;
        }
        if (data.score_id) {
          router.replace(`/result/${data.score_id}`);
          return;
        }
        setError("Could not save result.");
      })
      .catch((err) => setError(`Network error: ${err?.message ?? err}`));
  }, [address, router]);

  // Derive step states from elapsed.
  const stepStates: Step[] = (() => {
    if (error) return ["done", "done", "done", "done"];
    const e = elapsed;
    return [
      e >= 1 ? "done" : "running",
      e < 1 ? "pending" : e >= 4 ? "done" : "running",
      e < 4 ? "pending" : e >= 7 ? "done" : "running",
      e < 7 ? "pending" : "running",
    ];
  })();

  const baselinePhase = elapsed >= 8 && !error;
  const doneCount = stepStates.filter((s) => s === "done").length;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-paper pb-12 lg:max-w-[760px] lg:pb-24">
      <header className="flex items-baseline justify-between px-5 pt-3 font-mono text-[11px] font-semibold tracking-[1.6px] text-ink lg:px-10 lg:pt-8 lg:text-[12px]">
        <span>
          FLOODIQ <span className="text-ink-3">▸ SCORING</span>
        </span>
        <a href="/" className="text-[10px] font-medium text-ink-3 underline-offset-4 hover:underline lg:text-[11px]">
          CANCEL
        </a>
      </header>

      <section className="px-5 pt-10 pb-2 lg:px-10 lg:pt-16">
        <div className="mb-3.5 font-mono text-[10px] font-semibold tracking-[1.6px] text-ink-3 lg:text-[11px] lg:tracking-[2px]">
          SCORING ADDRESS
        </div>
        <h1 className="font-sans text-[19px] font-medium leading-[1.25] tracking-[-0.5px] text-ink lg:text-[24px] lg:tracking-[-0.8px]">
          {address || "—"}
        </h1>
      </section>

      {/* Elapsed block */}
      <section className="mx-5 mt-6 grid grid-cols-[auto_1fr] items-end gap-6 border border-ink bg-surface px-4 py-4 lg:mx-10 lg:mt-8 lg:px-6 lg:py-6">
        <div>
          <div className="mb-1 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink-3 lg:text-[11px]">
            ELAPSED
          </div>
          <div className="font-mono text-[44px] font-semibold leading-none tracking-[-1px] text-ink tabular-nums lg:text-[56px]">
            {mm}:{ss}
          </div>
        </div>
        <BarSpinner />
      </section>

      {/* Pipeline card */}
      <section className="mx-5 mt-3 border border-ink bg-surface px-4 py-4 lg:mx-10 lg:px-6 lg:py-6">
        <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:text-[11px]">
          <span>PIPELINE</span>
          <span className="text-ink-3">
            {doneCount} / {STEPS.length}
          </span>
        </div>
        <ul className="flex flex-col">
          {STEPS.map((label, i) => (
            <StatusStep key={label} label={label} state={stepStates[i]} />
          ))}
        </ul>
      </section>

      {/* Message box */}
      <section
        className={`mx-5 mt-3 border border-ink bg-surface px-4 py-3.5 lg:mx-10 ${
          baselinePhase ? "border-l-[3px] border-l-signal" : "border-l-[3px] border-l-ink"
        }`}
      >
        {error ? (
          <>
            <div className="mb-1 font-mono text-[10px] font-semibold tracking-[1.4px] text-signal lg:text-[11px]">
              ERROR
            </div>
            <div className="font-sans text-[14px] leading-[1.5] text-ink-2">{error}</div>
            <a
              href="/"
              className="mt-2 inline-block font-mono text-[11px] font-medium tracking-[0.6px] text-ink underline underline-offset-4"
            >
              ← Try another address
            </a>
          </>
        ) : !baselinePhase ? (
          <>
            <div className="mb-1 font-mono text-[10px] font-semibold tracking-[1.4px] text-ink lg:text-[11px]">
              WORKING
            </div>
            <div className="font-sans text-[14px] leading-[1.5] text-ink-2">
              Looking up FEMA flood data for this address. This usually takes a few seconds.
            </div>
          </>
        ) : (
          <>
            <div className="mb-1 font-mono text-[10px] font-semibold tracking-[1.4px] text-signal lg:text-[11px]">
              FIRST LOOKUP IN THIS AREA
            </div>
            <div className="font-sans text-[14px] leading-[1.5] text-ink-2">
              Building a county comparison baseline. One-time per county, instant after that. Expect 30 s – 3 min.
            </div>
          </>
        )}
      </section>

      <div className="mt-8 text-center">
        <a
          href="/"
          className="inline-block border-b border-ink pb-0.5 font-sans text-[13px] font-medium text-ink"
        >
          ← Cancel and go back
        </a>
      </div>
    </main>
  );
}

function StatusStep({ label, state }: { label: string; state: Step }) {
  const glyph = state === "done" ? "✓" : state === "running" ? "◐" : "○";
  return (
    <li className="grid grid-cols-[22px_1fr] items-center gap-2 border-b border-line-soft py-2.5 last:border-b-0">
      <span
        className={`font-mono text-[14px] leading-none ${
          state === "pending" ? "text-ink-3 opacity-60" : "text-ink"
        } ${state === "running" ? "animate-[spin_2.4s_linear_infinite]" : ""}`}
        aria-hidden
      >
        {glyph}
      </span>
      <span
        className={`font-sans text-[13px] leading-[1.4] ${
          state === "pending" ? "text-ink-3" : "text-ink-2"
        }`}
      >
        {label}
      </span>
    </li>
  );
}

function BarSpinner() {
  return (
    <div className="flex h-6 items-end justify-end gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-full w-1 origin-bottom bg-ink"
          style={{
            animation: "floodiq-pulse 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes floodiq-pulse {
          0%, 100% { transform: scaleY(0.3); opacity: 0.45; }
          50%      { transform: scaleY(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function ScoringPage() {
  return (
    <Suspense fallback={null}>
      <ScoringInner />
    </Suspense>
  );
}
