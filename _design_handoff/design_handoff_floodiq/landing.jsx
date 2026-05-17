// Landing screen — civic, type-driven, search-forward.

function LandingHorizonChip({ label, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: '10px 10px',
      background: TOK.surface,
      border: `1px solid ${TOK.ink}`,
    }}>
      <div style={{
        fontFamily: TOK.sans, fontSize: 18, fontWeight: 600,
        letterSpacing: -0.5, color: TOK.ink, lineHeight: 1,
      }}>{label}</div>
      <div style={{
        fontFamily: TOK.mono, fontSize: 9, letterSpacing: 0.8,
        color: TOK.ink3, marginTop: 4, fontWeight: 500,
      }}>{sub}</div>
    </div>
  );
}

function Landing({ pageBg = '#ffffff' }) {
  const [addr, setAddr] = React.useState('');
  const canSubmit = addr.trim().length > 4;

  return (
    <MobileShell label="landing" bg={pageBg}>
      <div style={{ background: pageBg, padding: '0 0 16px' }}>
        {/* Masthead */}
        <div style={{
          padding: '10px 20px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontFamily: TOK.mono, fontSize: 11, letterSpacing: 1.6,
          color: TOK.ink, fontWeight: 600,
        }}>
          <span>FLOODIQ</span>
          <span style={{ color: TOK.ink3, fontWeight: 500, fontSize: 10 }}>METHOD V1.1</span>
        </div>

        {/* Editorial headline */}
        <div style={{ padding: '40px 20px 8px' }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.6,
            color: TOK.signal, fontWeight: 600, marginBottom: 14,
          }}>FLOOD-RISK SCORING</div>
          <div style={{
            fontFamily: TOK.sans, fontWeight: 500,
            fontSize: 32, lineHeight: 1.05, letterSpacing: -1.5,
            color: TOK.ink, textWrap: 'balance',
          }}>
            How exposed is your address to flooding — now and through 2125?
          </div>
          <div style={{
            marginTop: 14,
            fontFamily: TOK.sans, fontSize: 14, lineHeight: 1.5,
            color: TOK.ink2, textWrap: 'pretty',
          }}>
            FloodIQ scores any U.S. residential address against FEMA flood maps and NOAA sea-level projections across three time horizons.
          </div>
        </div>

        {/* Search input */}
        <div style={{ padding: '24px 20px 6px' }}>
          <label style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink, fontWeight: 600, marginBottom: 6, display: 'block',
          }}>U.S. STREET ADDRESS</label>
          <div style={{
            display: 'flex', border: `1px solid ${TOK.ink}`,
            background: TOK.surface,
          }}>
            <input
              type="text"
              value={addr}
              onChange={e => setAddr(e.target.value)}
              placeholder="123 Main St, Charleston, SC"
              style={{
                flex: 1, minWidth: 0,
                padding: '14px 14px',
                border: 'none', outline: 'none',
                background: 'transparent',
                fontFamily: TOK.sans, fontSize: 15, fontWeight: 500,
                color: TOK.ink, letterSpacing: -0.2,
              }}
            />
            <button
              disabled={!canSubmit}
              style={{
                padding: '0 16px',
                border: 'none', borderLeft: `1px solid ${TOK.ink}`,
                background: canSubmit ? TOK.ink : TOK.surfaceAlt,
                color: canSubmit ? TOK.surface : TOK.ink3,
                fontFamily: TOK.mono, fontSize: 11, fontWeight: 600,
                letterSpacing: 1.2,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              SCORE <Icon.Arrow s={13}/>
            </button>
          </div>
          <div style={{
            marginTop: 8,
            fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3,
            letterSpacing: 0.4, lineHeight: 1.4,
          }}>
            Residential addresses only. First lookup in a new county takes ~30 s.
          </div>
        </div>

        {/* What you'll get */}
        <div style={{ padding: '28px 20px 8px' }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink3, fontWeight: 600, marginBottom: 10,
          }}>WHAT YOU'LL GET</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <LandingHorizonChip label="+10y" sub="BY 2036"/>
            <LandingHorizonChip label="+30y" sub="BY 2056"/>
            <LandingHorizonChip label="+100y" sub="BY 2125"/>
          </div>
          <div style={{
            marginTop: 12,
            fontFamily: TOK.sans, fontSize: 13, color: TOK.ink2, lineHeight: 1.5,
          }}>
            A county percentile, a national percentile, and a confidence label — for each horizon. Plus a 3-page PDF report.
          </div>
        </div>

        {/* Trust signals */}
        <div style={{
          margin: '24px 20px 0',
          padding: '14px 14px',
          background: TOK.surface,
          border: `1px solid ${TOK.ink}`,
        }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink, fontWeight: 600, marginBottom: 8,
          }}>EDUCATIONAL TOOL — NOT INSURANCE</div>
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
            fontFamily: TOK.sans, fontSize: 12, color: TOK.ink2,
            lineHeight: 1.55,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <li style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 6 }}>
              <span style={{ fontFamily: TOK.mono, color: TOK.ink3 }}>·</span>
              <span>Not flood-insurance underwriting</span>
            </li>
            <li style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 6 }}>
              <span style={{ fontFamily: TOK.mono, color: TOK.ink3 }}>·</span>
              <span>Not an official FEMA flood-map reading</span>
            </li>
            <li style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 6 }}>
              <span style={{ fontFamily: TOK.mono, color: TOK.ink3 }}>·</span>
              <span>Not a substitute for professional flood assessment</span>
            </li>
          </ul>
        </div>

        {/* Methodology link */}
        <div style={{
          margin: '12px 20px 0',
          padding: '12px 14px',
          background: 'transparent',
          border: `1px dashed ${TOK.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
        }}>
          <div>
            <div style={{ fontFamily: TOK.sans, fontSize: 13, fontWeight: 500, color: TOK.ink }}>
              Read the methodology
            </div>
            <div style={{ fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3, marginTop: 2, letterSpacing: 0.3 }}>
              V1.1 · HOW THE SCORE IS BUILT
            </div>
          </div>
          <Icon.Arrow s={14}/>
        </div>

        {/* Sources footnote */}
        <div style={{
          padding: '20px 20px 0',
          fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3,
          letterSpacing: 0.4, lineHeight: 1.6,
        }}>
          <div style={{ color: TOK.ink, fontWeight: 600, marginBottom: 4, letterSpacing: 1.2 }}>SOURCES</div>
          FEMA National Flood Hazard Layer · NOAA Sea Level Rise V2022
        </div>
      </div>
    </MobileShell>
  );
}

Object.assign(window, { Landing });
