# FloodIQ frontend

Next.js app for FloodIQ: landing page, scoring progress, result report, and error pages. See the [root README](../README.md) for the full architecture.

```bash
npm install
npm run dev     # http://localhost:3000
```

In local development, `/api/*` and `/report/*.pdf` are proxied to the FastAPI backend on `localhost:8000` (see `next.config.ts`), so start the backend first. To point at another backend, set `FLOODIQ_BACKEND_ORIGIN`.

On Vercel, `NEXT_PUBLIC_FLOODIQ_API_BASE` is set to `https://flood-iq-api.vercel.app` and the browser calls the backend directly (see `lib/api.ts`).

Key pieces:

| Path | What it is |
|---|---|
| `app/page.tsx` | Landing page and address search |
| `app/score/page.tsx` | Scoring progress (tide gauge), error classification |
| `app/result/[token]/page.tsx` | Result report |
| `components/HorizonExplorer.tsx` | Horizon tabs, trajectory chart, "typical for this county" view |
| `components/ConfirmationMap.tsx` | Esri tile map with geocoded pin |
| `lib/tokens.ts` | Shared types, risk bands, hazard levels |

Note: this repo pins Next.js 16, which has breaking changes from earlier versions (see `AGENTS.md`).
