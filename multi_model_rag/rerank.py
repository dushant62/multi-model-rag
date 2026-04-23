from __future__ import annotations

import asyncio
from typing import Any, Callable, Dict, List, Optional, Sequence


def format_rerank_results(
    scores: Sequence[float], top_n: Optional[int] = None
) -> List[Dict[str, float | int]]:
    """Convert raw reranker scores into LightRAG-compatible results."""
    normalized_scores = [float(score) for score in scores]
    ranked_indexes = sorted(
        range(len(normalized_scores)),
        key=lambda index: normalized_scores[index],
        reverse=True,
    )

    if top_n is not None:
        ranked_indexes = ranked_indexes[:top_n]

    return [
        {"index": index, "relevance_score": normalized_scores[index]} for index in ranked_indexes
    ]


def create_flagembedding_reranker(
    model_name: str = "BAAI/bge-reranker-v2-m3",
    *,
    use_fp16: bool = False,
    device: str | None = None,
    **model_kwargs: Any,
) -> Callable[..., Any]:
    """Create an async rerank function backed by FlagEmbedding."""
    try:
        from FlagEmbedding import FlagReranker
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "FlagEmbedding is not installed. Install quality dependencies with "
            "`pip install 'multi-model-rag[quality]'`."
        ) from exc

    reranker = FlagReranker(
        model_name,
        use_fp16=use_fp16,
        device=device,
        **model_kwargs,
    )

    async def rerank(
        query: str,
        documents: List[str],
        top_n: Optional[int] = None,
        **kwargs: Any,
    ) -> List[Dict[str, float | int]]:
        if not documents:
            return []

        def compute() -> List[Dict[str, float | int]]:
            pairs = [[query, document] for document in documents]
            scores = reranker.compute_score(pairs, **kwargs)

            if isinstance(scores, (int, float)):
                score_list = [float(scores)]
            else:
                score_list = [float(score) for score in scores]

            return format_rerank_results(score_list, top_n=top_n)

        return await asyncio.to_thread(compute)

    return rerank
