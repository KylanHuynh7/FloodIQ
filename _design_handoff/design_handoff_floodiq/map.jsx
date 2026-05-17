// Confirmation map — static tiles, single pin, trust/verification element.
// Production: swap tile URL for Mapbox Static Images API. Tile math is identical.

function tilesForLocation(lat, lon, zoom, viewportW, viewportH) {
  const n = Math.pow(2, zoom);
  const xtileF = (lon + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const ytileF = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n;

  const pinPxX = xtileF * 256;
  const pinPxY = ytileF * 256;

  const minPxX = pinPxX - viewportW / 2;
  const minPxY = pinPxY - viewportH / 2;
  const maxPxX = pinPxX + viewportW / 2;
  const maxPxY = pinPxY + viewportH / 2;

  const startTileX = Math.floor(minPxX / 256);
  const startTileY = Math.floor(minPxY / 256);
  const endTileX   = Math.floor((maxPxX - 0.001) / 256);
  const endTileY   = Math.floor((maxPxY - 0.001) / 256);

  const tilesX = endTileX - startTileX + 1;
  const tilesY = endTileY - startTileY + 1;

  const gridOriginPxX = startTileX * 256;
  const gridOriginPxY = startTileY * 256;

  // viewport top-left in grid-local coords
  const vpInGridX = minPxX - gridOriginPxX;
  const vpInGridY = minPxY - gridOriginPxY;

  const tiles = [];
  for (let dy = 0; dy < tilesY; dy++) {
    for (let dx = 0; dx < tilesX; dx++) {
      tiles.push({
        x: startTileX + dx,
        y: startTileY + dy,
        zoom: zoom,
        left: dx * 256,
        top: dy * 256,
      });
    }
  }

  return {
    tiles,
    grid: {
      width: tilesX * 256,
      height: tilesY * 256,
      offsetX: -vpInGridX,  // negative left to scroll grid into viewport
      offsetY: -vpInGridY,
    },
    pin: {
      x: pinPxX - gridOriginPxX - vpInGridX,
      y: pinPxY - gridOriginPxY - vpInGridY,
    },
  };
}

function MapPin() {
  return (
    <svg width="34" height="44" viewBox="0 0 34 44" style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))' }}>
      {/* tail */}
      <path d="M17 28 L11 38 L23 38 Z" fill="#0a0a0a"/>
      {/* outer ring */}
      <circle cx="17" cy="15" r="13" fill="#f0ece0" stroke="#0a0a0a" strokeWidth="2"/>
      {/* center dot */}
      <circle cx="17" cy="15" r="5" fill="#0a0a0a"/>
    </svg>
  );
}

function ConfirmationMap({ lat, lon, approximate = false, height = 240, width }) {
  // We don't know the actual rendered width until layout; use prop or fall back to 384 (412 - 28px gutter).
  const W = width || 384;
  const H = height;
  const { tiles, grid, pin } = tilesForLocation(lat, lon, 12, W, H);

  return (
    <div>
      <div style={{
        position: 'relative',
        width: '100%', height: H,
        overflow: 'hidden',
        border: `1px solid ${TOK.ink}`,
        background: '#f2f0eb',
      }}>
        {/* Tile grid */}
        <div style={{
          position: 'absolute',
          left: grid.offsetX, top: grid.offsetY,
          width: grid.width, height: grid.height,
        }}>
          {tiles.map((t, i) => (
            <img
              key={i}
              src={`https://a.basemaps.cartocdn.com/light_all/${t.zoom}/${t.x}/${t.y}.png`}
              style={{
                position: 'absolute',
                left: t.left, top: t.top,
                width: 256, height: 256,
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
              alt=""
              loading="lazy"
            />
          ))}
        </div>

        {/* Subtle bottom vignette so chips read against light tiles */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 75%, rgba(10,10,10,0.04) 100%)`,
          pointerEvents: 'none',
        }}/>

        {/* Pin */}
        <div style={{
          position: 'absolute',
          left: pin.x, top: pin.y,
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'none',
        }}>
          <MapPin/>
        </div>

        {/* Approximate badge */}
        {approximate && (
          <div style={{
            position: 'absolute',
            top: 10, left: 10, right: 10,
            padding: '8px 10px',
            background: TOK.surface,
            border: `1px solid ${TOK.signal}`,
            borderLeft: `3px solid ${TOK.signal}`,
            fontFamily: TOK.sans, fontSize: 12, color: TOK.ink, lineHeight: 1.35,
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{
              fontFamily: TOK.mono, fontSize: 10, letterSpacing: 1.2,
              color: TOK.signal, fontWeight: 700, marginTop: 1, whiteSpace: 'nowrap',
            }}>⚠ APPROX</span>
            <span>
              <b style={{ color: TOK.ink, fontWeight: 500 }}>Approximate location.</b>{' '}
              <span style={{ color: TOK.ink2 }}>Verify this matches the property you're researching.</span>
            </span>
          </div>
        )}

        {/* Scale + attribution chip */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          fontFamily: TOK.mono, fontSize: 9, color: TOK.ink,
          background: 'rgba(255,255,255,0.92)',
          padding: '3px 7px',
          letterSpacing: 0.5,
          border: `1px solid ${TOK.line}`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            display: 'inline-block', width: 18, height: 3,
            background: TOK.ink,
          }}/>
          <span>~5 KM</span>
        </div>
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          fontFamily: TOK.mono, fontSize: 9, color: TOK.ink,
          background: 'rgba(255,255,255,0.92)',
          padding: '3px 7px',
          letterSpacing: 0.5,
          border: `1px solid ${TOK.line}`,
        }}>
          © OSM · CARTO
        </div>
      </div>

      {/* Caption */}
      <div style={{
        marginTop: 8,
        fontFamily: TOK.mono, fontSize: 10, color: TOK.ink3,
        lineHeight: 1.5, letterSpacing: 0.3,
      }}>
        <b style={{ color: TOK.ink2, fontWeight: 600, letterSpacing: 0.6 }}>PIN SHOWS GEOCODED LOCATION.</b>{' '}
        Score reflects neighborhood-level flood data, not parcel boundaries.
      </div>
    </div>
  );
}

Object.assign(window, { ConfirmationMap });
