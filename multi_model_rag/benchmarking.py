from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass
from typing import Any, Awaitable, Callable, Dict, Literal, Optional

from lightrag.utils import EmbeddingFunc

from multi_model_rag.config import MultiModelRAGConfig
from multi_model_rag.multi_model_rag import MultiModelRAG

Verdict = Literal["correct", "partial", "incorrect"]


@dataclass
class AnswerEvaluation:
    answer: str
    latency_seconds: float
    matched_expected: list[str]
    missing_expected: list[str]
    verdict: Verdict


@dataclass
class PlainVsRAGBenchmarkResult:
    model: str
    embedding_model: str
    question: str
    expected_facts: Dict[str, str]
    plain_llm: AnswerEvaluation
    rag: AnswerEvaluation

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def evaluate_answer_against_expected(
    answer: str, expected_facts: Dict[str, str]
) -> tuple[list[str], list[str], Verdict]:
    normalized_answer = answer.lower()
    matched = []
    missing = []

    for label, expected_value in expected_facts.items():
        if expected_value.lower() in normalized_answer:
            matched.append(label)
        else:
            missing.append(label)

    if len(matched) == len(expected_facts):
        verdict: Verdict = "correct"
    elif matched:
        verdict = "partial"
    else:
        verdict = "incorrect"

    return matched, missing, verdict


async def run_plain_vs_rag_benchmark(
    *,
    question: str,
    document_text: str,
    expected_facts: Dict[str, str],
    llm_model_func: Callable[..., Awaitable[str]],
    embedding_func: Callable[..., Awaitable[Any]],
    rag_config: Optional[MultiModelRAGConfig] = None,
    model_label: str = "unknown",
    embedding_model_label: str = "unknown",
    query_mode: str = "hybrid",
    system_prompt: str = (
        "Answer directly. If you do not know the answer, say that you are unsure "
        "instead of inventing details."
    ),
    benchmark_file_name: str = "plain_vs_rag_benchmark.txt",
    benchmark_doc_id: Optional[str] = None,
    bypass_parser_installation_check: bool = True,
) -> PlainVsRAGBenchmarkResult:
    plain_start = time.perf_counter()
    plain_answer = await llm_model_func(question, system_prompt=system_prompt)
    plain_latency = time.perf_counter() - plain_start

    if rag_config is None:
        rag_config = MultiModelRAGConfig(
            working_dir=f"./rag_storage_benchmark/{uuid.uuid4()}",
            parser="mineru",
            parse_method="auto",
            enable_image_processing=False,
            enable_table_processing=True,
            enable_equation_processing=True,
        )

    rag = MultiModelRAG(
        config=rag_config,
        llm_model_func=llm_model_func,
        embedding_func=EmbeddingFunc(
            embedding_dim=getattr(embedding_func, "embedding_dim", None) or 768,
            max_token_size=8192,
            func=embedding_func,
        ),
    )

    if bypass_parser_installation_check:
        rag._parser_installation_checked = True

    init_result = await rag._ensure_lightrag_initialized()
    if not init_result.get("success"):
        raise RuntimeError(init_result.get("error", "Failed to initialize LightRAG"))

    await rag.insert_content_list(
        content_list=[{"type": "text", "text": document_text, "page_idx": 0}],
        file_path=benchmark_file_name,
        doc_id=benchmark_doc_id or f"benchmark-{uuid.uuid4()}",
        display_stats=True,
    )

    rag_start = time.perf_counter()
    rag_answer = await rag.aquery(question, mode=query_mode)
    rag_latency = time.perf_counter() - rag_start

    plain_matched, plain_missing, plain_verdict = evaluate_answer_against_expected(
        plain_answer,
        expected_facts,
    )
    rag_matched, rag_missing, rag_verdict = evaluate_answer_against_expected(
        rag_answer,
        expected_facts,
    )

    return PlainVsRAGBenchmarkResult(
        model=model_label,
        embedding_model=embedding_model_label,
        question=question,
        expected_facts=expected_facts,
        plain_llm=AnswerEvaluation(
            answer=plain_answer.strip(),
            latency_seconds=round(plain_latency, 3),
            matched_expected=plain_matched,
            missing_expected=plain_missing,
            verdict=plain_verdict,
        ),
        rag=AnswerEvaluation(
            answer=rag_answer.strip(),
            latency_seconds=round(rag_latency, 3),
            matched_expected=rag_matched,
            missing_expected=rag_missing,
            verdict=rag_verdict,
        ),
    )
