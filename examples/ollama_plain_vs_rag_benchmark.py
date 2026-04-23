"""
Local plain-vs-RAG benchmark using Ollama with Multi-Model-RAG.

This example compares:
1. a plain local model answer, and
2. the same model after grounding through Multi-Model-RAG.

Requirements:
- pip install 'multi-model-rag[dashboard]'
- Ollama running locally
- A chat model and embedding model pulled into Ollama

Example:
    export OLLAMA_HOST=http://localhost:11434
    export OLLAMA_LLM_MODEL=gemma3:1b
    export OLLAMA_EMBEDDING_MODEL=nomic-embed-text
    export OLLAMA_EMBEDDING_DIM=768
    python examples/ollama_plain_vs_rag_benchmark.py
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Dict, List, Optional

import numpy as np
import ollama
from lightrag.llm.openai import openai_complete_if_cache

from multi_model_rag import run_plain_vs_rag_benchmark

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "gemma3:1b")
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_EMBEDDING_DIM = int(os.getenv("OLLAMA_EMBEDDING_DIM", "768"))
OLLAMA_BASE_URL = f"{OLLAMA_HOST}/v1"

QUESTION = (
    "What is the codename for the parser fallback strategy, and which reranking "
    "stack was approved in the project brief?"
)

DOCUMENT_TEXT = """
Project Helix internal research brief

The parser fallback strategy for the next multimodal release is code-named
Helix-Saffron. The approved retrieval stack for the pilot rollout combines BGE
reranking with ColBERT late interaction. The September board review is scheduled
for 17 September 2026. This note is internal and is not intended to appear in
public marketing material.
""".strip()


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
    result = await run_plain_vs_rag_benchmark(
        question=QUESTION,
        document_text=DOCUMENT_TEXT,
        expected_facts={
            "parser_fallback_codename": "Helix-Saffron",
            "approved_reranking_stack": "BGE reranking with ColBERT late interaction",
        },
        llm_model_func=ollama_llm_model_func,
        embedding_func=ollama_embedding_async,
        model_label=OLLAMA_LLM_MODEL,
        embedding_model_label=OLLAMA_EMBEDDING_MODEL,
    )

    print(
        json.dumps(
            result.to_dict(),
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
