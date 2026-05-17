import { ConfidenceLevel, riskColor } from "@/lib/tokens";

// Placeholder county distribution shape (16 bins, descending after mid).
// METHODOLOGY.md notes: replace with real per-county distribution once the
// backend exposes the bucket array in the /api/score response.
const BUCKETS = [18, 24, 30, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 11, 8, 5];

export function DistHistogram({
  percentile,
  conf,
  width = 380,
  height = 96,
}: {
  percentile: number;
  conf: ConfidenceLevel;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...BUCKETS);
  const pad = { l: 16, r: 16, t: 8, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const bw = innerW / BUCKETS.length;
  const pinX = pad.l + (percentile / 100) * innerW;
  const pinBucketIdx = Math.min(
    Math.floor((percentile / 100) * BUCKETS.length),
    BUCKETS.length - 1,
  );
  const dash =
    conf === "High" ? undefined : conf === "Medium" ? "4 2" : "2 2";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`County distribution: this address is at the ${Math.round(percentile)}th percentile`}
    >
      <line
        x1={pad.l}
        y1={pad.t + innerH}
        x2={pad.l + innerW}
        y2={pad.t + innerH}
        stroke="#0a0a0a"
        strokeWidth="1"
      />

      {BUCKETS.map((b, i) => {
        const bx = pad.l + i * bw;
        const bh = (b / max) * innerH;
        const isPin = i === pinBucketIdx;
        const pctMid = ((i + 0.5) / BUCKETS.length) * 100;
        const r = riskColor(pctMid);
        return (
          <g key={i}>
            <rect
              x={bx + 1.5}
              y={pad.t + innerH - bh}
              width={bw - 3}
              height={bh}
              fill={isPin ? r.ink : r.fill}
              opacity={isPin ? 1 : 0.85}
            />
            {isPin && (
              <rect
                x={bx + 1.5}
                y={pad.t + innerH - bh - 2.5}
                width={bw - 3}
                height={2.5}
                fill="#0a0a0a"
              />
            )}
          </g>
        );
      })}

      {/* You-are-here pin */}
      <g transform={`translate(${pinX},${pad.t - 1})`}>
        <polygon points="0,7 -5,0 5,0" fill="#0a0a0a" />
      </g>
      <line
        x1={pinX}
        y1={pad.t + 5}
        x2={pinX}
        y2={pad.t + innerH}
        stroke="#0a0a0a"
        strokeWidth="1"
        strokeDasharray={dash}
      />

      <text
        x={pad.l}
        y={pad.t + innerH + 13}
        textAnchor="start"
        fontSize="9"
        fill="#5a554a"
        fontFamily="var(--font-mono)"
        letterSpacing="0.5"
      >
        SAFER
      </text>
      <line
        x1={pad.l + 0.5 * innerW}
        y1={pad.t + innerH}
        x2={pad.l + 0.5 * innerW}
        y2={pad.t + innerH + 4}
        stroke="#2a2620"
        strokeWidth="1"
      />
      <text
        x={pad.l + 0.5 * innerW}
        y={pad.t + innerH + 13}
        textAnchor="middle"
        fontSize="9"
        fill="#5a554a"
        fontFamily="var(--font-mono)"
        letterSpacing="0.5"
      >
        MEDIAN
      </text>
      <text
        x={pad.l + innerW}
        y={pad.t + innerH + 13}
        textAnchor="end"
        fontSize="9"
        fill="#5a554a"
        fontFamily="var(--font-mono)"
        letterSpacing="0.5"
      >
        HIGHER →
      </text>
    </svg>
  );
}
