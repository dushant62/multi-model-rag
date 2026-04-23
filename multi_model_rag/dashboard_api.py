"""
Thin API bridge for the Multi-Model-RAG dashboard.

This bridge supports two modes:
1. Mock/demo mode with deterministic data for the standalone dashboard UI.
2. Live mode, where it boots a real MultiModelRAG runtime from environment
   configuration and routes dashboard actions into the actual library.
"""

from __future__ import annotations

import inspect
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)

try:
    from fastapi import FastAPI, File, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
except ModuleNotFoundError as exc:
    raise ModuleNotFoundError(
        "Dashboard API dependencies are not installed. "
        "Install them with `pip install 'multi-model-rag[dashboard]'`."
    ) from exc

from lightrag.base import DocProcessingStatus
from lightrag.base import DocStatus as LightRAGDocStatus
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.utils import EmbeddingFunc

from multi_model_rag import MultiModelRAG, MultiModelRAGConfig
from multi_model_rag.benchmarking import (
    evaluate_answer_against_expected,
    run_plain_vs_rag_benchmark,
)

SearchMode = Literal["Search", "Deep Research", "Multimodal", "Collections"]
SourceModality = Literal["text", "image", "table", "equation"]
BridgeMode = Literal["live", "mock"]

# Allowed upload extensions (lower-case, with leading dot)
_ALLOWED_UPLOAD_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".pdf",
        ".docx",
        ".doc",
        ".pptx",
        ".ppt",
        ".xlsx",
        ".xls",
        ".txt",
        ".md",
        ".png",
        ".jpg",
        ".jpeg",
    }
)
_MAX_UPLOAD_BYTES: int = int(os.getenv("MMR_MAX_UPLOAD_MB", "200")) * 1024 * 1024

# RAG error state TTL: allow retry after this many seconds
_RAG_ERROR_TTL_SECONDS: int = int(os.getenv("MMR_RAG_ERROR_TTL", "30"))

BENCHMARK_ARTIFACT_PATH = Path(
    os.getenv(
        "MMR_BENCHMARK_ARTIFACT",
        str(
            Path(__file__).parent.parent
            / "rag_storage"
            / "gemma_plain_vs_rag_benchmark_output.json"
        ),
    )
)


class InsightMetric(BaseModel):
    label: str
    value: str
    detail: str


class RecentQuery(BaseModel):
    title: str
    when: str
    mode: SearchMode


class CitationSource(BaseModel):
    id: str
    title: str
    domain: str
    modality: SourceModality
    snippet: str
    relevance: float = Field(ge=0.0, le=1.0)
    freshness: str


class TimelineEvent(BaseModel):
    stage: str
    detail: str
    status: Literal["done", "active", "queued", "failed"]


class UploadItem(BaseModel):
    id: str
    name: str
    parser: str
    pages: int = Field(ge=1)
    progress: int = Field(ge=0, le=100)
    status: Literal["queued", "processing", "ready", "failed"]


class CollectionSummary(BaseModel):
    id: str
    name: str
    documents: int = Field(ge=0)
    embeddings: str
    focus: str


class SourcePreview(BaseModel):
    source_id: str
    title: str
    domain: str
    modality: SourceModality
    collection: str
    parser: str
    page_label: str
    summary: str
    highlighted_excerpt: str
    surrounding_context: list[str]


class ProviderOption(BaseModel):
    id: str
    label: str
    status: Literal["configured", "available", "standby"]
    detail: str
    llm_models: list[str]
    embedding_models: list[str]


class ParserOption(BaseModel):
    id: str
    label: str
    detail: str


class RagImprovementStatus(BaseModel):
    """Which RAG improvement features are active on this server."""

    hyde_enabled: bool = False
    multi_query_enabled: bool = False
    query_decomposition_enabled: bool = False
    adaptive_routing_enabled: bool = True
    keyword_extraction_enabled: bool = True
    reranker_enabled: bool = True
    response_type: str = "Multiple Paragraphs"
    # Advanced RAG (2025/2026) — all opt-in, disabled by default
    contextual_retrieval_enabled: bool = False
    retrieval_grader_enabled: bool = False
    context_compression_enabled: bool = False
    grounding_verification_enabled: bool = False
    semantic_cache_enabled: bool = False


class DashboardSettings(BaseModel):
    bridge_mode: BridgeMode
    provider: str
    parser: str
    parse_method: str
    working_dir: str
    output_dir: str
    upload_dir: str
    llm_model: str
    vision_model: str
    embedding_model: str
    embedding_dim: int
    env_controlled: bool
    providers: list[ProviderOption]
    parsers: list[ParserOption]
    rag_improvements: RagImprovementStatus = Field(
        default_factory=RagImprovementStatus,
        description="Status of each RAG improvement feature on this server.",
    )


class ConnectionValidationResult(BaseModel):
    success: bool
    provider: str
    message: str
    checked_at: str


class BenchmarkAnswer(BaseModel):
    answer: str
    latency_seconds: float = Field(ge=0.0)
    verdict: Literal["correct", "partial", "incorrect"]
    matched_expected: list[str]
    missing_expected: list[str]


class UpgradeRecommendation(BaseModel):
    title: str
    priority: Literal["high", "medium", "low"]
    detail: str
    impact: str


class DashboardEvaluation(BaseModel):
    bridge_mode: BridgeMode
    benchmark_name: str
    source_artifact: str
    question: str
    model: str
    embedding_model: str
    document_excerpt: str
    expected_facts: dict[str, str]
    metrics: list[InsightMetric]
    plain_llm: BenchmarkAnswer
    rag: BenchmarkAnswer
    recommendations: list[UpgradeRecommendation]


class DashboardPlaybook(BaseModel):
    id: str
    title: str
    source_product: str
    summary: str
    query: str
    mode: SearchMode
    capabilities: list[str]
    runtime_fit: Literal["offline-first", "hybrid", "cloud"]
    action_label: str


class DashboardObservability(BaseModel):
    bridge_mode: BridgeMode
    provider: str
    parser: str
    working_dir: str
    benchmark_status: str
    benchmark_source_artifact: str
    metrics: list[InsightMetric]
    notes: list[str]
    timeline: list[TimelineEvent]


class QueryImprovements(BaseModel):
    """Per-query overrides for RAG improvement features.

    Each field is tri-state (True / False / None).  ``None`` means "use the
    server-side config default".  This lets the UI toggle individual features
    without knowing the server's default configuration.
    """

    enable_hyde: Optional[bool] = Field(
        default=None,
        description="Override HyDE (Hypothetical Document Embedding) for this query.",
    )
    enable_multi_query: Optional[bool] = Field(
        default=None,
        description="Override multi-query expansion for this query.",
    )
    enable_decomposition: Optional[bool] = Field(
        default=None,
        description="Override query decomposition for this query.",
    )
    enable_adaptive_routing: Optional[bool] = Field(
        default=None,
        description="Override adaptive retrieval-mode routing for this query.",
    )
    response_type: Optional[str] = Field(
        default=None,
        description=(
            "Override the response format: 'Multiple Paragraphs', "
            "'Bullet Points', or 'Single Paragraph'."
        ),
    )


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    mode: SearchMode = "Search"
    improvements: Optional[QueryImprovements] = Field(
        default=None,
        description="Per-query RAG improvement overrides (optional).",
    )


class QueryResponse(BaseModel):
    query: str
    mode: SearchMode
    answer: list[str]
    follow_ups: list[str]
    metrics: list[InsightMetric]
    sources: list[CitationSource]
    timeline: list[TimelineEvent]


class DashboardOverview(BaseModel):
    bridge_mode: BridgeMode = "mock"
    hero_question: str
    system_pulse: str
    suggestions: list[str]
    recent_queries: list[RecentQuery]
    collections: list[CollectionSummary]
    uploads: list[UploadItem]
    featured_result: QueryResponse


@dataclass
class DashboardRuntimeConfig:
    mode: str
    provider: str
    working_dir: str
    output_dir: str
    upload_dir: str
    parser: str
    parse_method: str
    openai_api_key: str | None
    openai_base_url: str | None
    openai_llm_model: str
    openai_vision_model: str
    embedding_model: str
    embedding_dim: int
    ollama_host: str
    ollama_llm_model: str
    ollama_embedding_model: str
    ollama_embedding_dim: int

    @classmethod
    def from_env(cls) -> DashboardRuntimeConfig:
        mode = os.getenv("MMR_DASHBOARD_MODE", "auto").lower()
        provider = os.getenv("MMR_DASHBOARD_PROVIDER", "openai").lower()

        if provider not in {"openai", "ollama"}:
            provider = "openai"

        return cls(
            mode=mode,
            provider=provider,
            working_dir=os.getenv("MMR_DASHBOARD_WORKING_DIR", "./rag_storage"),
            output_dir=os.getenv("MMR_DASHBOARD_OUTPUT_DIR", "./output/dashboard"),
            upload_dir=os.getenv("MMR_DASHBOARD_UPLOAD_DIR", "./rag_storage/dashboard_uploads"),
            parser=os.getenv("MMR_DASHBOARD_PARSER", os.getenv("PARSER", "mineru")),
            parse_method=os.getenv(
                "MMR_DASHBOARD_PARSE_METHOD",
                os.getenv("PARSE_METHOD", "auto"),
            ),
            openai_api_key=os.getenv("LLM_BINDING_API_KEY") or os.getenv("OPENAI_API_KEY"),
            openai_base_url=os.getenv("LLM_BINDING_HOST") or os.getenv("OPENAI_BASE_URL"),
            openai_llm_model=os.getenv("MMR_DASHBOARD_LLM_MODEL", "gpt-4o-mini"),
            openai_vision_model=os.getenv("MMR_DASHBOARD_VISION_MODEL", "gpt-4o"),
            embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-large"),
            embedding_dim=int(os.getenv("EMBEDDING_DIM", "3072")),
            ollama_host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
            ollama_llm_model=os.getenv("OLLAMA_LLM_MODEL", "llama3.2"),
            ollama_embedding_model=os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
            ollama_embedding_dim=int(os.getenv("OLLAMA_EMBEDDING_DIM", "768")),
        )

    @property
    def ollama_base_url(self) -> str:
        return f"{self.ollama_host.rstrip('/')}/v1"

    @property
    def openai_ready(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def ollama_ready(self) -> bool:
        return bool(self.ollama_host)

    @property
    def live_enabled(self) -> bool:
        if self.mode == "mock":
            return False
        if self.provider == "openai":
            return self.openai_ready
        if self.provider == "ollama":
            return self.ollama_ready
        return False


def _package_version() -> str:
    try:
        return version("multi-model-rag")
    except PackageNotFoundError:
        return "dev"


def _cors_origins() -> list[str]:
    """Return allowed CORS origins from env or sensible defaults."""
    raw = os.getenv("MMR_DASHBOARD_CORS_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


def _infer_modality(file_name: str) -> SourceModality:
    suffix = Path(file_name).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff"}:
        return "image"
    if suffix in {".xlsx", ".xls", ".csv"}:
        return "table"
    if suffix in {".tex"}:
        return "equation"
    return "text"


def _estimate_pages(file_name: str) -> int:
    suffix = Path(file_name).suffix.lower()
    if suffix in {".ppt", ".pptx", ".pdf"}:
        return 12
    if suffix in {".xlsx", ".xls"}:
        return 8
    return 3


def _split_answer(result: str) -> list[str]:
    segments = [segment.strip() for segment in result.split("\n\n") if segment.strip()]
    return segments or [result.strip() or "No answer generated."]


def _demo_collections() -> list[CollectionSummary]:
    return [
        CollectionSummary(
            id="roadmaps",
            name="Product roadmap vault",
            documents=48,
            embeddings="192k vectors",
            focus="Product strategy, release plans, meeting notes",
        ),
        CollectionSummary(
            id="research",
            name="Research synthesis lab",
            documents=31,
            embeddings="88k vectors",
            focus="Papers, charts, evaluation tables, multimodal benchmarks",
        ),
        CollectionSummary(
            id="finance",
            name="Finance intelligence board",
            documents=17,
            embeddings="41k vectors",
            focus="Quarterly reports, KPI tables, annotated dashboards",
        ),
    ]


def _demo_uploads() -> list[UploadItem]:
    return [
        UploadItem(
            id="deck",
            name="q2-product-review.pdf",
            parser="Docling",
            pages=84,
            progress=100,
            status="ready",
        ),
        UploadItem(
            id="spec",
            name="vision-model-benchmark.pptx",
            parser="MinerU",
            pages=36,
            progress=72,
            status="processing",
        ),
        UploadItem(
            id="sheet",
            name="supply-chain-variance.xlsx",
            parser="PaddleOCR",
            pages=18,
            progress=28,
            status="queued",
        ),
    ]


def _default_benchmark_payload() -> dict[str, Any]:
    return {
        "model": "gemma3:1b",
        "embedding_model": "nomic-embed-text",
        "question": (
            "What is the codename for the parser fallback strategy, and which "
            "reranking stack was approved in the project brief?"
        ),
        "document_excerpt": (
            "Project Helix internal research brief\n\n"
            "The parser fallback strategy for the next multimodal release is code-named "
            "Helix-Saffron. The approved retrieval stack for the pilot rollout combines "
            "BGE reranking with ColBERT late interaction."
        ),
        "plain_llm": {
            "latency_seconds": 8.13,
            "answer": (
                "The codename for the parser fallback strategy is Phoenix. "
                "The reranking stack approved in the project brief is Stable."
            ),
        },
        "rag": {
            "latency_seconds": 190.765,
            "answer": (
                "The codename for the parser fallback strategy is Helix-Saffron. "
                "The reranking stack approved in the project brief is BGE reranking."
            ),
        },
        "expected_facts": {
            "parser_fallback_codename": "Helix-Saffron",
            "approved_reranking_stack": "BGE reranking with ColBERT late interaction",
        },
    }


def _load_benchmark_payload() -> tuple[dict[str, Any], str]:
    if BENCHMARK_ARTIFACT_PATH.exists():
        with BENCHMARK_ARTIFACT_PATH.open("r", encoding="utf-8") as handle:
            return json.load(handle), str(BENCHMARK_ARTIFACT_PATH)
    return _default_benchmark_payload(), "embedded fallback"


def _persist_benchmark_payload(payload: dict[str, Any]) -> str:
    BENCHMARK_ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with BENCHMARK_ARTIFACT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    return str(BENCHMARK_ARTIFACT_PATH)


def _coerce_benchmark_answer(
    payload: dict[str, Any], expected_facts: dict[str, str]
) -> BenchmarkAnswer:
    answer = str(payload.get("answer", "")).strip()
    matched, missing, verdict = evaluate_answer_against_expected(answer, expected_facts)
    return BenchmarkAnswer(
        answer=answer,
        latency_seconds=round(float(payload.get("latency_seconds", 0.0)), 3),
        verdict=verdict,
        matched_expected=matched,
        missing_expected=missing,
    )


def _evaluation_recommendations() -> list[UpgradeRecommendation]:
    return [
        UpgradeRecommendation(
            title="Promote reranking into the runtime default",
            priority="high",
            detail=(
                "The benchmark still misses the full ColBERT late-interaction detail, "
                "which is the clearest sign that retrieval ordering needs to improve."
            ),
            impact="Higher factual recall on fine-grained, multi-part questions.",
        ),
        UpgradeRecommendation(
            title="Add timing observability per retrieval stage",
            priority="high",
            detail=(
                "Current RAG quality is better than the plain model, but the latency jump "
                "is too large for a simple benchmark document."
            ),
            impact="Makes optimization work measurable instead of anecdotal.",
        ),
        UpgradeRecommendation(
            title="Expand evaluation coverage beyond one hidden-fact test",
            priority="medium",
            detail=(
                "The project now has a reusable benchmark harness; the next step is "
                "repeating it across document, table, and image-heavy workloads."
            ),
            impact="Builds a defensible quality narrative for stakeholders and releases.",
        ),
    ]


def _playbook_catalog(
    *, bridge_mode: BridgeMode, provider: str, parser: str
) -> list[DashboardPlaybook]:
    provider_label = provider if bridge_mode == "live" else "provider-agnostic"
    return [
        DashboardPlaybook(
            id="ragflow-grounded-audit",
            title="Grounded evidence audit",
            source_product="RAGFlow",
            summary=(
                "Bring RAGFlow's chunk-trace and grounded-citation mindset into a "
                f"{parser}-aware audit flow that surfaces the most defensible answer path."
            ),
            query=(
                "Audit which uploaded documents explain the current latency regression "
                "and show the strongest grounded citations."
            ),
            mode="Deep Research",
            capabilities=[
                "Grounded citations",
                "Chunk-trace thinking",
                "Parser-aware retrieval",
            ],
            runtime_fit="hybrid",
            action_label="Run audit",
        ),
        DashboardPlaybook(
            id="dify-executive-workflow",
            title="Executive workflow brief",
            source_product="Dify",
            summary=(
                "Use a workflow-style preset that turns multi-step reasoning into a "
                "repeatable executive brief with retrieval, synthesis, and follow-up pressure."
            ),
            query=(
                "Create an executive brief from the current collections that explains "
                "what changed, what is risky, and what needs follow-up."
            ),
            mode="Collections",
            capabilities=[
                "Workflow preset",
                "Executive synthesis",
                "Repeatable operator flow",
            ],
            runtime_fit="cloud",
            action_label="Run workflow",
        ),
        DashboardPlaybook(
            id="open-webui-offline-scan",
            title="Offline-first retrieval scan",
            source_product="Open WebUI",
            summary=(
                "Mirror Open WebUI's local-first posture by running a retrieval pass that "
                f"works cleanly with {provider_label} and keeps provider visibility on-screen."
            ),
            query=(
                "Run an offline-first retrieval scan across the workspace and summarize "
                "which sources are best suited for a local model answer."
            ),
            mode="Search",
            capabilities=[
                "Offline-first posture",
                "Provider visibility",
                "Local-model readiness",
            ],
            runtime_fit="offline-first",
            action_label="Run scan",
        ),
        DashboardPlaybook(
            id="anythingllm-workspace-operator",
            title="Workspace operator handoff",
            source_product="AnythingLLM",
            summary=(
                "Adopt AnythingLLM's workspace-first feel with a preset that packages "
                "sources, actions, and operational context into a reusable handoff."
            ),
            query=(
                "Build a workspace operator handoff that lists the best sources, open "
                "questions, and next actions for the active corpus."
            ),
            mode="Multimodal",
            capabilities=[
                "Workspace-first flow",
                "Source-backed handoff",
                "Operator context",
            ],
            runtime_fit="hybrid",
            action_label="Generate handoff",
        ),
    ]


def _build_demo_query_response(query: str, mode: SearchMode) -> QueryResponse:
    query_lc = query.lower()
    if "equation" in query_lc or "formula" in query_lc:
        primary_modality: SourceModality = "equation"
    elif "table" in query_lc or "kpi" in query_lc or "finance" in query_lc:
        primary_modality = "table"
    elif "chart" in query_lc or "image" in query_lc or "vision" in query_lc:
        primary_modality = "image"
    else:
        primary_modality = "text"

    secondary: SourceModality = "image" if primary_modality != "image" else "text"
    tertiary: SourceModality = "table" if primary_modality != "table" else "text"

    return QueryResponse(
        query=query,
        mode=mode,
        answer=[
            f"Multi-Model-RAG treats '{query}' as a {mode.lower()} task and keeps retrieval multimodal instead of flattening all evidence into plain text first.",
            "The dashboard contract is shaped around synthesis plus explainability: answer paragraphs, modality-aware citations, parser stages, and collection context all remain visible to the operator.",
            "The workspace keeps the synthesis, source ledger, parser trace, and collection context together so the answer reads like a finished product surface rather than a detached model response.",
        ],
        follow_ups=[
            "Show only image-backed evidence for this answer",
            "Trace which parser introduced the most uncertainty",
            "Convert this synthesis into an executive update",
        ],
        metrics=[
            InsightMetric(
                label="Answer confidence",
                value="94%" if mode == "Deep Research" else "89%",
                detail="Estimated from citation overlap and parser agreement.",
            ),
            InsightMetric(
                label="Source coverage",
                value="11 modalities" if mode == "Multimodal" else "7 modalities",
                detail="Text, image, table, equation, graph and metadata evidence.",
            ),
            InsightMetric(
                label="Retrieval latency",
                value="248ms" if mode != "Collections" else "312ms",
                detail="Simulated orchestration budget for the dashboard preview.",
            ),
        ],
        sources=[
            CitationSource(
                id="src-1",
                title="Q2 roadmap review deck",
                domain="internal://roadmaps/q2-review",
                modality=primary_modality,
                snippet="Roadmap deltas are described across narrative slides, visual timelines, and milestone annotations.",
                relevance=0.96,
                freshness="2h ago",
            ),
            CitationSource(
                id="src-2",
                title="Multimodal benchmark appendix",
                domain="internal://research/benchmarks",
                modality=secondary,
                snippet="Supporting benchmark evidence explains retrieval quality, parser behavior, and cross-modal agreement.",
                relevance=0.91,
                freshness="Yesterday",
            ),
            CitationSource(
                id="src-3",
                title="Knowledge graph delta notes",
                domain="internal://graph/delta-log",
                modality=tertiary,
                snippet="Entity and relation changes provide explainable context for answer synthesis.",
                relevance=0.86,
                freshness="3d ago",
            ),
        ],
        timeline=[
            TimelineEvent(
                stage="Parse harmonization",
                detail="Normalizing parser output into a shared document view.",
                status="done",
            ),
            TimelineEvent(
                stage="Cross-modal retrieval",
                detail="Merging semantic search, graph lookups, and evidence reranking.",
                status="active",
            ),
            TimelineEvent(
                stage="Answer shaping",
                detail="Packaging synthesis, citations, and follow-up prompts for the dashboard.",
                status="queued",
            ),
        ],
    )


class DashboardRuntime:
    def __init__(self) -> None:
        self.config = DashboardRuntimeConfig.from_env()
        self._rag: MultiModelRAG | None = None
        self._rag_error: str | None = None
        self._rag_error_at: float | None = None
        self._rag_lock = None
        self._uploads: list[UploadItem] = []
        self._upload_timelines: dict[str, list[TimelineEvent]] = {}
        # Simple in-memory cache for the overview hero query
        self._overview_cache: tuple[float, QueryResponse] | None = None
        self._overview_cache_ttl: int = int(os.getenv("MMR_OVERVIEW_CACHE_TTL", "60"))

    @property
    def bridge_mode(self) -> BridgeMode:
        return "live" if self.config.live_enabled else "mock"

    @property
    def rag_lock(self):
        if self._rag_lock is None:
            import asyncio

            self._rag_lock = asyncio.Lock()
        return self._rag_lock

    async def get_rag(self, require_parser: bool = False) -> MultiModelRAG:
        if not self.config.live_enabled:
            raise RuntimeError("Dashboard runtime is running in mock mode.")

        if self._rag is not None:
            return self._rag

        # If there was a previous error, only block if it's still within the TTL window.
        if self._rag_error is not None:
            age = time.monotonic() - (self._rag_error_at or 0.0)
            if age < _RAG_ERROR_TTL_SECONDS:
                raise RuntimeError(self._rag_error)
            # TTL expired — clear the error and allow a fresh initialization attempt.
            logger.info("RAG init error TTL expired (%.0fs), retrying initialization.", age)
            self._rag_error = None
            self._rag_error_at = None

        async with self.rag_lock:
            if self._rag is not None:
                return self._rag

            try:
                if self.config.provider == "ollama":
                    rag = self._build_ollama_rag()
                else:
                    rag = self._build_openai_rag()

                result = await rag._ensure_lightrag_initialized(
                    skip_parser_installation_check=not require_parser
                )
                if not result["success"]:
                    raise RuntimeError(result["error"])

                self._rag = rag
                return rag
            except Exception as exc:
                self._rag_error = str(exc)
                self._rag_error_at = time.monotonic()
                logger.error("RAG initialization failed: %s", exc)
                raise RuntimeError(self._rag_error) from exc

    async def _live_processing_counts(self, rag: MultiModelRAG) -> dict[str, int]:
        try:
            return await rag.lightrag.get_processing_status()
        except Exception as exc:
            logger.warning("Failed to read LightRAG processing status: %s", exc)
            return {}

    async def _live_doc_status_entries(
        self, rag: MultiModelRAG
    ) -> list[tuple[str, DocProcessingStatus]]:
        documents: dict[str, DocProcessingStatus] = {}
        for status in (
            LightRAGDocStatus.PROCESSED,
            LightRAGDocStatus.PREPROCESSED,
            LightRAGDocStatus.PROCESSING,
            LightRAGDocStatus.PENDING,
            LightRAGDocStatus.FAILED,
        ):
            try:
                documents.update(await rag.lightrag.get_docs_by_status(status))
            except Exception:
                continue

        return sorted(
            documents.items(),
            key=lambda item: item[1].updated_at or item[1].created_at,
            reverse=True,
        )

    def _upload_from_doc_status(
        self,
        doc_id: str,
        status: DocProcessingStatus,
        existing: UploadItem | None = None,
    ) -> UploadItem:
        name = Path(status.file_path).name or doc_id
        parser = (
            existing.parser
            if existing is not None
            else str(status.metadata.get("parser", self.config.parser))
        )
        pages = existing.pages if existing is not None else _estimate_pages(name)

        if status.status == LightRAGDocStatus.PROCESSED:
            upload_status = "ready"
            progress = 100
        elif status.status == LightRAGDocStatus.PREPROCESSED:
            upload_status = "processing"
            progress = 80
        elif status.status == LightRAGDocStatus.PROCESSING:
            upload_status = "processing"
            progress = 45
        elif status.status == LightRAGDocStatus.PENDING:
            upload_status = "queued"
            progress = 10
        else:
            upload_status = "failed"
            progress = 0

        return UploadItem(
            id=doc_id,
            name=name,
            parser=parser,
            pages=pages,
            progress=progress,
            status=upload_status,
        )

    def _build_openai_rag(self) -> MultiModelRAG:
        if not self.config.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY or LLM_BINDING_API_KEY is required for live OpenAI mode."
            )

        async def llm_model_func(
            prompt: str,
            system_prompt: str | None = None,
            history_messages: list[dict] | None = None,
            **kwargs,
        ) -> str:
            return await openai_complete_if_cache(
                model=self.config.openai_llm_model,
                prompt=prompt,
                system_prompt=system_prompt,
                history_messages=history_messages or [],
                api_key=self.config.openai_api_key,
                base_url=self.config.openai_base_url,
                **kwargs,
            )

        async def vision_model_func(
            prompt: str,
            system_prompt: str | None = None,
            history_messages: list[dict] | None = None,
            image_data: str | None = None,
            messages: list[dict] | None = None,
            **kwargs,
        ) -> str:
            if messages:
                return await openai_complete_if_cache(
                    model=self.config.openai_vision_model,
                    prompt="",
                    system_prompt=None,
                    history_messages=[],
                    messages=messages,
                    api_key=self.config.openai_api_key,
                    base_url=self.config.openai_base_url,
                    **kwargs,
                )

            if image_data:
                return await openai_complete_if_cache(
                    model=self.config.openai_vision_model,
                    prompt="",
                    system_prompt=None,
                    history_messages=[],
                    messages=[
                        {"role": "system", "content": system_prompt} if system_prompt else None,
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{image_data}"},
                                },
                            ],
                        },
                    ],
                    api_key=self.config.openai_api_key,
                    base_url=self.config.openai_base_url,
                    **kwargs,
                )

            return await llm_model_func(
                prompt,
                system_prompt=system_prompt,
                history_messages=history_messages or [],
                **kwargs,
            )

        embedding_func = EmbeddingFunc(
            embedding_dim=self.config.embedding_dim,
            max_token_size=8192,
            func=lambda texts: openai_embed.func(
                texts,
                model=self.config.embedding_model,
                api_key=self.config.openai_api_key,
                base_url=self.config.openai_base_url,
            ),
        )

        config = MultiModelRAGConfig(
            working_dir=self.config.working_dir,
            parser=self.config.parser,
            parse_method=self.config.parse_method,
            enable_image_processing=True,
            enable_table_processing=True,
            enable_equation_processing=True,
        )

        return MultiModelRAG(
            config=config,
            llm_model_func=llm_model_func,
            vision_model_func=vision_model_func,
            embedding_func=embedding_func,
        )

    def _build_ollama_rag(self) -> MultiModelRAG:
        async def ollama_llm_model_func(
            prompt: str,
            system_prompt: str | None = None,
            history_messages: list[dict] | None = None,
            **kwargs,
        ) -> str:
            return await openai_complete_if_cache(
                model=self.config.ollama_llm_model,
                prompt=prompt,
                system_prompt=system_prompt,
                history_messages=history_messages or [],
                base_url=self.config.ollama_base_url,
                api_key="ollama",
                **kwargs,
            )

        async def ollama_embedding_async(texts: list[str]) -> list[list[float]]:
            try:
                import ollama
            except ModuleNotFoundError as exc:
                raise RuntimeError(
                    "The ollama package is required for live Ollama dashboard mode."
                ) from exc

            import numpy as np

            client = ollama.AsyncClient(host=self.config.ollama_host)
            response = await client.embed(model=self.config.ollama_embedding_model, input=texts)
            return np.array(response.embeddings, dtype=np.float32)

        embedding_func = EmbeddingFunc(
            embedding_dim=self.config.ollama_embedding_dim,
            max_token_size=8192,
            func=ollama_embedding_async,
        )

        config = MultiModelRAGConfig(
            working_dir=self.config.working_dir,
            parser=self.config.parser,
            parse_method=self.config.parse_method,
            enable_image_processing=False,
            enable_table_processing=True,
            enable_equation_processing=True,
        )

        return MultiModelRAG(
            config=config,
            llm_model_func=ollama_llm_model_func,
            embedding_func=embedding_func,
            lightrag_kwargs={
                # Tuned for small local models (e.g., gemma3:1b, llama3.2:1b).
                # Small models are slow/struggle on long prompts, so we shrink
                # chunks, lower concurrency, raise timeouts, and skip optional
                # gleaning / merge-summary passes.
                "default_llm_timeout": 600,
                "default_embedding_timeout": 120,
                "llm_model_max_async": 2,
                "chunk_token_size": 500,
                "chunk_overlap_token_size": 50,
                "entity_extract_max_gleaning": 0,
                "force_llm_summary_on_merge": 0,
                "summary_max_tokens": 400,
                "max_extract_input_tokens": 6000,
                "enable_llm_cache_for_entity_extract": True,
            },
        )

    async def collections(self) -> list[CollectionSummary]:
        if not self.config.live_enabled:
            return _demo_collections()

        try:
            rag = await self.get_rag(require_parser=False)
            counts = await self._live_processing_counts(rag)
            upload_count = sum(int(value) for value in counts.values())
            ready_count = int(counts.get(LightRAGDocStatus.PROCESSED.value, 0))
        except Exception:
            upload_count = len(self._uploads)
            ready_count = len([item for item in self._uploads if item.status == "ready"])

        return [
            CollectionSummary(
                id="runtime",
                name="Live runtime collection",
                documents=ready_count,
                embeddings=f"{max(ready_count * 24, 1)} chunks",
                focus=f"Working dir: {self.config.working_dir}",
            ),
            CollectionSummary(
                id="uploads",
                name="Dashboard upload inbox",
                documents=upload_count,
                embeddings=f"{upload_count} tracked files",
                focus=f"Parser: {self.config.parser} • mode: {self.config.parse_method}",
            ),
        ]

    async def current_uploads(self) -> list[UploadItem]:
        if not self.config.live_enabled:
            return _demo_uploads()

        merged = {item.id: item for item in self._uploads}

        try:
            rag = await self.get_rag(require_parser=False)
            for doc_id, status in await self._live_doc_status_entries(rag):
                merged[doc_id] = self._upload_from_doc_status(
                    doc_id,
                    status,
                    existing=merged.get(doc_id),
                )
        except Exception:
            pass

        ordered_ids = [item.id for item in self._uploads]
        for doc_id in merged:
            if doc_id not in ordered_ids:
                ordered_ids.append(doc_id)
        return [merged[doc_id] for doc_id in ordered_ids]

    def upload_timeline(self, upload_id: str) -> list[TimelineEvent]:
        if self.config.live_enabled:
            if upload_id in self._upload_timelines:
                return self._upload_timelines[upload_id]

            for item in self._uploads:
                if item.id == upload_id:
                    return _build_upload_timeline(item)

            raise KeyError(upload_id)

        for item in _demo_uploads():
            if item.id == upload_id:
                return _build_upload_timeline(item)

        raise KeyError(upload_id)

    def delete_upload(self, upload_id: str) -> None:
        """Remove an upload entry from the in-memory tracking list."""
        before = len(self._uploads)
        self._uploads = [item for item in self._uploads if item.id != upload_id]
        self._upload_timelines.pop(upload_id, None)
        if len(self._uploads) == before:
            raise KeyError(upload_id)

    async def source_preview(self, source_id: str) -> SourcePreview:
        if not self.config.live_enabled:
            return _demo_source_preview(source_id)

        uploads = await self.current_uploads()
        upload = next((item for item in uploads if item.id == source_id), None)
        if upload is None:
            raise KeyError(source_id)

        excerpt = f"Parser {upload.parser} ingested this document into the live working set."
        surrounding_context = [
            "The live runtime can expose the supporting chunk and nearby context once document processing metadata is available.",
            "Source previews are shaped to make citations auditable before the user leaves the answer workspace.",
            "Collection and parser metadata stay attached so the retrieval path remains legible.",
        ]

        try:
            rag = await self.get_rag(require_parser=False)
            status = await rag.get_document_processing_status(upload.id)
            chunk_ids = status.get("chunks_list", []) if status.get("exists") else []
            if chunk_ids:
                chunk = await rag.lightrag.text_chunks.get_by_id(chunk_ids[0])
                if chunk:
                    excerpt = str(chunk.get("content", "")).strip().replace("\n", " ")
                    excerpt = excerpt[:420] or excerpt
        except Exception:
            pass

        return SourcePreview(
            source_id=upload.id,
            title=upload.name,
            domain=f"working-dir://{Path(self.config.working_dir).resolve()}",
            modality=_infer_modality(upload.name),
            collection="Live runtime collection",
            parser=upload.parser,
            page_label=f"{upload.pages} pages",
            summary=(
                "This preview exposes the current citation context for a live runtime "
                "document so users can verify what the system actually indexed."
            ),
            highlighted_excerpt=excerpt,
            surrounding_context=surrounding_context,
        )

    def settings(self) -> DashboardSettings:
        if self.config.provider == "ollama":
            llm_model = self.config.ollama_llm_model
            embedding_model = self.config.ollama_embedding_model
            embedding_dim = self.config.ollama_embedding_dim
            vision_model = self.config.ollama_llm_model
        else:
            llm_model = self.config.openai_llm_model
            embedding_model = self.config.embedding_model
            embedding_dim = self.config.embedding_dim
            vision_model = self.config.openai_vision_model

        providers = [
            ProviderOption(
                id="openai",
                label="OpenAI-compatible",
                status=(
                    "configured"
                    if self.config.provider == "openai" and self.config.openai_ready
                    else "available"
                    if self.config.openai_ready
                    else "standby"
                ),
                detail="Hosted provider path for richer multimodal and OpenAI-compatible deployments.",
                llm_models=[self.config.openai_llm_model, self.config.openai_vision_model],
                embedding_models=[self.config.embedding_model],
            ),
            ProviderOption(
                id="ollama",
                label="Ollama",
                status=(
                    "configured"
                    if self.config.provider == "ollama" and self.config.ollama_ready
                    else "available"
                    if self.config.ollama_ready
                    else "standby"
                ),
                detail="Local-first route for self-hosted RAG and offline model execution.",
                llm_models=[self.config.ollama_llm_model],
                embedding_models=[self.config.ollama_embedding_model],
            ),
        ]

        parsers = [
            ParserOption(
                id="mineru",
                label="MinerU",
                detail="Balanced multimodal parser for mixed research material.",
            ),
            ParserOption(
                id="docling",
                label="Docling",
                detail="Layout-aware parser for reports, decks, and enterprise documents.",
            ),
            ParserOption(
                id="paddleocr",
                label="PaddleOCR",
                detail="OCR-heavy parser for scans, screenshots, and image-first inputs.",
            ),
        ]

        return DashboardSettings(
            bridge_mode=self.bridge_mode,
            provider=self.config.provider,
            parser=self.config.parser,
            parse_method=self.config.parse_method,
            working_dir=self.config.working_dir,
            output_dir=self.config.output_dir,
            upload_dir=self.config.upload_dir,
            llm_model=llm_model,
            vision_model=vision_model,
            embedding_model=embedding_model,
            embedding_dim=embedding_dim,
            env_controlled=True,
            providers=providers,
            parsers=parsers,
            rag_improvements=RagImprovementStatus(
                hyde_enabled=bool(getattr(self.config, "enable_hyde", False)),
                multi_query_enabled=bool(getattr(self.config, "enable_multi_query", False)),
                query_decomposition_enabled=bool(
                    getattr(self.config, "enable_query_decomposition", False)
                ),
                adaptive_routing_enabled=bool(
                    getattr(self.config, "enable_adaptive_routing", True)
                ),
                keyword_extraction_enabled=bool(
                    getattr(self.config, "enable_keyword_extraction", True)
                ),
                reranker_enabled=bool(getattr(self.config, "enable_reranker", True)),
                response_type=str(getattr(self.config, "response_type", "Multiple Paragraphs")),
                contextual_retrieval_enabled=bool(
                    getattr(self.config, "enable_contextual_retrieval", False)
                ),
                retrieval_grader_enabled=bool(
                    getattr(self.config, "enable_retrieval_grader", False)
                ),
                context_compression_enabled=bool(
                    getattr(self.config, "enable_context_compression", False)
                ),
                grounding_verification_enabled=bool(
                    getattr(self.config, "enable_grounding_verification", False)
                ),
                semantic_cache_enabled=bool(getattr(self.config, "enable_semantic_cache", False)),
            ),
        )

    def validate_connection(self) -> ConnectionValidationResult:
        if self.config.provider == "openai":
            success = self.config.openai_ready
            message = (
                "OpenAI-compatible configuration is present and ready for dashboard use."
                if success
                else "No OpenAI-compatible API key is configured for the dashboard bridge."
            )
        else:
            success = self.config.ollama_ready
            message = (
                f"Ollama host {self.config.ollama_host} is configured for dashboard access."
                if success
                else "No Ollama host is configured for the dashboard bridge."
            )

        return ConnectionValidationResult(
            success=success,
            provider=self.config.provider,
            message=message,
            checked_at="just now",
        )

    def evaluation(self) -> DashboardEvaluation:
        payload, source_artifact = _load_benchmark_payload()
        expected_facts = {
            str(key): str(value) for key, value in payload.get("expected_facts", {}).items()
        }
        plain_answer = _coerce_benchmark_answer(
            dict(payload.get("plain_llm", {})),
            expected_facts,
        )
        rag_answer = _coerce_benchmark_answer(
            dict(payload.get("rag", {})),
            expected_facts,
        )
        total_expected = max(len(expected_facts), 1)
        grounding_gain = len(rag_answer.matched_expected) - len(plain_answer.matched_expected)
        latency_delta = round(
            rag_answer.latency_seconds - plain_answer.latency_seconds,
            3,
        )

        return DashboardEvaluation(
            bridge_mode=self.bridge_mode,
            benchmark_name="Plain vs RAG grounding benchmark",
            source_artifact=source_artifact,
            question=str(payload.get("question", "")),
            model=str(payload.get("model", "unknown")),
            embedding_model=str(payload.get("embedding_model", "unknown")),
            document_excerpt=str(payload.get("document_excerpt", "")).strip(),
            expected_facts=expected_facts,
            metrics=[
                InsightMetric(
                    label="Grounding gain",
                    value=f"{grounding_gain:+d} facts",
                    detail=(
                        f"Plain model matched {len(plain_answer.matched_expected)}/"
                        f"{total_expected}; RAG matched "
                        f"{len(rag_answer.matched_expected)}/{total_expected}."
                    ),
                ),
                InsightMetric(
                    label="Latency delta",
                    value=f"{latency_delta:.1f}s",
                    detail=(
                        "Extra time currently paid for retrieval, synthesis, and citation "
                        "assembly on the benchmark path."
                    ),
                ),
                InsightMetric(
                    label="Current winner",
                    value="RAG"
                    if len(rag_answer.matched_expected) >= len(plain_answer.matched_expected)
                    else "Plain",
                    detail="The stronger answer on the tracked hidden-fact benchmark.",
                ),
                InsightMetric(
                    label="Runtime posture",
                    value=self.system_pulse(),
                    detail=(
                        "This connects the benchmark readout back to the current "
                        "dashboard bridge configuration."
                    ),
                ),
            ],
            plain_llm=plain_answer,
            rag=rag_answer,
            recommendations=_evaluation_recommendations(),
        )

    async def run_evaluation_benchmark(self) -> DashboardEvaluation:
        benchmark_seed = _default_benchmark_payload()

        if not self.config.live_enabled:
            return self.evaluation()

        if self.config.provider == "ollama":

            async def llm_model_func(
                prompt: str,
                system_prompt: str | None = None,
                history_messages: list[dict] | None = None,
                **kwargs: Any,
            ) -> str:
                return await openai_complete_if_cache(
                    model=self.config.ollama_llm_model,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    history_messages=history_messages or [],
                    base_url=self.config.ollama_base_url,
                    api_key="ollama",
                    **kwargs,
                )

            async def embedding_func(texts: list[str]):
                try:
                    import numpy as np
                    import ollama
                except ModuleNotFoundError as exc:
                    raise RuntimeError(
                        "The ollama and numpy packages are required for live Ollama benchmarking."
                    ) from exc

                client = ollama.AsyncClient(host=self.config.ollama_host)
                response = await client.embed(
                    model=self.config.ollama_embedding_model,
                    input=texts,
                )
                return np.array(response.embeddings, dtype=float)

            model_label = self.config.ollama_llm_model
            embedding_model_label = self.config.ollama_embedding_model
        else:
            if not self.config.openai_api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY or LLM_BINDING_API_KEY is required for live OpenAI benchmarking."
                )

            async def llm_model_func(
                prompt: str,
                system_prompt: str | None = None,
                history_messages: list[dict] | None = None,
                **kwargs: Any,
            ) -> str:
                return await openai_complete_if_cache(
                    model=self.config.openai_llm_model,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    history_messages=history_messages or [],
                    api_key=self.config.openai_api_key,
                    base_url=self.config.openai_base_url,
                    **kwargs,
                )

            async def embedding_func(texts: list[str]):
                result = openai_embed.func(
                    texts,
                    model=self.config.embedding_model,
                    api_key=self.config.openai_api_key,
                    base_url=self.config.openai_base_url,
                )
                if inspect.isawaitable(result):
                    return await result
                return result

            model_label = self.config.openai_llm_model
            embedding_model_label = self.config.embedding_model

        result = await run_plain_vs_rag_benchmark(
            question=str(benchmark_seed["question"]),
            document_text=str(benchmark_seed["document_excerpt"]),
            expected_facts={
                str(key): str(value) for key, value in benchmark_seed["expected_facts"].items()
            },
            llm_model_func=llm_model_func,
            embedding_func=embedding_func,
            rag_config=MultiModelRAGConfig(
                working_dir=str(
                    Path(self.config.output_dir) / "dashboard-benchmarks" / str(uuid.uuid4())
                ),
                parser=self.config.parser,
                parse_method=self.config.parse_method,
                enable_image_processing=self.config.provider == "openai",
                enable_table_processing=True,
                enable_equation_processing=True,
            ),
            model_label=model_label,
            embedding_model_label=embedding_model_label,
        )

        payload = result.to_dict()
        payload["document_excerpt"] = benchmark_seed["document_excerpt"]
        _persist_benchmark_payload(payload)
        return self.evaluation()

    def playbooks(self) -> list[DashboardPlaybook]:
        return _playbook_catalog(
            bridge_mode=self.bridge_mode,
            provider=self.config.provider,
            parser=self.config.parser,
        )

    async def observability(self) -> DashboardObservability:
        uploads = await self.current_uploads()
        ready_uploads = len([item for item in uploads if item.status == "ready"])
        processing_uploads = len([item for item in uploads if item.status == "processing"])
        queued_uploads = len([item for item in uploads if item.status == "queued"])
        failed_uploads = len([item for item in uploads if item.status == "failed"])
        evaluation = self.evaluation()
        artifact_loaded = BENCHMARK_ARTIFACT_PATH.exists()

        return DashboardObservability(
            bridge_mode=self.bridge_mode,
            provider=self.config.provider,
            parser=self.config.parser,
            working_dir=self.config.working_dir,
            benchmark_status="artifact loaded" if artifact_loaded else "fallback payload",
            benchmark_source_artifact=evaluation.source_artifact,
            metrics=[
                InsightMetric(
                    label="Ready uploads",
                    value=str(ready_uploads),
                    detail="Documents currently available for grounded retrieval.",
                ),
                InsightMetric(
                    label="Ingestion queue",
                    value=str(processing_uploads + queued_uploads),
                    detail="Files still moving through parser and indexing stages.",
                ),
                InsightMetric(
                    label="Playbooks ready",
                    value=str(len(self.playbooks())),
                    detail="Runnable workflows derived from cloned product patterns.",
                ),
                InsightMetric(
                    label="Benchmark leader",
                    value="RAG"
                    if len(evaluation.rag.matched_expected)
                    >= len(evaluation.plain_llm.matched_expected)
                    else "Plain",
                    detail=(f"Current evaluation artifact: {evaluation.benchmark_name.lower()}."),
                ),
            ],
            notes=[
                (
                    "Dify-style workflow thinking is now represented as runnable "
                    "dashboard playbooks instead of static ideas."
                ),
                (
                    "Open WebUI-style provider posture remains visible through live/mock "
                    "bridge state, provider, parser, and working directory exposure."
                ),
                (
                    "AnythingLLM-style workspace guidance is preserved by keeping sources, "
                    "next actions, and operator context attached to each preset."
                ),
            ],
            timeline=[
                TimelineEvent(
                    stage="Workflow presets",
                    detail=(
                        "RAGFlow, Dify, Open WebUI, and AnythingLLM patterns were converted "
                        "into runnable playbooks."
                    ),
                    status="done",
                ),
                TimelineEvent(
                    stage="Runtime visibility",
                    detail=(
                        f"Bridge {self.bridge_mode}, provider {self.config.provider}, "
                        f"parser {self.config.parser}, failed uploads {failed_uploads}."
                    ),
                    status="done" if failed_uploads == 0 else "active",
                ),
                TimelineEvent(
                    stage="Benchmark grounding",
                    detail=(f"Evaluation currently reads from {evaluation.source_artifact}."),
                    status="done",
                ),
            ],
        )

    async def _live_source_cards(self, rag: MultiModelRAG, limit: int = 3) -> list[CitationSource]:
        cards: list[CitationSource] = []
        uploads = await self.current_uploads()

        for item in uploads:
            if item.status != "ready":
                continue

            try:
                status = await rag.get_document_processing_status(item.id)
            except Exception:
                status = {"exists": False, "chunks_list": [], "updated_at": ""}

            snippet = f"Parser {item.parser} ingested this file into the live working set."
            chunk_ids = status.get("chunks_list", []) if status.get("exists") else []

            if chunk_ids:
                chunk = await rag.lightrag.text_chunks.get_by_id(chunk_ids[0])
                if chunk:
                    snippet = str(chunk.get("content", "")).strip().replace("\n", " ")
                    snippet = snippet[:240] or snippet

            cards.append(
                CitationSource(
                    id=item.id,
                    title=item.name,
                    domain=f"working-dir://{Path(self.config.working_dir).resolve()}",
                    modality=_infer_modality(item.name),
                    snippet=snippet,
                    relevance=max(0.72, 0.96 - len(cards) * 0.08),
                    freshness=status.get("updated_at", "live runtime") or "live runtime",
                )
            )

            if len(cards) >= limit:
                break

        return cards

    async def _total_live_chunks(self, rag: MultiModelRAG) -> int:
        total = 0
        for _, status in await self._live_doc_status_entries(rag):
            total += int(status.chunks_count or 0)
        return total

    def system_pulse(self) -> str:
        if not self.config.live_enabled:
            return "Collections stable • parser queue visible • citation depth healthy"
        return (
            f"Live bridge • provider {self.config.provider} • parser {self.config.parser} • "
            f"{len(self._uploads)} tracked uploads"
        )

    async def query(self, request: QueryRequest) -> QueryResponse:
        if not self.config.live_enabled:
            return _build_demo_query_response(request.query, request.mode)

        rag = await self.get_rag(require_parser=False)
        counts = await self._live_processing_counts(rag)
        total_docs = sum(int(value) for value in counts.values())

        if total_docs == 0 and not self._uploads:
            return QueryResponse(
                query=request.query,
                mode=request.mode,
                answer=[
                    "The dashboard bridge is configured for live mode, but no documents have been ingested through the dashboard yet.",
                    "Upload a document to let Multi-Model-RAG build its working corpus, then rerun the question to get a runtime-backed answer.",
                ],
                follow_ups=[
                    "Upload a PDF to the live bridge",
                    "Check the configured parser and working directory",
                    "Switch back to mock mode for UI-only exploration",
                ],
                metrics=[
                    InsightMetric(
                        label="Bridge mode",
                        value="Live",
                        detail=f"Provider: {self.config.provider}",
                    ),
                    InsightMetric(
                        label="Tracked uploads",
                        value="0",
                        detail="No live documents are ready yet.",
                    ),
                    InsightMetric(
                        label="Next step",
                        value="Ingest",
                        detail="Use the upload panel to create the first live corpus.",
                    ),
                ],
                sources=[
                    CitationSource(
                        id="runtime",
                        title="Live runtime configuration",
                        domain=f"working-dir://{Path(self.config.working_dir).resolve()}",
                        modality="text",
                        snippet=(
                            f"Provider {self.config.provider} is configured with parser "
                            f"{self.config.parser}, waiting for the first dashboard upload."
                        ),
                        relevance=0.84,
                        freshness="live runtime",
                    )
                ],
                timeline=[
                    TimelineEvent(
                        stage="Runtime configuration",
                        detail="Bridge is configured and ready to ingest.",
                        status="done",
                    ),
                    TimelineEvent(
                        stage="Document ingestion",
                        detail="Waiting for the first uploaded file.",
                        status="active",
                    ),
                    TimelineEvent(
                        stage="Answer synthesis",
                        detail="Will activate after the live corpus is ready.",
                        status="queued",
                    ),
                ],
            )

        rag_mode = {
            "Search": "mix",
            "Deep Research": "hybrid",
            "Multimodal": "mix",
            "Collections": "global",
        }[request.mode]

        # Build per-query improvement override kwargs
        imp_kwargs: dict = {}
        if request.improvements:
            imp = request.improvements
            if imp.enable_hyde is not None:
                imp_kwargs["rag_enable_hyde"] = imp.enable_hyde
            if imp.enable_multi_query is not None:
                imp_kwargs["rag_enable_multi_query"] = imp.enable_multi_query
            if imp.enable_decomposition is not None:
                imp_kwargs["rag_enable_decomposition"] = imp.enable_decomposition
            if imp.enable_adaptive_routing is not None:
                imp_kwargs["rag_adaptive_routing"] = imp.enable_adaptive_routing
            if imp.response_type is not None:
                imp_kwargs["rag_response_type"] = imp.response_type

        answer = await rag.aquery(
            request.query,
            mode=rag_mode,
            vlm_enhanced=request.mode == "Multimodal" and self.config.provider == "openai",
            **imp_kwargs,
        )

        sources = await self._live_source_cards(rag)
        total_chunks = await self._total_live_chunks(rag)

        if not sources:
            sources = [
                CitationSource(
                    id="runtime",
                    title="Multi-Model-RAG live runtime",
                    domain=f"working-dir://{Path(self.config.working_dir).resolve()}",
                    modality="text",
                    snippet=(
                        "The dashboard is connected to a live runtime, but no uploaded "
                        "documents are currently tracked in the dashboard bridge."
                    ),
                    relevance=0.82,
                    freshness="live runtime",
                )
            ]

        return QueryResponse(
            query=request.query,
            mode=request.mode,
            answer=_split_answer(answer),
            follow_ups=[
                "Filter this answer to live uploaded files only",
                "Show parser and ingestion details for the cited sources",
                "Switch to a deeper retrieval mode for this topic",
            ],
            metrics=[
                InsightMetric(
                    label="Bridge mode",
                    value="Live",
                    detail=f"Provider: {self.config.provider}",
                ),
                InsightMetric(
                    label="Tracked uploads",
                    value=str(total_docs),
                    detail=f"Working dir: {self.config.working_dir}",
                ),
                InsightMetric(
                    label="Live chunks",
                    value=str(total_chunks),
                    detail=f"Query path: {rag_mode}",
                ),
            ],
            sources=sources,
            timeline=[
                TimelineEvent(
                    stage="Runtime bootstrap",
                    detail=f"Live {self.config.provider} runtime initialized for dashboard access.",
                    status="done",
                ),
                *(
                    [
                        TimelineEvent(
                            stage="Adaptive routing",
                            detail=f"Mode selected automatically from query semantics → '{rag_mode}'.",
                            status="done",
                        )
                    ]
                    if imp_kwargs.get("rag_adaptive_routing") is not False
                    else []
                ),
                *(
                    [
                        TimelineEvent(
                            stage="HyDE enhancement",
                            detail="Hypothetical document generated to improve retrieval alignment.",
                            status="done",
                        )
                    ]
                    if imp_kwargs.get("rag_enable_hyde") is True
                    else []
                ),
                *(
                    [
                        TimelineEvent(
                            stage="Query decomposition",
                            detail="Complex query split into sub-queries and synthesised.",
                            status="done",
                        )
                    ]
                    if imp_kwargs.get("rag_enable_decomposition") is True
                    else []
                ),
                *(
                    [
                        TimelineEvent(
                            stage="Multi-query expansion",
                            detail="Query rephrased into multiple variants for broader recall.",
                            status="done",
                        )
                    ]
                    if imp_kwargs.get("rag_enable_multi_query") is True
                    else []
                ),
                TimelineEvent(
                    stage="Query execution",
                    detail=f"Executed via MultiModelRAG.aquery(..., mode='{rag_mode}').",
                    status="done",
                ),
                TimelineEvent(
                    stage="Citation shaping",
                    detail="Sources now reflect live chunk snippets from the ingested runtime when available.",
                    status="done",
                ),
            ],
        )

    async def ingest_uploads(self, files: list[UploadFile]) -> list[UploadItem]:
        if not self.config.live_enabled:
            items = []
            for index, file in enumerate(files):
                item = UploadItem(
                    id=f"upload-{index}",
                    name=file.filename or f"upload-{index}",
                    parser="Docling" if index % 2 == 0 else "MinerU",
                    pages=12 + index * 7,
                    progress=45 if index == 0 else 0,
                    status="processing" if index == 0 else "queued",
                )
                self._upload_timelines[item.id] = _build_upload_timeline(item)
                items.append(item)
            return items

        rag = await self.get_rag(require_parser=True)

        upload_dir = Path(self.config.upload_dir)
        output_dir = Path(self.config.output_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        processed: list[UploadItem] = []

        for index, file in enumerate(files):
            name = file.filename or f"upload-{index}"
            ext = Path(name).suffix.lower()

            # Validate extension
            if ext not in _ALLOWED_UPLOAD_EXTENSIONS:
                raise ValueError(
                    f"File type '{ext}' is not supported. "
                    f"Allowed types: {', '.join(sorted(_ALLOWED_UPLOAD_EXTENSIONS))}"
                )

            # Read file contents and validate size before writing
            contents = await file.read()
            if len(contents) > _MAX_UPLOAD_BYTES:
                max_mb = _MAX_UPLOAD_BYTES // (1024 * 1024)
                raise ValueError(
                    f"File '{name}' exceeds the {max_mb} MB upload limit "
                    f"({len(contents) // (1024 * 1024)} MB received)."
                )

            destination = upload_dir / name
            destination.write_bytes(contents)
            doc_id = f"live-{destination.stem}-{index}"

            item = UploadItem(
                id=doc_id,
                name=name,
                parser=self.config.parser,
                pages=_estimate_pages(name),
                progress=10,
                status="processing",
            )
            self._uploads = [item] + self._uploads
            self._upload_timelines[item.id] = _build_upload_timeline(item)

            try:
                success = await rag.process_document_complete(
                    file_path=str(destination),
                    output_dir=str(output_dir),
                    parse_method=self.config.parse_method,
                    parser=self.config.parser,
                    doc_id=doc_id,
                )
                item.progress = 100 if success else 0
                item.status = "ready" if success else "failed"
            except Exception:
                item.progress = 0
                item.status = "failed"

            self._upload_timelines[item.id] = _build_upload_timeline(item)
            processed.append(item)
            self._uploads = [
                item if existing.id == item.id else existing for existing in self._uploads
            ]

        return processed


runtime = DashboardRuntime()


def _build_upload_timeline(item: UploadItem) -> list[TimelineEvent]:
    if item.status == "ready":
        return [
            TimelineEvent(
                stage="Document received",
                detail="The file has been accepted into the workspace queue.",
                status="done",
            ),
            TimelineEvent(
                stage="Parsing and extraction",
                detail=f"{item.parser} completed text and structure recovery.",
                status="done",
            ),
            TimelineEvent(
                stage="Embedding and indexing",
                detail="The document is ready for retrieval and citation previews.",
                status="done",
            ),
        ]

    if item.status == "processing":
        return [
            TimelineEvent(
                stage="Document received",
                detail="The file is in the ingestion lane and queued for parser work.",
                status="done",
            ),
            TimelineEvent(
                stage="Parsing and extraction",
                detail=f"{item.parser} is processing page structure and content blocks.",
                status="active",
            ),
            TimelineEvent(
                stage="Embedding and indexing",
                detail="Vector indexing will begin as soon as extraction is complete.",
                status="queued",
            ),
        ]

    if item.status == "failed":
        return [
            TimelineEvent(
                stage="Document received",
                detail="The file reached the ingest lane.",
                status="done",
            ),
            TimelineEvent(
                stage="Parsing and extraction",
                detail=f"{item.parser} reported an issue while preparing this document.",
                status="failed",
            ),
            TimelineEvent(
                stage="Embedding and indexing",
                detail="Indexing is paused until the ingest failure is resolved.",
                status="queued",
            ),
        ]

    return [
        TimelineEvent(
            stage="Document received",
            detail="The file has been accepted and is waiting for parser capacity.",
            status="done",
        ),
        TimelineEvent(
            stage="Parsing and extraction",
            detail=f"{item.parser} has been selected for the next processing window.",
            status="active",
        ),
        TimelineEvent(
            stage="Embedding and indexing",
            detail="Embeddings will be created once parsing is complete.",
            status="queued",
        ),
    ]


def _demo_source_preview(source_id: str) -> SourcePreview:
    previews = {
        "src-1": SourcePreview(
            source_id="src-1",
            title="Q2 roadmap review deck",
            domain="internal://roadmaps/q2-review",
            modality="text",
            collection="Product roadmap vault",
            parser="Docling",
            page_label="Pages 14-18",
            summary=(
                "This preview focuses on the exact section that explains how roadmap "
                "milestones, timeline slides, and narrative notes support the answer."
            ),
            highlighted_excerpt=(
                "Roadmap deltas are described across narrative slides, visual timelines, "
                "and milestone annotations, making it possible to compare delivery intent "
                "against the current operating plan."
            ),
            surrounding_context=[
                "The cited section sits next to release sequencing notes and ownership changes.",
                "Parser metadata shows that layout blocks and speaker notes contributed to the excerpt.",
                "A production source viewer would attach the exact chunk and page anchor here.",
            ],
        ),
        "src-2": SourcePreview(
            source_id="src-2",
            title="Multimodal benchmark appendix",
            domain="internal://research/benchmarks",
            modality="image",
            collection="Research synthesis lab",
            parser="MinerU",
            page_label="Appendix B",
            summary=(
                "This preview shows the benchmark material that explains how retrieval quality, "
                "parser behavior, and multimodal agreement reinforce the current answer."
            ),
            highlighted_excerpt=(
                "Supporting benchmark evidence explains retrieval quality, parser behavior, "
                "and cross-modal agreement across figures, tables, and narrative commentary."
            ),
            surrounding_context=[
                "The surrounding appendix compares parsing strategies across multiple document types.",
                "Visual evidence and captions are preserved so chart interpretation stays grounded.",
                "These cues are useful when users want to inspect why a benchmark source was retrieved.",
            ],
        ),
        "src-3": SourcePreview(
            source_id="src-3",
            title="Knowledge graph delta notes",
            domain="internal://graph/delta-log",
            modality="table",
            collection="Finance intelligence board",
            parser="PaddleOCR",
            page_label="Table extract",
            summary=(
                "This preview highlights the relation and entity updates that were used to anchor "
                "graph-backed reasoning in the current answer."
            ),
            highlighted_excerpt=(
                "Entity and relation changes provide explainable context for answer synthesis by "
                "connecting the cited table entries back to the broader knowledge graph."
            ),
            surrounding_context=[
                "The table sits alongside a relation-delta log describing entity merges and removals.",
                "Structured values and graph labels remain attached to the same citation thread.",
                "This pattern helps teams move from answer review into graph exploration with less friction.",
            ],
        ),
    }

    if source_id not in previews:
        raise KeyError(source_id)

    return previews[source_id]


def create_dashboard_app() -> FastAPI:
    app = FastAPI(
        title="Multi-Model-RAG Dashboard API",
        description="Thin API bridge for the standalone Multi-Model-RAG dashboard.",
        version=_package_version(),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "multi-model-rag-dashboard-api",
            "version": _package_version(),
            "bridge_mode": runtime.bridge_mode,
            "provider": runtime.config.provider,
            "working_dir": runtime.config.working_dir,
        }

    @app.get("/api/dashboard/overview", response_model=DashboardOverview)
    async def get_overview() -> DashboardOverview:
        hero_question = (
            "What changed across the uploaded product roadmap decks this week?"
            if runtime.bridge_mode == "mock"
            else "What does the live runtime currently know about the uploaded corpus?"
        )

        # Use cached featured result if fresh enough
        now = time.monotonic()
        if (
            runtime._overview_cache is not None
            and now - runtime._overview_cache[0] < runtime._overview_cache_ttl
        ):
            featured = runtime._overview_cache[1]
        else:
            featured = await runtime.query(QueryRequest(query=hero_question, mode="Deep Research"))
            runtime._overview_cache = (now, featured)

        uploads = await runtime.current_uploads()
        upload_names = [u.name for u in uploads if u.status == "ready"]

        if upload_names:
            suggestions = [
                f"Summarize the key findings in {upload_names[0]}",
                f"What are the main topics covered across {len(upload_names)} document(s)?",
                "Find contradictions or inconsistencies across uploaded files",
                "Extract all tables and quantitative data from the corpus",
            ]
        else:
            suggestions = [
                "Upload a document to get started with grounded answers",
                "What types of documents does Multi-Model-RAG support?",
                "How does multimodal retrieval work?",
                "Switch to mock mode to explore the dashboard UI",
            ]

        return DashboardOverview(
            bridge_mode=runtime.bridge_mode,
            hero_question=hero_question,
            system_pulse=runtime.system_pulse(),
            suggestions=suggestions,
            recent_queries=[
                RecentQuery(
                    title="Why did latency spike after the April model refresh?",
                    when="8m ago",
                    mode="Deep Research",
                ),
                RecentQuery(
                    title="Extract chart-backed risks from the board pack",
                    when="23m ago",
                    mode="Multimodal",
                ),
                RecentQuery(
                    title="Compare KPI tables against last quarter's memo",
                    when="1h ago",
                    mode="Collections",
                ),
            ],
            collections=await runtime.collections(),
            uploads=uploads,
            featured_result=featured,
        )

    @app.get("/api/dashboard/collections", response_model=list[CollectionSummary])
    async def get_collections() -> list[CollectionSummary]:
        return await runtime.collections()

    @app.post("/api/dashboard/query", response_model=QueryResponse)
    async def query_dashboard(request: QueryRequest) -> QueryResponse:
        try:
            return await runtime.query(request)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.post("/api/dashboard/uploads", response_model=list[UploadItem])
    async def upload_documents(
        files: list[UploadFile] = File(...),
    ) -> list[UploadItem]:
        try:
            return await runtime.ingest_uploads(files)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/dashboard/uploads/{upload_id}/timeline", response_model=list[TimelineEvent])
    async def get_upload_timeline(upload_id: str) -> list[TimelineEvent]:
        try:
            return runtime.upload_timeline(upload_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Upload not found") from exc

    @app.delete("/api/dashboard/uploads/{upload_id}", status_code=204)
    async def delete_upload(upload_id: str) -> None:
        try:
            runtime.delete_upload(upload_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Upload not found") from exc

    @app.get("/api/dashboard/sources/{source_id}/preview", response_model=SourcePreview)
    async def get_source_preview(source_id: str) -> SourcePreview:
        try:
            return await runtime.source_preview(source_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Source not found") from exc
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/dashboard/settings", response_model=DashboardSettings)
    async def get_settings() -> DashboardSettings:
        return runtime.settings()

    @app.get("/api/dashboard/evaluation", response_model=DashboardEvaluation)
    async def get_evaluation() -> DashboardEvaluation:
        return runtime.evaluation()

    @app.post("/api/dashboard/evaluation/run", response_model=DashboardEvaluation)
    async def run_evaluation() -> DashboardEvaluation:
        try:
            return await runtime.run_evaluation_benchmark()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/dashboard/playbooks", response_model=list[DashboardPlaybook])
    async def get_playbooks() -> list[DashboardPlaybook]:
        return runtime.playbooks()

    @app.get(
        "/api/dashboard/observability",
        response_model=DashboardObservability,
    )
    async def get_observability() -> DashboardObservability:
        return await runtime.observability()

    @app.post(
        "/api/dashboard/settings/validate-connection",
        response_model=ConnectionValidationResult,
    )
    async def validate_settings_connection() -> ConnectionValidationResult:
        return runtime.validate_connection()

    return app


app = create_dashboard_app()


def main() -> None:
    try:
        import uvicorn
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "Uvicorn is not installed. Install dashboard dependencies with "
            "`pip install 'multi-model-rag[dashboard]'`."
        ) from exc

    uvicorn.run(
        "multi_model_rag.dashboard_api:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
    )


if __name__ == "__main__":
    main()
