import { ConfidenceLevel, RISK_BANDS, ordinalSuffix } from "@/lib/tokens";

// Where this address sits on the county percentile axis, drawn over the
// risk bands. Deliberately shows no distribution shape: the API does not
// expose the county's real distribution, and an invented one would imply
// precision the score doesn't have.
export function PercentileScale({
  percentile,
  conf,
}: {
  percentile: number;
  conf: ConfidenceLevel;
}) {
  const p = Math.max(0, Math.min(100, percentile));
  // Lower confidence widens the hatched "could plausibly be" range.
  const spread = conf === "High" ? 0 : conf === "Medium" ? 6 : 12;
  const lo = Math.max(0, p - spread);
  const hi = Math.min(100, p + spread);
  const move = "transition-all duration-700 ease-[cubic-bezier(0.3,0.7,0.2,1)]";

  return (
    <div
      role="img"
      aria-label={`${Math.round(p)}${ordinalSuffix(Math.round(p))} percentile in county, ${conf.toLowerCase()} confidence`}
    >
      <div className="relative pt-7 pb-1">
        <div
          className={`absolute top-0 -translate-x-1/2 bg-ink px-1.5 py-0.5 font-mono text-[10.5px] font-medium whitespace-nowrap text-white ${move}`}
          style={{ left: `clamp(16px, ${p}%, calc(100% - 16px))` }}
        >
          {Math.round(p)}
        </div>

        <div className="relative flex h-3 border border-ink">
          {RISK_BANDS.map((b) => (
            <div
              key={b.label}
              title={`${b.label}: ${b.from}–${b.to}th percentile`}
              style={{ width: `${b.to - b.from}%`, backgroundColor: b.fill }}
            />
          ))}
          <div className="absolute inset-y-0 left-1/2 w-px bg-ink/60" />
        </div>

        {spread > 0 && (
          <div
            className={`absolute top-[26px] h-[16px] border-x-2 border-ink ${move}`}
            style={{
              left: `${lo}%`,
              width: `${hi - lo}%`,
              background:
                "repeating-linear-gradient(135deg, rgba(15,36,48,0.35) 0 2px, transparent 2px 5px)",
            }}
          />
        )}

        <div
          className={`absolute top-[21px] h-[26px] w-[4px] -translate-x-1/2 bg-ink outline-2 outline-white ${move}`}
          style={{ left: `${p}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-ink-4">
        <span>0 · lower</span>
        <span>50 · median</span>
        <span>higher · 100</span>
      </div>
    </div>
  );
}
