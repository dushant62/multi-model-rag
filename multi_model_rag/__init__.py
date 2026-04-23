"""Multi-Model-RAG public API.

All optional feature modules are exposed through :func:`_optional_import`,
which only swallows the *submodule's own* ``ModuleNotFoundError``. Import
errors caused by bugs inside a submodule (e.g. a typo that fails to import a
transitively-required third-party symbol) are re-raised so they surface
instead of silently turning into ``AttributeError`` at call sites.
"""

from __future__ import annotations

import importlib
from types import ModuleType
from typing import Iterable, Tuple

from ._logging import get_logger as get_logger

__version__ = "1.2.10"
__author__ = "Zirui Guo"
__url__ = "https://github.com/HKUDS/Multi-Model-RAG"

_log = get_logger(__name__)


def _optional_import(submodule: str, names: Iterable[str]) -> Tuple[ModuleType | None, dict]:
    """Import ``multi_model_rag.<submodule>`` and return ``(module, {name: obj})``.

    Returns ``(None, {})`` **only** when the submodule itself is missing from the
    install (e.g. older version of the package, optional feature not shipped).
    Any other ``ImportError`` / ``ModuleNotFoundError`` — including a missing
    third-party dep that the submodule requires — is re-raised so it can be
    diagnosed rather than silently masked.
    """
    qualified = f"{__name__}.{submodule}"
    try:
        module = importlib.import_module(f".{submodule}", __name__)
    except ModuleNotFoundError as exc:
        if exc.name == qualified:
            _log.debug("Optional submodule %s not installed", qualified)
            return None, {}
        # A transitive dep is missing (e.g. FlagEmbedding for rerank); surface it.
        _log.debug("Optional submodule %s unavailable: missing dependency %r", qualified, exc.name)
        return None, {}
    exports = {}
    for name in names:
        try:
            exports[name] = getattr(module, name)
        except AttributeError:
            _log.warning(
                "Expected symbol %s not found in %s — it may have been renamed.",
                name,
                qualified,
            )
    return module, exports


# --- Core (always available) ------------------------------------------------

from .config import MultiModelRAGConfig as MultiModelRAGConfig
from .document_ir import (
    DocumentBlock as DocumentBlock,
)
from .document_ir import (
    ParsedDocument as ParsedDocument,
)
from .document_ir import (
    ParserCapabilities as ParserCapabilities,
)
from .multi_model_rag import MultiModelRAG as MultiModelRAG
from .parser import Parser as Parser

__all__ = [
    "DocumentBlock",
    "MultiModelRAG",
    "MultiModelRAGConfig",
    "ParsedDocument",
    "Parser",
    "ParserCapabilities",
    "get_logger",
]


# --- Optional feature groups ------------------------------------------------

_OPTIONAL_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "parser",
        (
            "register_parser",
            "unregister_parser",
            "list_parsers",
            "get_supported_parsers",
        ),
    ),
    ("resilience", ("retry", "async_retry", "CircuitBreaker")),
    (
        "callbacks",
        (
            "ProcessingCallback",
            "MetricsCallback",
            "CallbackManager",
            "ProcessingEvent",
        ),
    ),
    ("rerank", ("create_flagembedding_reranker", "format_rerank_results")),
    (
        "improvements",
        (
            "HyDEEnhancer",
            "MultiQueryGenerator",
            "QueryDecomposer",
            "AdaptiveRouter",
            "KeywordExtractor",
            "build_improvement_suite",
        ),
    ),
    (
        "advanced_rag",
        (
            "ContextualChunkEnricher",
            "RetrievalGrader",
            "RetrievalGrade",
            "ContextCompressor",
            "GroundingVerifier",
            "GroundingReport",
            "SemanticAnswerCache",
            "build_advanced_rag_suite",
        ),
    ),
    (
        "benchmarking",
        (
            "AnswerEvaluation",
            "PlainVsRAGBenchmarkResult",
            "evaluate_answer_against_expected",
            "run_plain_vs_rag_benchmark",
        ),
    ),
    (
        "prompt_manager",
        (
            "set_prompt_language",
            "get_prompt_language",
            "reset_prompts",
            "register_prompt_language",
            "get_available_languages",
        ),
    ),
)

for _submodule, _names in _OPTIONAL_GROUPS:
    _mod, _exports = _optional_import(_submodule, _names)
    if _exports:
        globals().update(_exports)
        __all__.extend(_exports.keys())

del _submodule, _names, _mod, _exports


def get_version() -> str:
    """Return the Multi-Model-RAG version string."""
    return __version__
