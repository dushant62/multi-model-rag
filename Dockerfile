# syntax=docker/dockerfile:1.7
#
# Multi-Model-RAG — all-in-one production image.
#
# Runs two processes under supervisord:
#   - FastAPI backend (uvicorn) on :8000   (multi_model_rag.dashboard_api:app)
#   - Next.js dashboard  on :3000          (standalone output)
#
# Build:    docker build -t multi-model-rag:latest .
# Run:      docker run --rm -p 3000:3000 -p 8000:8000 \
#              -e OLLAMA_HOST=http://host.docker.internal:11434 \
#              multi-model-rag:latest
#
# For a cloud deploy behind a single port, expose only :3000 and have the
# dashboard proxy / call the backend at 127.0.0.1:8000 in-container.

# -----------------------------------------------------------------------------
# Stage 1 — dashboard build (Next.js standalone)
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS dashboard-build
WORKDIR /app/dashboard

# Install dependencies with cache-friendly layer ordering.
COPY dashboard/package.json dashboard/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Copy the rest and build. Next needs the standalone output mode.
COPY dashboard/ ./
ENV NEXT_TELEMETRY_DISABLED=1
# API base URL is read at build time for static pages; override at runtime via
# NEXT_PUBLIC_MULTIMODEL_API_BASE_URL if you deploy behind a reverse proxy.
ARG NEXT_PUBLIC_MULTIMODEL_API_BASE_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_MULTIMODEL_API_BASE_URL=${NEXT_PUBLIC_MULTIMODEL_API_BASE_URL}
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — Python deps builder (isolated to keep final image slim)
# -----------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS py-build
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

# Build tools for any source-built wheels (weasyprint/paddleocr transitive deps).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pyproject.toml setup.py requirements.txt MANIFEST.in README.md ./
COPY multi_model_rag ./multi_model_rag

# Install into a dedicated prefix so we can copy it cleanly into the runtime
# image without dragging the apt build-essential chain along.
RUN pip install --prefix=/install -e . \
    && pip install --prefix=/install \
        "fastapi>=0.115.0" \
        "uvicorn[standard]>=0.30.0" \
        "python-multipart>=0.0.9" \
        "ollama>=0.4.0" \
        "python-dotenv"

# -----------------------------------------------------------------------------
# Stage 3 — runtime (slim, with Node for the dashboard + supervisord)
# -----------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    MULTIMODEL_LOG_LEVEL=INFO \
    HOST=0.0.0.0 \
    BACKEND_PORT=8000 \
    DASHBOARD_PORT=3000 \
    MMR_DASHBOARD_MODE=live \
    NEXT_PUBLIC_MULTIMODEL_API_BASE_URL=http://127.0.0.1:8000 \
    WORKING_DIR=/data/rag_storage \
    MMR_DASHBOARD_WORKING_DIR=/data/rag_storage \
    MMR_DASHBOARD_OUTPUT_DIR=/data/output \
    MMR_DASHBOARD_UPLOAD_DIR=/data/uploads

# Native runtime deps:
#   - libreoffice-core/writer  → .docx/.pptx conversion (office extra)
#   - libpango / fonts-*       → WeasyPrint PDF rendering (markdown extra)
#   - poppler-utils            → MinerU PDF page rendering
#   - supervisor               → multi-process orchestration
#   - curl                     → HEALTHCHECK
#   - nodejs                   → run Next.js standalone server
# Keep the list conservative; trim further for a smaller image if you don't
# use the office / markdown features.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        supervisor \
        nodejs \
        poppler-utils \
        libpango-1.0-0 libpangoft2-1.0-0 \
        fonts-noto-cjk fonts-dejavu-core \
        libreoffice-core libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

# --- Python runtime ---------------------------------------------------------
COPY --from=py-build /install /usr/local
# Keep the source tree so the editable install resolves and dashboard_api can
# import prompts / static assets packaged alongside.
WORKDIR /app
COPY pyproject.toml setup.py requirements.txt README.md ./
COPY multi_model_rag ./multi_model_rag
COPY scripts ./scripts

# --- Dashboard runtime (Next.js standalone) ---------------------------------
# The standalone bundle lives at dashboard/.next/standalone and is
# self-contained except for the static/ and public/ dirs which Next expects
# alongside it.
COPY --from=dashboard-build /app/dashboard/.next/standalone /app/dashboard/
COPY --from=dashboard-build /app/dashboard/.next/static     /app/dashboard/.next/static
COPY --from=dashboard-build /app/dashboard/public           /app/dashboard/public

# --- supervisord config -----------------------------------------------------
COPY deploy/supervisord.conf /etc/supervisor/conf.d/multi-model-rag.conf
COPY deploy/entrypoint.sh    /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /data/rag_storage /data/output /data/uploads /var/log/supervisor

# Note: no VOLUME directive — Railway forbids it. Mount a Railway Volume at /data
# in the dashboard (Service → Variables → Volumes) for persistent rag_storage/uploads.
EXPOSE 3000 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf", "-n"]
