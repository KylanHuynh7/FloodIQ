import { AddressForm, Kicker, SiteFooter, SiteHeader } from "@/components/chrome";
import { ArrowIcon } from "@/components/icons";
import { WaterLevelExplorer } from "@/components/WaterLevelExplorer";
import { METHODOLOGY_URL } from "@/lib/tokens";

const EXAMPLES = [
  { label: "The White House, DC", address: "1600 Pennsylvania Ave NW, Washington, DC 20500" },
  { label: "East Bay St, Charleston", address: "100 East Bay St, Charleston, SC 29401" },
];

const STEPS = [
  {
    n: "01",
    title: "Locate",
    body: "We geocode the address with the U.S. Census, falling back to OpenStreetMap and flagging the match as approximate when we do.",
  },
  {
    n: "02",
    title: "Measure",
    body: "FEMA's flood zone sets today's hazard. NOAA's sea-level-rise rasters add what the coast is projected to do over the next century.",
  },
  {
    n: "03",
    title: "Rank",
    body: "Each horizon is ranked against sampled homes in the same county and nationally, with a confidence rating that drops when the data is weak.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="contours relative border-b border-ink/10">
          <div className="mx-auto grid w-full max-w-[1160px] gap-12 px-4 pt-10 pb-14 sm:px-6 sm:pt-14 lg:grid-cols-12 lg:gap-14 lg:pt-20 lg:pb-24">
            <div className="lg:col-span-7">
              <Kicker className="rise">Flood risk for any U.S. home</Kicker>
              <h1
                className="rise mt-5 font-display text-[38px] font-bold leading-[1.02] tracking-[-1.5px] text-ink text-balance sm:text-[52px] lg:text-[64px] lg:tracking-[-2.5px]"
                style={{ animationDelay: "60ms" }}
              >
                Know where the water{" "}
                <span className="relative whitespace-nowrap">
                  <span className="relative z-10">will reach.</span>
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-[0.08em] z-0 h-[0.28em] bg-signal/80"
                  />
                </span>
              </h1>
              <p
                className="rise mt-5 max-w-[540px] text-[16.5px] leading-[1.6] text-ink-2 text-pretty sm:text-[18px]"
                style={{ animationDelay: "120ms" }}
              >
                FloodIQ reads FEMA flood maps and NOAA sea-level projections for
                any U.S. home, then tells you how it compares to the rest of its
                county, now and 10, 30 and 100 years out.
              </p>

              <div className="rise mt-8 max-w-[620px]" style={{ animationDelay: "180ms" }}>
                <AddressForm autoFocus />
                <p className="mt-3 text-[13px] leading-[1.5] text-ink-3">
                  Include city and state. A first lookup in a new county builds a
                  local baseline and can take up to a minute.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]">
                  <span className="text-ink-3">Try one:</span>
                  {EXAMPLES.map((ex) => (
                    <a
                      key={ex.address}
                      href={`/score?address=${encodeURIComponent(ex.address)}`}
                      className="group inline-flex min-h-[32px] items-center gap-1.5 font-medium text-accent underline decoration-accent/30 underline-offset-4 transition hover:decoration-signal hover:decoration-2"
                    >
                      {ex.label}
                      <ArrowIcon size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="rise lg:col-span-5 lg:pt-2" style={{ animationDelay: "240ms" }}>
              <WaterLevelExplorer />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1160px] px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Kicker>How it works</Kicker>
              <h2 className="mt-4 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.8px] text-ink sm:text-[34px]">
                Two federal datasets. One straight answer.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.6] text-ink-3">
                Every score ships with a confidence label, because old maps and
                approximate locations deserve less trust.
              </p>
            </div>
            <ol className="grid border-t-2 border-ink sm:grid-cols-3 lg:col-span-8">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="group border-b border-ink/15 py-6 transition-colors sm:border-b-0 sm:px-5 sm:first:pl-0 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-ink/15"
                >
                  <div className="font-display text-[30px] font-extrabold leading-none text-ink/15 transition-colors group-hover:text-signal">
                    {s.n}
                  </div>
                  <h3 className="mt-3 font-display text-[20px] font-bold tracking-[-0.3px] text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-3">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <a
            href={METHODOLOGY_URL}
            target="_blank"
            rel="noreferrer"
            className="group mt-14 flex flex-col justify-between gap-4 border-2 border-ink bg-surface p-6 transition-shadow hover:shadow-[6px_6px_0_0_#0f2430] sm:flex-row sm:items-center sm:p-8"
          >
            <div>
              <div className="font-display text-[20px] font-bold tracking-[-0.3px] text-ink">
                Read the full methodology
              </div>
              <p className="mt-1 text-[14.5px] text-ink-3">
                Weights, edge cases and known limitations, all documented in the open.
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink transition-colors group-hover:bg-signal">
              <ArrowIcon size={16} />
            </span>
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
