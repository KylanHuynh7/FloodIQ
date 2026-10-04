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

// Pick a round distance whose bar is at most ~90px at this latitude/zoom.
function scaleBar(lat: number, zoom: number): { px: number; label: string } {
  const metersPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const steps = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const meters = [...steps].reverse().find((m) => m / metersPerPx <= 90) ?? steps[0];
  return {
    px: Math.round(meters / metersPerPx),
    label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
  };
}

function MapPin() {
  return (
    <div className="relative">
      <span
        className="absolute left-1/2 bottom-0 h-8 w-8 -translate-x-1/2 translate-y-1/2 rounded-full bg-signal"
        style={{ animation: "floodiq-ping 2.2s ease-out infinite" }}
        aria-hidden
      />
      <svg
        width="30"
        height="40"
        viewBox="0 0 30 40"
        className="relative block"
        style={{ filter: "drop-shadow(0 3px 4px rgba(15,36,48,0.35))" }}
        aria-hidden
      >
        <path d="M15 39 C 15 39 2 23 2 14 a13 13 0 0 1 26 0 c0 9 -13 25 -13 25z" fill="#0f2430" stroke="#fff" strokeWidth="1.5" />
        <circle cx="15" cy="14" r="5" fill="#f2b544" />
      </svg>
    </div>
  );
}

export function ConfirmationMap({
  lat,
  lon,
  approximate = false,
  height = 240,
  zoom = 14,
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
  const scale = scaleBar(lat, zoom);

  return (
    <div>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden border-2 border-ink bg-surface-2"
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
              {layout.tiles.flatMap((t) =>
                // Esri Light Gray Canvas: base layer + separate label layer.
                // (CARTO's free basemaps now return "API key required" tiles.)
                ["Base", "Reference"].map((layer) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={`${layer}-${t.zoom}-${t.x}-${t.y}`}
                    src={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_${layer}/MapServer/tile/${t.zoom}/${t.y}/${t.x}`}
                    alt=""
                    loading="lazy"
                    className="pointer-events-none absolute select-none"
                    style={{ left: t.left, top: t.top, width: 256, height: 256 }}
                  />
                )),
              )}
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
          <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-start gap-x-2 border-2 border-ink bg-signal px-3 py-2 text-[12.5px] leading-[1.4] text-ink">
            <span className="font-semibold">Approximate location.</span>
            <span>Check that the pin is on the right property.</span>
          </div>
        )}

        {!approximate && (
          <div className="absolute top-2 left-2 border border-ink/20 bg-white/90 px-2 py-1 font-mono text-[10.5px] text-ink-2">
            {Math.abs(lat).toFixed(4)}°{lat >= 0 ? "N" : "S"} {Math.abs(lon).toFixed(4)}°{lon >= 0 ? "E" : "W"}
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 border border-ink/20 bg-white/90 px-2 py-1 font-mono text-[10.5px] text-ink-2">
          <span
            className="inline-block h-[5px] border-x-2 border-b-2 border-ink-2"
            style={{ width: scale.px }}
          />
          <span>{scale.label}</span>
        </div>
        <div className="absolute bottom-2 left-2 max-w-[calc(100%-110px)] border border-ink/20 bg-white/90 px-2 py-1 text-[10px] leading-[1.3] text-ink-3">
          © Esri · HERE · Garmin · OpenStreetMap
        </div>
      </div>

      <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-3">
        Pin shows the geocoded location. Scores use neighborhood-level flood
        data, not parcel boundaries.
      </p>
    </div>
  );
}
