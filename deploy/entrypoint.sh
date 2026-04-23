#!/usr/bin/env bash
# entrypoint for the multi-model-rag container.
# - Ensures the data dirs exist (even when a volume is freshly mounted)
# - Maps Railway/Render-injected $PORT onto the dashboard port
# - Allows any command override (e.g. `docker run ... bash`)
# - Defaults to supervisord running backend + dashboard
set -euo pipefail

mkdir -p "${MMR_DASHBOARD_WORKING_DIR:-/data/rag_storage}" \
         "${MMR_DASHBOARD_OUTPUT_DIR:-/data/output}" \
         "${MMR_DASHBOARD_UPLOAD_DIR:-/data/uploads}" \
         /var/log/supervisor || true

# Railway / Render / Cloud Run inject $PORT for the one public port.
# Route it to the dashboard, which proxies /api/dashboard/* to the backend.
if [ -n "${PORT:-}" ]; then
    export DASHBOARD_PORT="$PORT"
fi
export HOST="${HOST:-0.0.0.0}"
export BACKEND_PORT="${BACKEND_PORT:-8000}"
export DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
export NEXT_PUBLIC_MULTIMODEL_API_BASE_URL="${NEXT_PUBLIC_MULTIMODEL_API_BASE_URL:-}"

# If an .env is mounted at /data/.env, source it (without clobbering real env vars).
if [ -f /data/.env ]; then
    set -a
    # shellcheck disable=SC1091
    . /data/.env
    set +a
fi

exec "$@"
