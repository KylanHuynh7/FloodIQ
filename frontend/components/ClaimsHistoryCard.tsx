import { Kicker } from "@/components/chrome";
import { ClaimsHistory } from "@/lib/tokens";

const OPENFEMA_URL = "https://www.fema.gov/openfema-data-page/nfip-redacted-claims-v3";

// Plain-language comparison of the tract with its county's average tract.
function versusCounty(tract: number, avg: number | null): string | null {
  if (avg == null || avg <= 0) return null;
  const ratio = tract / avg;
  if (ratio >= 1.5) return `about ${ratio.toFixed(1)}× the county's average tract`;
  if (ratio <= 0.67) return `well below the county's average tract`;
  return "about average for the county";
}

export function ClaimsHistoryCard({ history }: { history: ClaimsHistory }) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  const comparison = versusCounty(history.claims_in_tract, history.county_avg_per_tract);
  const outsideShare =
    history.claims_in_tract > 0
      ? Math.round((history.claims_outside_high_risk / history.claims_in_tract) * 100)
      : 0;

  return (
    <section className="mt-14">
      <Kicker>Flood history</Kicker>
      <h2 className="mt-3 font-display text-[26px] font-bold tracking-[-0.7px] text-ink sm:text-[30px]">
        Flood insurance claims nearby
      </h2>
      <div className="mt-5 border-2 border-ink bg-surface">
        <dl className="grid divide-y divide-ink/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Stat
            label="Claims in this Census tract"
            value={fmt(history.claims_in_tract)}
            note={comparison ?? undefined}
          />
          <Stat
            label="Outside today's high-risk zones"
            value={fmt(history.claims_outside_high_risk)}
            note={
              history.claims_in_tract > 0
                ? `${outsideShare}% of claims: flooding FEMA's maps don't show`
                : undefined
            }
            highlight={history.claims_outside_high_risk > 0}
          />
          <Stat
            label="County average per tract"
            value={history.county_avg_per_tract != null ? fmt(Math.round(history.county_avg_per_tract)) : "—"}
          />
        </dl>
        <p className="border-t border-ink/15 px-5 py-4 text-[13.5px] leading-[1.6] text-ink-3 sm:px-6">
          National Flood Insurance Program claims since 1978, from{" "}
          <a href={OPENFEMA_URL} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
            OpenFEMA
          </a>
          . Only insured properties appear, so a low count can also mean few policies, not
          low risk. This history is shown for context and isn&apos;t part of the score.
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <dt className="text-[13.5px] text-ink-3">{label}</dt>
      <dd className={`mt-1 font-display text-[32px] font-bold leading-none tabular-nums ${highlight ? "text-warn" : "text-ink"}`}>
        {value}
      </dd>
      {note && <dd className="mt-2 text-[13px] leading-[1.45] text-ink-2">{note}</dd>}
    </div>
  );
}
