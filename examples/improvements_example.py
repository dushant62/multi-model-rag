"""
improvements_example.py
=======================
Demonstrates all five 2025 RAG improvement techniques available in Multi-Model-RAG.

Requirements
------------
- Set OPENAI_API_KEY (or equivalent LLM env vars) before running.
- pip install multi-model-rag[quality]   # for FlagEmbedding reranker

Run
---
    python examples/improvements_example.py

What this script shows
-----------------------
1. Global config  — enable improvements via ``MultiModelRAGConfig``
2. Per-query overrides — use ``rag_*`` kwargs on ``rag.aquery()`` to
   toggle individual features without changing the shared config
3. Adaptive routing   — automatic retrieval-mode selection
4. HyDE               — hypothetical document embedding
5. Keyword extraction — hl/ll keyword injection into LightRAG
6. Query decomposition — multi-part question splitting + synthesis
7. Multi-query        — variant generation for improved recall
"""

import asyncio
import os

# ---------------------------------------------------------------------------
# 1. Configure the RAG system with improvements enabled
# ---------------------------------------------------------------------------
from multi_model_rag import MultiModelRAG, MultiModelRAGConfig

config = MultiModelRAGConfig(
    # LLM / embedding (pick up from env; these are just explicit examples)
    llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
    embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
    # RAG improvements — all toggle-able
    enable_adaptive_routing=True,   # on by default; auto-selects mode
    enable_keyword_extraction=True, # on by default; enriches KG traversal
    enable_reranker=True,           # on by default; needs FlagEmbedding extra
    enable_hyde=False,              # off by default; enable per-query if needed
    enable_multi_query=False,       # off by default
    enable_query_decomposition=False,
    response_type="Multiple Paragraphs",
)

rag = MultiModelRAG(config=config)


async def main() -> None:
    # Ingest a small document so the corpus is non-empty
    await rag.ainsert(
        """
        Transformers are deep learning models based on the self-attention mechanism
        introduced by Vaswani et al. in 2017.  They replaced RNNs as the dominant
        architecture for NLP and are now used in vision, speech, and multimodal
        tasks.  Key variants include BERT (encoder-only), GPT (decoder-only), and
        T5 / BART (encoder-decoder).  Scaling laws show that model quality improves
        predictably with more parameters and more data.
        """
    )

    # ------------------------------------------------------------------
    # 2. Standard query — adaptive routing + keyword extraction active
    # ------------------------------------------------------------------
    print("=== Standard query (auto routing + keyword extraction) ===")
    result = await rag.aquery("What is the self-attention mechanism?")
    print(result[:400], "...\n")

    # ------------------------------------------------------------------
    # 3. Force HyDE on for a single query (per-query override)
    # ------------------------------------------------------------------
    print("=== With HyDE (per-query override) ===")
    result = await rag.aquery(
        "Explain how transformers replaced RNNs.",
        rag_enable_hyde=True,
    )
    print(result[:400], "...\n")

    # ------------------------------------------------------------------
    # 4. Force multi-query on for a single query
    # ------------------------------------------------------------------
    print("=== With multi-query expansion (per-query override) ===")
    result = await rag.aquery(
        "What are the main transformer variants?",
        rag_enable_multi_query=True,
    )
    print(result[:400], "...\n")

    # ------------------------------------------------------------------
    # 5. Force query decomposition on for a complex question
    # ------------------------------------------------------------------
    print("=== With query decomposition (per-query override) ===")
    result = await rag.aquery(
        "Compare BERT and GPT architectures and explain which tasks each excels at.",
        rag_enable_decomposition=True,
    )
    print(result[:400], "...\n")

    # ------------------------------------------------------------------
    # 6. Override response format + disable adaptive routing
    # ------------------------------------------------------------------
    print("=== Bullet-point response, manual mode ===")
    result = await rag.aquery(
        "List the key scaling-law findings for transformers.",
        rag_adaptive_routing=False,   # use the mode= kwarg as-is
        rag_response_type="Bullet Points",
        mode="global",
    )
    print(result[:400], "...\n")


if __name__ == "__main__":
    asyncio.run(main())
