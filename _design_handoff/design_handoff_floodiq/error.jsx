// Error state — address not found / geocoding failure.

function ErrorScreen({ pageBg = '#ffffff', input = "456 Nonexistent Way, Atlantis, ZZ" }) {
  const [addr, setAddr] = React.useState('');
  const canSubmit = addr.trim().length > 4;

  return (
    <MobileShell label="error" bg={pageBg}>
      <div style={{ background: pageBg, padding: '0 0 20px' }}>
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
        <div style={{ padding: '36px 20px 0' }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.6,
            color: TOK.signal, fontWeight: 600, marginBottom: 14,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon.Warn s={11}/>ADDRESS NOT FOUND
          </div>
          <div style={{
            fontFamily: TOK.sans, fontWeight: 500,
            fontSize: 30, lineHeight: 1.08, letterSpacing: -1.2,
            color: TOK.ink, textWrap: 'balance',
          }}>
            We couldn't match that address.
          </div>
          <div style={{
            marginTop: 12,
            fontFamily: TOK.sans, fontSize: 14, lineHeight: 1.5,
            color: TOK.ink2, textWrap: 'pretty',
          }}>
            <span style={{
              fontFamily: TOK.mono, fontSize: 12,
              background: TOK.surface, padding: '1px 6px',
              border: `1px solid ${TOK.line}`,
            }}>{input}</span>{' '}
            didn't resolve to a U.S. residential address.
          </div>
        </div>

        {/* What can go wrong */}
        <div style={{
          margin: '24px 20px 0',
          padding: '14px 16px',
          background: TOK.surface,
          border: `1px solid ${TOK.ink}`,
        }}>
          <div style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink, fontWeight: 600, marginBottom: 10,
          }}>COMMON CAUSES</div>
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
            fontFamily: TOK.sans, fontSize: 13, color: TOK.ink2,
            lineHeight: 1.55,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {[
              ['Apartments + units', 'FloodIQ scores buildings, not unit numbers.'],
              ['PO boxes', 'No geographic coordinates.'],
              ['Commercial properties', 'Residential addresses only.'],
              ['Non-U.S. addresses', 'FEMA data is U.S.-only.'],
              ['Misspellings or missing details', 'Try including city + state.'],
            ].map(([k, v], i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 8 }}>
                <span style={{ fontFamily: TOK.mono, color: TOK.ink3 }}>·</span>
                <span>
                  <b style={{ color: TOK.ink, fontWeight: 500 }}>{k}.</b>{' '}
                  <span style={{ color: TOK.ink3 }}>{v}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Retry input */}
        <div style={{ padding: '24px 20px 6px' }}>
          <label style={{
            fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.4,
            color: TOK.ink, fontWeight: 600, marginBottom: 6, display: 'block',
          }}>TRY ANOTHER ADDRESS</label>
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
        </div>

        {/* Back home */}
        <div style={{
          margin: '16px 20px 0',
          padding: '12px 14px',
          background: 'transparent',
          border: `1px dashed ${TOK.line}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer',
        }}>
          <div style={{ fontFamily: TOK.sans, fontSize: 13, fontWeight: 500, color: TOK.ink }}>
            ← Back to home
          </div>
          <div style={{ fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3, letterSpacing: 0.3 }}>
            FLOODIQ /
          </div>
        </div>

        {/* Help */}
        <div style={{
          padding: '20px 20px 0',
          fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3,
          letterSpacing: 0.4, lineHeight: 1.6,
        }}>
          <div style={{ color: TOK.ink, fontWeight: 600, marginBottom: 4, letterSpacing: 1.2 }}>SUPPORT</div>
          If you believe this address should score and doesn't, report it via the methodology page.
        </div>
      </div>
    </MobileShell>
  );
}

Object.assign(window, { ErrorScreen });
