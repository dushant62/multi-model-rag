"""
FlagEmbedding reranker integration example for Multi-Model-RAG.

This example shows how to attach a local reranker through LightRAG's
`rerank_model_func` hook using Multi-Model-RAG's `lightrag_kwargs`.

Requirements:
- pip install 'multi-model-rag[quality,dashboard]'
- An LLM + embedding backend configured (Ollama is the simplest local route)

Example:
    export OLLAMA_HOST=http://localhost:11434
    export OLLAMA_LLM_MODEL=gemma3:1b
    export OLLAMA_EMBEDDING_MODEL=nomic-embed-text
    export OLLAMA_EMBEDDING_DIM=768
    python examples/flagembedding_rerank_integration_example.py
"""

from __future__ import annotations

import asyncio
import os
import uuid
from typing import Dict, List, Optional

import numpy as np
import ollama
from dotenv import load_dotenv
from lightrag.llm.openai import openai_complete_if_cache
from lightrag.utils import EmbeddingFunc

from multi_model_rag import (
    MultiModelRAG,
    MultiModelRAGConfig,
    create_flagembedding_reranker,
)

load_dotenv()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "gemma3:1b")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_EMBEDDING_DIM = int(os.getenv("OLLAMA_EMBEDDING_DIM", "768"))
RERANK_MODEL = os.getenv("FLAGEMBEDDING_RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
OLLAMA_BASE_URL = f"{OLLAMA_HOST}/v1"


async def ollama_llm_model_func(
    prompt: str,
    system_prompt: Optional[str] = None,
    history_messages: List[Dict] = None,
    **kwargs,
) -> str:
    return await openai_complete_if_cache(
        model=OLLAMA_LLM_MODEL,
        prompt=prompt,
        system_prompt=system_prompt,
        history_messages=history_messages or [],
        base_url=OLLAMA_BASE_URL,
        api_key="ollama",
        **kwargs,
    )


async def ollama_embedding_async(texts: List[str]):
    client = ollama.AsyncClient(host=OLLAMA_HOST)
    response = await client.embed(model=OLLAMA_EMBEDDING_MODEL, input=texts)
    return np.array(response.embeddings, dtype=float)


async def main() -> int:
    rag = MultiModelRAG(
        config=MultiModelRAGConfig(
            working_dir=f"./rag_storage_flagembedding/{uuid.uuid4()}",
            parser="mineru",
            parse_method="auto",
            enable_image_processing=False,
            enable_table_processing=True,
            enable_equation_processing=True,
        ),
        llm_model_func=ollama_llm_model_func,
        embedding_func=EmbeddingFunc(
            embedding_dim=OLLAMA_EMBEDDING_DIM,
            max_token_size=8192,
            func=ollama_embedding_async,
        ),
        lightrag_kwargs={
            "rerank_model_func": create_flagembedding_reranker(RERANK_MODEL),
            "enable_llm_cache": False,
        },
    )

    # Direct content insertion does not require parser-backed file parsing.
    rag._parser_installation_checked = True
    init_result = await rag._ensure_lightrag_initialized()
    if not init_result.get("success"):
        raise RuntimeError(init_result.get("error", "Failed to initialize LightRAG"))

    await rag.insert_content_list(
        content_list=[
            {
                "type": "text",
                "text": (
                    "Release note A: The approved stack combines BGE reranking with "
                    "ColBERT late interaction for the next retrieval milestone."
                ),
                "page_idx": 0,
            },
            {
                "type": "text",
                "text": (
                    "Release note B: The previous baseline relied on dense retrieval "
                    "without a dedicated reranking layer."
                ),
                "page_idx": 1,
            },
        ],
        file_path="flagembedding_rerank_demo.txt",
        doc_id="flagembedding-demo",
        display_stats=True,
    )

    query = "Which reranking stack was approved for the next retrieval milestone?"
    answer = await rag.aquery(query, mode="hybrid")
    print("\nQuery:", query)
    print("Answer:", answer)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
