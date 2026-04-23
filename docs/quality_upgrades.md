# Quality upgrades for Multi-Model-RAG

This guide documents the first practical quality-focused upgrade path for the
project: **reranking + local plain-vs-RAG benchmarking**, plus the
**dashboard evaluation surface** that exposes those results inside the product.

## Install quality dependencies

```bash
pip install 'multi-model-rag[quality]'
```

If you also want the local Ollama benchmark examples:

```bash
pip install 'multi-model-rag[quality,dashboard]'
```

## 1. FlagEmbedding reranker integration

Multi-Model-RAG already passes `lightrag_kwargs` into LightRAG, which makes
reranking a clean extension point.

The project now includes:

- `multi_model_rag.rerank.create_flagembedding_reranker`

This factory returns a LightRAG-compatible async rerank function with the
signature:

```python
async def rerank(query: str, documents: list[str], top_n: int | None = None) -> list[dict]:
    ...
```

### Example

See:

- `examples/flagembedding_rerank_integration_example.py`

That example wires a local FlagEmbedding reranker into `lightrag_kwargs` and
runs a small direct-content query.

## 2. Local plain-vs-RAG benchmark

See:

- `examples/ollama_plain_vs_rag_benchmark.py`
- `multi_model_rag.benchmarking.run_plain_vs_rag_benchmark`

This benchmark compares:

1. the same local model answering directly,
2. the same local model after retrieval grounding through Multi-Model-RAG.

### Example

```bash
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_LLM_MODEL=gemma3:1b
export OLLAMA_EMBEDDING_MODEL=nomic-embed-text
export OLLAMA_EMBEDDING_DIM=768

python examples/ollama_plain_vs_rag_benchmark.py
```

If you want to build on the reusable benchmark module directly:

```python
from multi_model_rag import run_plain_vs_rag_benchmark
```

The benchmarking module now includes:

- `multi_model_rag.benchmarking.evaluate_answer_against_expected`
- `multi_model_rag.benchmarking.run_plain_vs_rag_benchmark`

This makes repeated plain-vs-RAG checks part of the package instead of keeping
the evaluation logic trapped in a one-off example script.

## 3. Dashboard evaluation lab

The dashboard now includes a dedicated evaluation route:

- `/evaluation`

The backing API route is:

- `/api/dashboard/evaluation`
- `/api/dashboard/evaluation/run`

This surface is designed to make retrieval quality legible to stakeholders by
showing:

- plain model vs RAG answers side-by-side
- matched and missing expected facts
- grounding gain and latency delta
- the benchmark artifact path currently backing the view
- prioritized engineering recommendations based on the measured result

When available, the dashboard reads the saved benchmark artifact from:

- `/home/noodle/Multi-Model-RAG-lab/reports/gemma_plain_vs_rag_benchmark_output.json`

If that file is unavailable, the API falls back to an embedded benchmark payload
so the route still renders with a stable contract.

The dashboard also includes a **Run fresh benchmark** action on `/evaluation`.

- In mock mode, it returns a stable evaluation contract without requiring a live provider.
- In live mode, it executes a fresh benchmark through the configured provider/runtime
  and persists the updated artifact for later reads.

## 4. Recommended next engineering steps

After proving the local rerank and benchmark path, the best sequence is:

1. add repeatable retrieval benchmarking with **BEIR**,
2. add response evaluation with **RAGAS**,
3. use **Instructor** for structured grounded outputs,
4. add tracing/latency visibility,
5. expand serving optimizations with **vLLM**.

## Notes

- The direct-content benchmark path bypasses parser installation checks because
  it does **not** parse documents from disk; it inserts already prepared content
  directly into the retrieval system.
- This is intentional so the benchmark measures retrieval + generation quality
  rather than parser installation state.
