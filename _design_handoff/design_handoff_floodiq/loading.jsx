// Loading screen — live elapsed timer + status timeline + message transition at 8s.
// Civic, transparent: shows the actual steps the backend is running.

function StatusStep({ state, label, sub, last }) {
  // state: 'done' | 'running' | 'pending'
  let glyph, glyphColor;
  if (state === 'done') {
    glyph = '✓'; glyphColor = TOK.ink;
  } else if (state === 'running') {
    glyph = '◐'; glyphColor = TOK.ink;
  } else {
    glyph = '○'; glyphColor = TOK.ink4;
  }
  const dim = state === 'pending';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr',
      gap: 12, padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${TOK.lineSoft}`,
      opacity: dim ? 0.55 : 1,
      alignItems: 'center',
    }}>
      <div style={{
        fontFamily: TOK.mono, fontSize: 16, fontWeight: 600,
        color: glyphColor, textAlign: 'center', lineHeight: 1,
        animation: state === 'running' ? 'spin 2.4s linear infinite' : 'none',
      }}>{glyph}</div>
      <div>
        <div style={{
          fontFamily: TOK.sans, fontSize: 13.5, fontWeight: 500,
          color: state === 'pending' ? TOK.ink3 : TOK.ink,
        }}>{label}</div>
        {sub && (
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3,
            marginTop: 2, letterSpacing: 0.3,
          }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function Loading({ pageBg = '#ffffff', address = '123 MAIN ST, CHARLESTON, SC 29401' }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const start = Date.now();
    const i = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(i);
  }, []);

  // Derive step states from elapsed (simulated)
  const geocodeDone = elapsed >= 1;
  const femaDone    = elapsed >= 4;
  const noaaDone    = elapsed >= 7;
  // Baseline becomes the running step after NOAA finishes (around 8s)
  const baselineRunning = elapsed >= 7;
  const baselinePhase = elapsed >= 8;

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <MobileShell label="loading" bg={pageBg}>
      <style>{`
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
      `}</style>

      <div style={{ background: pageBg, padding: '0', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Top crumb */}
        <div style={{
          padding: '10px 20px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontFamily: TOK.mono, fontSize: 11, letterSpacing: 1.6,
          color: TOK.ink, fontWeight: 600,
        }}>
          <span>FLOODIQ ▸ SCORING</span>
          <span style={{ color: TOK.ink3, fontWeight: 500, fontSize: 10 }}>METHOD V1.1</span>
        </div>

        {/* Address being scored */}
        <div style={{ padding: '28px 20px 0' }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink3, fontWeight: 600, marginBottom: 8,
          }}>SCORING ADDRESS</div>
          <div style={{
            fontFamily: TOK.sans, fontSize: 19, fontWeight: 500,
            color: TOK.ink, lineHeight: 1.25, letterSpacing: -0.5,
            textWrap: 'pretty',
          }}>
            {address}
          </div>
        </div>

        {/* Elapsed timer + spinner */}
        <div style={{
          margin: '24px 20px 0',
          padding: '20px 18px',
          background: TOK.surface,
          border: `1px solid ${TOK.ink}`,
          display: 'grid', gridTemplateColumns: '1fr auto',
          gap: 14, alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
              color: TOK.ink3, fontWeight: 600,
            }}>ELAPSED</div>
            <div style={{
              fontFamily: TOK.mono, fontSize: 44, fontWeight: 600,
              color: TOK.ink, lineHeight: 1, letterSpacing: -1,
              marginTop: 4, fontVariantNumeric: 'tabular-nums',
            }}>{mm}:{ss}</div>
          </div>
          <BarSpinner/>
        </div>

        {/* Status timeline */}
        <div style={{
          margin: '14px 20px 0',
          padding: '10px 16px 14px',
          background: TOK.surface,
          border: `1px solid ${TOK.ink}`,
        }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink, fontWeight: 600, paddingBottom: 6,
            borderBottom: `1px solid ${TOK.line}`, marginBottom: 4,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>PIPELINE</span>
            <span style={{ color: TOK.ink3 }}>
              {[geocodeDone, femaDone, noaaDone, baselinePhase && elapsed >= 30].filter(Boolean).length} / 4
            </span>
          </div>
          <StatusStep
            state={geocodeDone ? 'done' : 'running'}
            label="Geocoding address"
            sub="MATCHING TO U.S. CENSUS TIGER"
          />
          <StatusStep
            state={femaDone ? 'done' : geocodeDone ? 'running' : 'pending'}
            label="Querying FEMA NFHL"
            sub="NATIONAL FLOOD HAZARD LAYER"
          />
          <StatusStep
            state={noaaDone ? 'done' : femaDone ? 'running' : 'pending'}
            label="Querying NOAA SLR"
            sub="SEA-LEVEL RISE PROJECTIONS"
          />
          <StatusStep
            state={baselinePhase ? 'running' : 'pending'}
            label="Building county baseline"
            sub="COMPUTING PERCENTILE DISTRIBUTION"
            last
          />
        </div>

        {/* Message — transitions at 8s */}
        <div style={{
          margin: '14px 20px 0',
          padding: '12px 14px',
          background: baselinePhase ? TOK.surface : TOK.surfaceAlt,
          border: `1px solid ${baselinePhase ? TOK.signal : TOK.line}`,
          borderLeft: `3px solid ${baselinePhase ? TOK.signal : TOK.ink}`,
          fontFamily: TOK.sans, fontSize: 13, lineHeight: 1.5,
          color: TOK.ink, textWrap: 'pretty',
        }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.2,
            color: baselinePhase ? TOK.signal : TOK.ink2,
            fontWeight: 600, marginBottom: 4,
          }}>
            {baselinePhase ? 'FIRST LOOKUP IN THIS AREA' : 'WORKING'}
          </div>
          {baselinePhase ? (
            <span>Building a county comparison baseline. One-time per county, instant after that. <span style={{ color: TOK.ink3 }}>Expect 30 s – 3 min.</span></span>
          ) : (
            <span>Looking up FEMA flood data for this address.</span>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }}/>

        {/* Cancel */}
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <a href="#" style={{
            fontFamily: TOK.sans, fontSize: 13, color: TOK.ink2,
            textDecoration: 'none', display: 'inline-flex', gap: 6,
            alignItems: 'center', borderBottom: `1px solid ${TOK.line}`,
            paddingBottom: 2,
          }}>
            ← Cancel and go back
          </a>
        </div>
      </div>
    </MobileShell>
  );
}

function BarSpinner() {
  // A 3-bar indeterminate spinner — civic, weather-station feeling.
  return (
    <div style={{
      display: 'flex', gap: 4, alignItems: 'flex-end', height: 40,
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 40,
          background: TOK.ink,
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}/>
      ))}
    </div>
  );
}

Object.assign(window, { Loading });
