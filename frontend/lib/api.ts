// Base for backend calls.
//
// - In local dev, NEXT_PUBLIC_FLOODIQ_API_BASE is unset → empty string → fetch
//   calls use relative URLs like "/api/score", which Next.js's rewrites in
//   next.config.ts proxy to the local FastAPI on :8000. Zero config needed.
// - In production (Vercel), set NEXT_PUBLIC_FLOODIQ_API_BASE to the public
//   backend URL (e.g. the localhost.run tunnel). Fetches become absolute and
//   bypass Vercel's edge proxy — which blocks tunneling-service hostnames
//   with DNS_HOSTNAME_RESOLVED_PRIVATE.
export const API_BASE = process.env.NEXT_PUBLIC_FLOODIQ_API_BASE ?? "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
