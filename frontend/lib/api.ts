// Base for backend calls.
//
// - In local dev, NEXT_PUBLIC_FLOODIQ_API_BASE is unset → empty string → fetch
//   calls use relative URLs like "/api/score", which Next.js's rewrites in
//   next.config.ts proxy to the local FastAPI on :8000. Zero config needed.
// - On Vercel, NEXT_PUBLIC_FLOODIQ_API_BASE is the backend project's URL
//   (https://flood-iq-api.vercel.app), so fetches go straight to it. The
//   browser calls the backend directly (not via a rewrite) so the backend
//   sees each visitor's real IP for rate limiting.
export const API_BASE = process.env.NEXT_PUBLIC_FLOODIQ_API_BASE ?? "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
