"use client";

import { useEffect, useRef, useState } from "react";

type Tile = { x: number; y: number; zoom: number; left: number; top: number };

type TileLayout = {
  tiles: Tile[];
  grid: { width: number; height: number; offsetX: number; offsetY: number };
  pin: { x: number; y: number };
};

function tilesForLocation(
  lat: number,
  lon: number,
  zoom: number,
  viewportW: number,
  viewportH: number,
): TileLayout {
  const n = Math.pow(2, zoom);
  const xtileF = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const ytileF =
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;

  const pinPxX = xtileF * 256;
  const pinPxY = ytileF * 256;

  const minPxX = pinPxX - viewportW / 2;
  const minPxY = pinPxY - viewportH / 2;
  const maxPxX = pinPxX + viewportW / 2;
  const maxPxY = pinPxY + viewportH / 2;

  const startTileX = Math.floor(minPxX / 256);
  const startTileY = Math.floor(minPxY / 256);
  const endTileX = Math.floor((maxPxX - 0.001) / 256);
  const endTileY = Math.floor((maxPxY - 0.001) / 256);

  const tilesX = endTileX - startTileX + 1;
  const tilesY = endTileY - startTileY + 1;
  const gridOriginPxX = startTileX * 256;
  const gridOriginPxY = startTileY * 256;
  const vpInGridX = minPxX - gridOriginPxX;
  const vpInGridY = minPxY - gridOriginPxY;

  const tiles: Tile[] = [];
  for (let dy = 0; dy < tilesY; dy++) {
    for (let dx = 0; dx < tilesX; dx++) {
      tiles.push({
        x: startTileX + dx,
        y: startTileY + dy,
        zoom,
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
      offsetX: -vpInGridX,
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
    <svg
      width="34"
      height="44"
      viewBox="0 0 34 44"
      className="block"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}
      aria-hidden
    >
      <path d="M17 28 L11 38 L23 38 Z" fill="#0a0a0a" />
      <circle cx="17" cy="15" r="13" fill="#f0ece0" stroke="#0a0a0a" strokeWidth="2" />
      <circle cx="17" cy="15" r="5" fill="#0a0a0a" />
    </svg>
  );
}

export function ConfirmationMap({
  lat,
  lon,
  approximate = false,
  height = 240,
  zoom = 12,
}: {
  lat: number;
  lon: number;
  approximate?: boolean;
  height?: number;
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = w > 0 ? tilesForLocation(lat, lon, zoom, w, height) : null;

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden border border-ink bg-[#f2f0eb]"
        style={{ height }}
      >
        {layout && (
          <>
            <div
              className="absolute"
              style={{
                left: layout.grid.offsetX,
                top: layout.grid.offsetY,
                width: layout.grid.width,
                height: layout.grid.height,
              }}
            >
              {layout.tiles.map((t) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={`${t.zoom}-${t.x}-${t.y}`}
                  src={`https://a.basemaps.cartocdn.com/light_all/${t.zoom}/${t.x}/${t.y}.png`}
                  alt=""
                  loading="lazy"
                  className="pointer-events-none absolute select-none"
                  style={{ left: t.left, top: t.top, width: 256, height: 256 }}
                />
              ))}
            </div>

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 75%, rgba(10,10,10,0.04) 100%)",
              }}
            />

            <div
              className="pointer-events-none absolute"
              style={{
                left: layout.pin.x,
                top: layout.pin.y,
                transform: "translate(-50%, -100%)",
              }}
            >
              <MapPin />
            </div>
          </>
        )}

        {approximate && (
          <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start gap-2 border border-signal border-l-[3px] bg-surface px-2.5 py-2 font-sans text-[12px] leading-[1.35] text-ink">
            <span className="mt-0.5 whitespace-nowrap font-mono text-[10px] font-bold tracking-[1.2px] text-signal">
              ⚠ APPROX
            </span>
            <span>
              <b className="font-medium text-ink">Approximate location.</b>{" "}
              <span className="text-ink-2">
                Verify this matches the property you&apos;re researching.
              </span>
            </span>
          </div>
        )}

        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 border border-line bg-white/90 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.5px] text-ink">
          <span className="inline-block h-[3px] w-[18px] bg-ink" />
          <span>~5 KM</span>
        </div>
        <div className="absolute bottom-2 left-2 border border-line bg-white/90 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.5px] text-ink">
          © OSM · CARTO
        </div>
      </div>

      <div className="mt-2 font-mono text-[10px] leading-[1.5] tracking-[0.3px] text-ink-3">
        <b className="font-semibold tracking-[0.6px] text-ink-2">
          PIN SHOWS GEOCODED LOCATION.
        </b>{" "}
        Score reflects neighborhood-level flood data, not parcel boundaries.
      </div>
    </div>
  );
}
