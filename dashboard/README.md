# Multi-Model-RAG Dashboard

A standalone Next.js dashboard workspace for Multi-Model-RAG with:

- Perplexity-style answer engine layout
- responsive sidebar, composer, answer canvas, and citation rail
- multimodal upload and parser-status surfaces
- cloned-product integrations surfaced as runnable playbooks
- runtime observability and benchmark-backed evaluation routes
- premium gradients, motion, and a lightweight 3D visualization layer
- a thin Python API bridge with graceful mock fallback

## Run the frontend

```bash
cd dashboard
npm install
npm run dev
```

The frontend works even without the Python bridge by falling back to realistic mock data.

## One-command start

From the repository root:

```bash
bash start.sh
```

That starts the Python bridge in the background if it is not already running,
then launches the dashboard dev server.

If you want the local package installed manually instead of using `start.sh`:

```bash
pip install -e '.[dashboard]'
```

## Run the Python dashboard bridge

From the repository root:

```bash
pip install 'multi-model-rag[dashboard]'
python -m multi_model_rag.dashboard_api
```

Then point the frontend at it:

```bash
export NEXT_PUBLIC_MULTIMODEL_API_BASE_URL=http://127.0.0.1:8000
cd dashboard
npm run dev
```

### Live mode environment

The bridge stays in demo mode unless you configure a live provider.

OpenAI-compatible runtime:

```bash
export MMR_DASHBOARD_MODE=live
export MMR_DASHBOARD_PROVIDER=openai
export OPENAI_API_KEY=...
```

Ollama runtime:

```bash
export MMR_DASHBOARD_MODE=live
export MMR_DASHBOARD_PROVIDER=ollama
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_LLM_MODEL=llama3.2
export OLLAMA_EMBEDDING_MODEL=nomic-embed-text
export OLLAMA_EMBEDDING_DIM=768
```

## Key files

- `src/app/page.tsx` — dashboard entry
- `src/app/collections/page.tsx` — collections workspace
- `src/app/playbooks/page.tsx` — workflow presets inspired by RAGFlow, Dify, Open WebUI, and AnythingLLM
- `src/app/parser-fleet/page.tsx` — parser operations view
- `src/app/knowledge-graph/page.tsx` — graph-oriented evidence workspace
- `src/app/evaluation/page.tsx` — benchmark-backed quality lab
- `src/components/dashboard-shell.tsx` — main UI composition
- `src/components/playbooks-shell.tsx` — runnable playbooks + observability surface
- `src/components/knowledge-constellation.tsx` — lightweight 3D scene
- `src/lib/api.ts` — frontend bridge client with mock fallback
- `../multi_model_rag/dashboard_api.py` — FastAPI bridge

## Dashboard API surfaces

The bridge now exposes product-facing routes for:

- `/api/dashboard/playbooks` — runnable workflow presets derived from cloned RAG products
- `/api/dashboard/observability` — runtime posture, benchmark status, and operator notes
- `/api/dashboard/evaluation` — plain-vs-RAG benchmark readout
- `/api/dashboard/evaluation/run` — trigger a fresh benchmark run through the active runtime

## Evaluation workflow

The evaluation page now supports an in-product **Run fresh benchmark** action.

- In **mock mode**, it returns a stable benchmark contract for UI-safe iteration.
- In **live mode**, it runs the benchmark through the configured provider/runtime and
  persists the updated artifact for the evaluation lab to read.
