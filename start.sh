#!/usr/bin/env bash
#
# Multi-Model-RAG — one-command launcher.
#
#   ./start.sh             # install deps (if needed), start backend, start dashboard
#   ./start.sh --no-install # skip dependency install (faster subsequent runs)
#   ./start.sh --backend    # backend only
#   ./start.sh --frontend   # frontend only (assumes backend already running)
#
# Environment overrides:
#   NEXT_PUBLIC_MULTIMODEL_API_BASE_URL   default http://127.0.0.1:8000
#   MULTIMODEL_BACKEND_PORT               default 8000

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="${NEXT_PUBLIC_MULTIMODEL_API_BASE_URL:-http://127.0.0.1:8000}"
BACKEND_PORT="${MULTIMODEL_BACKEND_PORT:-8000}"
BACKEND_LOG="${TMPDIR:-/tmp}/multimodel-rag-backend.log"

MODE="all"
SKIP_INSTALL="0"
for arg in "$@"; do
  case "$arg" in
    --backend)     MODE="backend" ;;
    --frontend)    MODE="frontend" ;;
    --no-install)  SKIP_INSTALL="1" ;;
    -h|--help)
      sed -n '1,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

info()  { printf '\033[1;36m[start]\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m[ ok  ]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }

cd "$ROOT_DIR"

if [[ "$SKIP_INSTALL" != "1" ]]; then
  info "Installing backend (pip install -e .[dashboard])"
  python -m pip install -e ".[dashboard]" >/dev/null
  ok "Backend dependencies ready"

  if [[ "$MODE" != "backend" && ! -d "$ROOT_DIR/dashboard/node_modules" ]]; then
    info "Installing dashboard (npm install)"
    (cd "$ROOT_DIR/dashboard" && npm install)
    ok "Dashboard dependencies ready"
  fi
fi

start_backend() {
  if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
    ok "Backend already running at $API_URL"
    return
  fi
  info "Starting FastAPI bridge on port $BACKEND_PORT (logs: $BACKEND_LOG)"
  MULTIMODEL_BACKEND_PORT="$BACKEND_PORT" \
    python -m multi_model_rag.dashboard_api >"$BACKEND_LOG" 2>&1 &
  for _ in $(seq 1 20); do
    sleep 0.5
    if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
      ok "Backend healthy at $API_URL"
      return
    fi
  done
  warn "Backend did not become healthy in time — check $BACKEND_LOG"
}

start_frontend() {
  info "Starting Next.js dashboard (dev server) — connecting to $API_URL"
  cd "$ROOT_DIR/dashboard"
  NEXT_PUBLIC_MULTIMODEL_API_BASE_URL="$API_URL" exec npm run dev
}

case "$MODE" in
  backend)  start_backend; wait ;;
  frontend) start_frontend ;;
  all)      start_backend; start_frontend ;;
esac
