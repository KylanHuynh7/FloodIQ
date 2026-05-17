// Direction C — Big Stat Cards (refined)
// Cool beige + black, Geist + Geist Mono.
// Numerals dialed from 96px italic display to ~54px upright reading size.
// Cards become cream-on-beige with crisp black hairlines, no rounded corners.

function DistHistogram({ percentile, conf }) {
  const buckets = [18, 24, 30, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 11, 8, 5];
  const max = Math.max(...buckets);
  const w = 380, h = 96, pad = { l: 16, r: 16, t: 8, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const bw = innerW / buckets.length;
  const pinX = pad.l + (percentile / 100) * innerW;
  const pinBucketIdx = Math.min(Math.floor((percentile / 100) * buckets.length), buckets.length - 1);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <line x1={pad.l} y1={pad.t+innerH} x2={pad.l+innerW} y2={pad.t+innerH} stroke={TOK.ink} strokeWidth="1"/>

      {buckets.map((b, i) => {
        const bx = pad.l + i * bw;
        const bh = (b / max) * innerH;
        const isPin = i === pinBucketIdx;
        const pctMid = ((i + 0.5) / buckets.length) * 100;
        const r = riskColor(pctMid);
        return (
          <g key={i}>
            <rect
              x={bx + 1.5} y={pad.t + innerH - bh}
              width={bw - 3} height={bh}
              fill={isPin ? r.ink : r.fill}
              opacity={isPin ? 1 : 0.85}
            />
            {isPin && (
              <rect
                x={bx + 1.5} y={pad.t + innerH - bh - 2.5}
                width={bw - 3} height={2.5}
                fill={TOK.ink}
              />
            )}
          </g>
        );
      })}

      {/* You-are-here pin */}
      <g transform={`translate(${pinX},${pad.t-1})`}>
        <polygon points="0,7 -5,0 5,0" fill={TOK.ink}/>
      </g>
      <line x1={pinX} y1={pad.t+5} x2={pinX} y2={pad.t+innerH} stroke={TOK.ink}
        strokeWidth="1" strokeDasharray={conf==='High'?'none':conf==='Medium'?'4 2':'2 2'}/>

      <text x={pad.l} y={pad.t+innerH+13} textAnchor="start" fontSize="9" fill={TOK.ink3} fontFamily={TOK.mono} letterSpacing="0.5">SAFER</text>
      <line x1={pad.l + 0.5*innerW} y1={pad.t+innerH} x2={pad.l + 0.5*innerW} y2={pad.t+innerH+4} stroke={TOK.ink2} strokeWidth="1"/>
      <text x={pad.l + 0.5*innerW} y={pad.t+innerH+13} textAnchor="middle" fontSize="9" fill={TOK.ink3} fontFamily={TOK.mono} letterSpacing="0.5">MEDIAN</text>
      <text x={pad.l+innerW} y={pad.t+innerH+13} textAnchor="end" fontSize="9" fill={TOK.ink3} fontFamily={TOK.mono} letterSpacing="0.5">HIGHER →</text>
    </svg>
  );
}

function ConfMeter({ level }) {
  const lit = level === 'High' ? 3 : level === 'Medium' ? 2 : 1;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          width: 12, height: 5,
          background: i <= lit ? TOK.ink : 'transparent',
          border: `1px solid ${TOK.ink}`,
        }}/>
      ))}
    </div>
  );
}

function StatHorizonCard({ h, idx }) {
  const r = riskColor(h.composite_county_percentile);
  const conf = CONFIDENCE[h.confidence_label];
  return (
    <div style={{
      background: TOK.surface,
      border: `1px solid ${TOK.ink}`,
      marginBottom: 14, overflow: 'hidden',
      boxShadow: '4px 4px 0 0 rgba(10,10,10,0.06)',
    }}>
      {/* eyebrow */}
      <div style={{
        padding: '10px 14px',
        borderBottom: `1px solid ${TOK.line}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: TOK.surfaceAlt,
      }}>
        <div style={{
          fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.2,
          color: TOK.ink, fontWeight: 500,
        }}>
          0{idx+1} <span style={{ color: TOK.ink3 }}>/ 03</span>　·　+{h.horizon_years} YEARS　·　{h.year_label.toUpperCase()}
        </div>
        <ConfMeter level={h.confidence_label}/>
      </div>

      {/* stat row — toned down */}
      <div style={{
        padding: '16px 14px 14px',
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14,
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: TOK.sans, fontWeight: 500,
          fontSize: 54, lineHeight: 0.9, letterSpacing: -2,
          color: TOK.ink, fontFeatureSettings: '"tnum"',
          display: 'flex', alignItems: 'baseline',
        }}>
          {h.composite_county_percentile}<span style={{
            fontSize: 18, fontWeight: 500, color: TOK.ink2,
            letterSpacing: -0.4, marginLeft: 1,
          }}>{ordinalSuffix(h.composite_county_percentile)}</span>
        </div>
        <div>
          <div style={{
            fontFamily: TOK.sans, fontSize: 13, fontWeight: 500,
            color: TOK.ink, lineHeight: 1.35,
          }}>
            percentile in<br/>Charleston County
          </div>
          <div style={{
            marginTop: 6,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 7px',
            background: r.fill, color: r.ink,
            fontFamily: TOK.mono, fontSize: 10, fontWeight: 600,
            letterSpacing: 0.5,
          }}>
            {r.label.toUpperCase()} RISK
          </div>
        </div>
      </div>

      {/* Histogram */}
      <div style={{
        background: TOK.paperAlt, padding: '8px 0 2px',
        borderTop: `1px solid ${TOK.line}`,
        borderBottom: `1px solid ${TOK.line}`,
      }}>
        <div style={{
          padding: '0 16px 2px',
          fontFamily: TOK.mono, fontSize: 9, letterSpacing: 1.2,
          color: TOK.ink2, fontWeight: 500,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>▼ THIS ADDRESS</span>
          <span>COUNTY DISTRIBUTION</span>
        </div>
        <DistHistogram percentile={h.composite_county_percentile} conf={h.confidence_label}/>
      </div>

      {/* Footer details row */}
      <div style={{
        padding: '10px 14px',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
        background: TOK.surface,
      }}>
        <div>
          <div style={{ fontFamily: TOK.mono, fontSize: 9, letterSpacing: 0.8, color: TOK.ink3, fontWeight: 500 }}>NATIONAL</div>
          <div style={{ fontFamily: TOK.sans, fontSize: 15, fontWeight: 500, color: TOK.ink, marginTop: 1, letterSpacing: -0.3 }}>
            {h.composite_national_percentile}<span style={{ fontSize: 10, color: TOK.ink3 }}>{ordinalSuffix(h.composite_national_percentile)}</span>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: TOK.mono, fontSize: 9, letterSpacing: 0.8, color: TOK.ink3, fontWeight: 500 }}>RAW</div>
          <div style={{ fontFamily: TOK.sans, fontSize: 15, fontWeight: 500, color: TOK.ink, marginTop: 1, letterSpacing: -0.3 }}>
            {h.composite_absolute}<span style={{ fontSize: 10, color: TOK.ink3 }}>/100</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: TOK.mono, fontSize: 9, letterSpacing: 0.8, color: TOK.ink3, fontWeight: 500 }}>CONF.</div>
          <div style={{ fontFamily: TOK.sans, fontSize: 15, fontWeight: 500, color: TOK.ink, marginTop: 1 }}>
            {h.confidence_label}
          </div>
        </div>
      </div>

      {/* Caveat */}
      {h.confidence_drivers.length > 0 && (
        <div style={{
          padding: '9px 14px',
          background: TOK.surfaceAlt,
          borderTop: `1px solid ${TOK.line}`,
          fontFamily: TOK.sans, fontSize: 12, color: TOK.ink2, lineHeight: 1.4,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{
            fontFamily: TOK.mono, fontSize: 9, letterSpacing: 1,
            color: TOK.ink, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap',
          }}>↘ CAVEAT</span>
          <span>{h.confidence_drivers.join('; ')}</span>
        </div>
      )}
    </div>
  );
}

function Direction3({ pageBg, approximate = false }) {
  const d = FLOOD_DATA;
  const horizons = [d.horizons['10'], d.horizons['30'], d.horizons['100']];
  const bg = pageBg || TOK.paper;
  return (
    <MobileShell label="result" bg={bg}>
      <div style={{ background: bg }}>
        {/* Header — matched address only */}
        <div style={{
          background: TOK.surface, padding: '14px 16px 16px',
          borderBottom: `1px solid ${TOK.ink}`,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink, fontWeight: 500,
          }}>
            <Icon.Pin s={11}/>{approximate ? 'MATCHED · APPROXIMATE' : 'MATCHED · ROOFTOP'}
          </div>
          <div style={{
            fontFamily: TOK.sans, fontWeight: 500,
            fontSize: 22, marginTop: 6, color: TOK.ink,
            lineHeight: 1.15, letterSpacing: -0.6,
          }}>
            123 Main Street
          </div>
          <div style={{
            fontFamily: TOK.sans, fontSize: 13, color: TOK.ink2, marginTop: 2,
          }}>
            Charleston, SC 29401 · Charleston County · <span style={{ fontFamily: TOK.mono, fontSize: 11, color: TOK.ink3 }}>coastal</span>
          </div>
        </div>

        {/* Confirmation map — directly beneath the matched address */}
        <div style={{ padding: '14px 14px 0' }}>
          <ConfirmationMap
            lat={d.latitude}
            lon={d.longitude}
            approximate={approximate}
            height={240}
          />
        </div>

        {/* Headline summary */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            padding: '12px 14px',
            background: TOK.surface,
            border: `1px solid ${TOK.line}`,
            fontFamily: TOK.sans, fontSize: 14.5, lineHeight: 1.45,
            color: TOK.ink, textWrap: 'pretty', fontWeight: 400,
          }}>
            Higher than <span style={{ background: '#d8a070', color: '#3a1410', padding: '0 4px', fontWeight: 500 }}>78%</span> of Charleston County properties over the next 10 years, rising to <span style={{ background: '#c87858', color: '#f0ece0', padding: '0 4px', fontWeight: 500 }}>93%</span> by 2125.
          </div>
        </div>

        {/* Cards */}
        <div style={{ padding: '14px 14px 4px' }}>
          {horizons.map((h, i) => (
            <StatHorizonCard key={h.horizon_years} h={h} idx={i}/>
          ))}
        </div>

        {/* PDF CTA — architectural black slab */}
        <div style={{ padding: '4px 14px 16px' }}>
          <button style={{
            width: '100%', padding: '15px',
            background: TOK.ink, color: TOK.surface,
            border: `1px solid ${TOK.ink}`,
            fontFamily: TOK.sans, fontSize: 14, fontWeight: 500, letterSpacing: -0.1,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}>
            <span>Download full report</span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontFamily: TOK.mono, fontSize: 11, color: '#8a8474' }}>
              PDF · 3 PAGES <Icon.Arrow s={14}/>
            </span>
          </button>
        </div>

        {/* How to read */}
        <details style={{
          background: TOK.surface, margin: '0 14px 14px',
          border: `1px solid ${TOK.ink}`,
        }}>
          <summary style={{
            padding: '12px 14px', cursor: 'pointer', listStyle: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: TOK.sans, fontSize: 13, fontWeight: 500, color: TOK.ink,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon.Info s={14}/> How to read this score
            </span>
            <span style={{ color: TOK.ink3, fontSize: 16 }}>＋</span>
          </summary>
          <div style={{
            padding: '0 14px 14px',
            fontSize: 12.5, color: TOK.ink2, lineHeight: 1.55,
          }}>
            <b style={{ color: TOK.ink, fontWeight: 600 }}>County percentile</b> compares this address to every residential property in Charleston County. 50 is the median. 78 means higher risk than 78% of the county.<br/><br/>
            <b style={{ color: TOK.ink, fontWeight: 600 }}>Confidence</b> reflects FEMA/NOAA agreement plus source-data age. A high score with low confidence should be read with caution.
          </div>
        </details>

        {/* Source data */}
        <div style={{
          margin: '0 14px 14px', padding: '12px 14px',
          background: TOK.surface,
          border: `1px solid ${TOK.ink}`,
        }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink, fontWeight: 500, marginBottom: 10,
            display: 'flex', justifyContent: 'space-between',
            paddingBottom: 6, borderBottom: `1px solid ${TOK.line}`,
          }}>
            <span>SOURCE DATA</span>
            <span style={{ color: TOK.ink3 }}>FOR THIS ADDRESS</span>
          </div>
          <StatSourceRow icon={<Icon.Map s={12}/>} label="FEMA NFHL" k="Zone AE" sub="High-risk SFHA"/>
          <StatSourceRow icon={<Icon.Map s={12}/>} label="FEMA map age" k="5.3y" sub="Effective 2021-01-29" flag/>
          <StatSourceRow icon={<Icon.Wave s={12}/>} label="NOAA SLR" k="Coastal" sub="Sea-level projections applied"/>
          <StatSourceRow icon={<Icon.Pin s={12}/>} label="Geocode" k="Exact" sub="Rooftop match" last/>
        </div>

        {/* Footer */}
        <div style={{
          padding: '4px 14px 18px',
          fontFamily: TOK.sans, fontSize: 11, color: TOK.ink2, lineHeight: 1.55,
        }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 9, color: TOK.ink3, letterSpacing: 1.2, marginBottom: 4, fontWeight: 600,
          }}>METHOD V{d.methodology_version} · {d.scored_at.slice(0,10)}</div>
          FloodIQ is an educational tool. This score is not flood insurance, an official FEMA reading, or a substitute for professional flood assessment.
        </div>
      </div>
    </MobileShell>
  );
}

function StatSourceRow({ icon, label, k, sub, flag, last }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '18px 1fr auto',
      gap: 10, padding: '7px 0',
      borderBottom: last ? 'none' : `1px solid ${TOK.lineSoft}`,
      alignItems: 'center',
    }}>
      <span style={{ color: TOK.ink2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, color: TOK.ink, fontWeight: 500 }}>{label}</div>
        <div style={{ fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3, marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{
        fontFamily: TOK.mono, fontSize: 12, fontWeight: 600,
        color: flag ? '#8a3a2a' : TOK.ink, whiteSpace: 'nowrap',
      }}>{k}</div>
    </div>
  );
}

Object.assign(window, { Direction3 });
