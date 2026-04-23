#!/usr/bin/env bash
# entrypoint for the multi-model-rag container.
# - Ensures the data dirs exist (even when a volume is freshly mounted)
# - Allows any command override (e.g. `docker run ... bash`)
# - Defaults to supervisord running backend + dashboard
set -euo pipefail

mkdir -p "${MMR_DASHBOARD_WORKING_DIR:-/data/rag_storage}" \
         "${MMR_DASHBOARD_OUTPUT_DIR:-/data/output}" \
         "${MMR_DASHBOARD_UPLOAD_DIR:-/data/uploads}"

# If an .env is mounted at /data/.env, source it (without clobbering real env vars).
if [ -f /data/.env ]; then
    set -a
    # shellcheck disable=SC1091
    . /data/.env
    set +a
fi

exec "$@"
