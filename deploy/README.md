# Docker Deployment

Multi-Model-RAG ships an **all-in-one image** that runs both the FastAPI
backend and the Next.js dashboard under `supervisord`. Designed for single-
container cloud deploys (Fly.io, Render, Railway, ECS Fargate, Azure
Container Apps, Cloud Run, …).

## Quick start (local)

```bash
# Build & run the whole stack + an Ollama sidecar:
docker compose up --build

# Dashboard:  http://localhost:3000
# Backend:    http://localhost:8000/docs
```

First boot pulls `gemma3:1b` + `nomic-embed-text` into the `ollama` volume.

## Build standalone

```bash
docker build \
  --build-arg NEXT_PUBLIC_MULTIMODEL_API_BASE_URL=https://your-domain.example \
  -t multi-model-rag:latest .
```

## Run standalone (BYO Ollama / OpenAI)

```bash
docker run --rm -p 3000:3000 -p 8000:8000 \
  -v $(pwd)/data:/data \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  multi-model-rag:latest
```

OpenAI variant:

```bash
docker run --rm -p 3000:3000 -p 8000:8000 \
  -v $(pwd)/data:/data \
  -e MMR_DASHBOARD_PROVIDER=openai \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e OPENAI_LLM_MODEL=gpt-4o-mini \
  -e OPENAI_EMBEDDING_MODEL=text-embedding-3-small \
  multi-model-rag:latest
```

## Ports & volumes

| Port | Service                              |
|------|--------------------------------------|
| 3000 | Next.js dashboard                    |
| 8000 | FastAPI backend + OpenAPI at `/docs` |

| Path                | Purpose                                        |
|---------------------|------------------------------------------------|
| `/data/rag_storage` | LightRAG KV + vector stores (persist this!)    |
| `/data/output`      | Parsed MinerU / Docling output                 |
| `/data/uploads`     | Files uploaded via the dashboard               |
| `/data/.env`        | Optional runtime env file (auto-sourced)       |

Mount `/data` on a persistent volume in production.

## Cloud deploy notes

- **Single port (Fly / Render / Railway)**: expose `:3000` publicly, proxy
  `/api/*` to `127.0.0.1:8000`, set build-arg
  `NEXT_PUBLIC_MULTIMODEL_API_BASE_URL` to your public URL.
- **Split deploy**: run two copies of this image, one overriding `CMD` to
  `uvicorn multi_model_rag.dashboard_api:app ...`, the other to
  `node dashboard/server.js`. Point the dashboard at the backend's URL.
- **Sizing**: idle ≈ 250 MB. With MinerU in use, give the container
  **≥ 2 GB RAM**. GPU not required (Ollama can use host GPU if shared via
  device mapping).
- **Healthcheck**: built-in `GET /health` on :8000.

## Trimming the image

The default image bundles LibreOffice + WeasyPrint + CJK fonts for the full
parser matrix. Drop them from the `runtime` stage of `Dockerfile` if you
don't need `.docx` / `.pptx` or rich-markdown PDF output — saves ~400 MB.
