#!/usr/bin/env bash
# demo.sh — spin up the FloodIQ backend + public tunnel for a live demo.
#
# Run from the project root: ./demo.sh
# Leave it running for the demo. Ctrl+C when done.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

# --- Preflight ---

if [ ! -d ".venv" ]; then
  cat >&2 <<EOF
ERROR: .venv not found at $HERE/.venv

First-time setup:
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  python scripts/download_tract_centroids.py    # one-time data bootstrap
EOF
  exit 1
fi

if lsof -ti:8000 >/dev/null 2>&1; then
  cat >&2 <<EOF
ERROR: port 8000 is already in use.

To free it:
  lsof -ti:8000 | xargs kill -9
EOF
  exit 1
fi

LOG_DIR="$(mktemp -d -t floodiq-demo.XXXXXX)"
BACKEND_LOG="$LOG_DIR/backend.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"

BACKEND_PID=""
TUNNEL_PID=""

cleanup() {
  echo ""
  echo "→ Shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  # Belt-and-suspenders against stragglers
  pkill -f "uvicorn floodiq" 2>/dev/null || true
  pkill -f "ssh -R 80:localhost:8000" 2>/dev/null || true
  echo "✓ Stopped. Logs preserved at: $LOG_DIR"
}
trap cleanup EXIT INT TERM

# --- Backend ---

echo "→ Starting FastAPI backend on :8000..."
(
  # shellcheck disable=SC1091
  source .venv/bin/activate
  FLOODIQ_ALLOWED_ORIGINS="https://flood-iq.vercel.app,http://localhost:3000" \
  FLOODIQ_ALLOWED_ORIGIN_REGEX="https://flood-[a-z0-9-]+\\.vercel\\.app" \
  PYTHONPATH=. exec uvicorn floodiq.web.app:app --port 8000
) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 30); do
  if grep -q "Application startup complete" "$BACKEND_LOG" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "ERROR: backend exited before ready. Last log lines:" >&2
    tail -20 "$BACKEND_LOG" >&2
    exit 1
  fi
  sleep 1
done

if ! grep -q "Application startup complete" "$BACKEND_LOG"; then
  echo "ERROR: backend didn't become ready in 30s. Last log lines:" >&2
  tail -20 "$BACKEND_LOG" >&2
  exit 1
fi
echo "✓ Backend ready"

# --- Tunnel ---

echo "→ Opening localhost.run tunnel..."
ssh -R 80:localhost:8000 \
    -o StrictHostKeyChecking=accept-new \
    -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes \
    nokey@localhost.run >"$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for _ in $(seq 1 30); do
  TUNNEL_URL=$(grep -E -o "https://[a-z0-9.-]+\.lhr\.life" "$TUNNEL_LOG" 2>/dev/null | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then break; fi
  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "ERROR: tunnel exited before URL was provisioned. Last log lines:" >&2
    tail -20 "$TUNNEL_LOG" >&2
    exit 1
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "ERROR: didn't see a tunnel URL in 30s. Last log lines:" >&2
  tail -20 "$TUNNEL_LOG" >&2
  exit 1
fi
echo "✓ Tunnel ready"

# Copy URL to clipboard on macOS for one-step paste into Vercel.
CLIP_NOTE=""
if command -v pbcopy >/dev/null 2>&1; then
  printf "%s" "$TUNNEL_URL" | pbcopy
  CLIP_NOTE=" (copied to clipboard)"
fi

cat <<EOF

============================================================
  FLOODIQ DEMO — READY
============================================================

  Tunnel URL:
    $TUNNEL_URL$CLIP_NOTE

  Update Vercel (one-time per demo session):
    1. https://vercel.com/dashboard → flood-iq → Settings →
       Environment Variables
    2. Edit  NEXT_PUBLIC_FLOODIQ_API_BASE  → paste URL → Save
    3. Deployments → ⋯ on latest → Redeploy

  Then test:  https://flood-iq.vercel.app

  Logs:
    backend: $BACKEND_LOG
    tunnel:  $TUNNEL_LOG

  Press Ctrl+C to stop both processes.

============================================================
EOF

# Block until either child dies; exit trap handles cleanup.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$TUNNEL_PID" 2>/dev/null; do
  sleep 2
done

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "⚠ backend exited. Tail of backend.log:" >&2
  tail -10 "$BACKEND_LOG" >&2
fi
if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
  echo "⚠ tunnel exited. Tail of tunnel.log:" >&2
  tail -10 "$TUNNEL_LOG" >&2
fi
