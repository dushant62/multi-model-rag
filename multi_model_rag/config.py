"""
Configuration classes for MultiModelRAG

Contains configuration dataclasses with environment variable support
"""

from dataclasses import dataclass, field
from typing import List

from lightrag.utils import get_env_value


@dataclass
class MultiModelRAGConfig:
    """Configuration class for MultiModelRAG with environment variable support"""

    # Directory Configuration
    # ---
    working_dir: str = field(default=get_env_value("WORKING_DIR", "./rag_storage", str))
    """Directory where RAG storage and cache files are stored."""

    # Parser Configuration
    # ---
    parse_method: str = field(default=get_env_value("PARSE_METHOD", "auto", str))
    """Default parsing method for document parsing: 'auto', 'ocr', or 'txt'."""

    parser_output_dir: str = field(default=get_env_value("OUTPUT_DIR", "./output", str))
    """Default output directory for parsed content."""

    parser: str = field(default=get_env_value("PARSER", "mineru", str))
    """Parser selection: 'mineru', 'docling', or 'paddleocr'."""

    display_content_stats: bool = field(default=get_env_value("DISPLAY_CONTENT_STATS", True, bool))
    """Whether to display content statistics during parsing."""

    # Multimodal Processing Configuration
    # ---
    enable_image_processing: bool = field(
        default=get_env_value("ENABLE_IMAGE_PROCESSING", True, bool)
    )
    """Enable image content processing."""

    enable_table_processing: bool = field(
        default=get_env_value("ENABLE_TABLE_PROCESSING", True, bool)
    )
    """Enable table content processing."""

    enable_equation_processing: bool = field(
        default=get_env_value("ENABLE_EQUATION_PROCESSING", True, bool)
    )
    """Enable equation content processing."""

    # Batch Processing Configuration
    # ---
    max_concurrent_files: int = field(default=get_env_value("MAX_CONCURRENT_FILES", 1, int))
    """Maximum number of files to process concurrently."""

    supported_file_extensions: List[str] = field(
        default_factory=lambda: get_env_value(
            "SUPPORTED_FILE_EXTENSIONS",
            ".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.tif,.gif,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md",
            str,
        ).split(",")
    )
    """List of supported file extensions for batch processing."""

    recursive_folder_processing: bool = field(
        default=get_env_value("RECURSIVE_FOLDER_PROCESSING", True, bool)
    )
    """Whether to recursively process subfolders in batch mode."""

    # Context Extraction Configuration
    # ---
    context_window: int = field(default=get_env_value("CONTEXT_WINDOW", 1, int))
    """Number of pages/chunks to include before and after current item for context."""

    context_mode: str = field(default=get_env_value("CONTEXT_MODE", "page", str))
    """Context extraction mode: 'page' for page-based, 'chunk' for chunk-based."""

    max_context_tokens: int = field(default=get_env_value("MAX_CONTEXT_TOKENS", 2000, int))
    """Maximum number of tokens in extracted context."""

    include_headers: bool = field(default=get_env_value("INCLUDE_HEADERS", True, bool))
    """Whether to include document headers and titles in context."""

    include_captions: bool = field(default=get_env_value("INCLUDE_CAPTIONS", True, bool))
    """Whether to include image/table captions in context."""

    context_filter_content_types: List[str] = field(
        default_factory=lambda: get_env_value("CONTEXT_FILTER_CONTENT_TYPES", "text", str).split(
            ","
        )
    )
    """Content types to include in context extraction (e.g., 'text', 'image', 'table')."""

    content_format: str = field(default=get_env_value("CONTENT_FORMAT", "minerU", str))
    """Default content format for context extraction when processing documents."""

    # Path Handling Configuration
    # ---
    use_full_path: bool = field(default=get_env_value("USE_FULL_PATH", False, bool))
    """Whether to use full file path (True) or just basename (False) for file references in LightRAG."""

    # -----------------------------------------------------------------------
    # RAG Improvement Techniques (2025)
    # All features are opt-in — disabled by default for backward compatibility.
    # -----------------------------------------------------------------------

    # HyDE — Hypothetical Document Embedding
    # ---
    enable_hyde: bool = field(default=get_env_value("ENABLE_HYDE", False, bool))
    """Enable HyDE (Hypothetical Document Embedding) to improve retrieval accuracy.
    Before retrieval, the LLM generates a hypothetical answer whose embedding is
    used to retrieve more relevant chunks. Typically improves accuracy by 10-30%."""

    hyde_mode: str = field(default=get_env_value("HYDE_MODE", "expand", str))
    """HyDE expansion mode: 'expand' (append hypothesis to query, safer) or
    'replace' (use hypothesis as the retrieval query)."""

    # Multi-Query Retrieval
    # ---
    enable_multi_query: bool = field(default=get_env_value("ENABLE_MULTI_QUERY", False, bool))
    """Enable multi-query retrieval. Generates N rephrased variants of the query,
    retrieves for each, and returns the most comprehensive answer."""

    multi_query_count: int = field(default=get_env_value("MULTI_QUERY_COUNT", 3, int))
    """Number of query variants to generate when multi-query is enabled."""

    # Query Decomposition
    # ---
    enable_query_decomposition: bool = field(
        default=get_env_value("ENABLE_QUERY_DECOMPOSITION", False, bool)
    )
    """Enable automatic decomposition of complex multi-part questions into focused
    sub-queries. Sub-answers are synthesised into a single final response."""

    max_sub_queries: int = field(default=get_env_value("MAX_SUB_QUERIES", 3, int))
    """Maximum number of sub-queries when query decomposition is enabled."""

    # Adaptive Query Routing
    # ---
    enable_adaptive_routing: bool = field(
        default=get_env_value("ENABLE_ADAPTIVE_ROUTING", True, bool)
    )
    """Enable automatic selection of the optimal LightRAG retrieval mode
    (local / global / hybrid / mix / naive) based on query characteristics.
    When enabled, the ``mode`` parameter passed to ``aquery`` becomes a fallback."""

    default_query_mode: str = field(default=get_env_value("DEFAULT_QUERY_MODE", "mix", str))
    """Default retrieval mode used when adaptive routing is disabled or inconclusive.
    Options: 'local', 'global', 'hybrid', 'naive', 'mix' (recommended)."""

    # Keyword Extraction
    # ---
    enable_keyword_extraction: bool = field(
        default=get_env_value("ENABLE_KEYWORD_EXTRACTION", True, bool)
    )
    """Extract high-level and low-level keywords from the query and pass them to
    LightRAG's hl_keywords / ll_keywords fields for more targeted retrieval."""

    # Response Quality
    # ---
    response_type: str = field(default=get_env_value("RESPONSE_TYPE", "Multiple Paragraphs", str))
    """LightRAG response format: 'Multiple Paragraphs', 'Single Paragraph',
    'Bullet Points', 'Single Sentence'."""

    # Reranker
    # ---
    enable_reranker: bool = field(default=get_env_value("ENABLE_RERANKER", True, bool))
    """Enable FlagEmbedding reranker for retrieved chunks (requires FlagEmbedding
    optional dependency). When True and FlagEmbedding is available, the reranker
    is wired into LightRAG's rerank_model_func at initialization time."""

    reranker_model: str = field(
        default=get_env_value("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3", str)
    )
    """HuggingFace model ID for the FlagEmbedding cross-encoder reranker.
    'BAAI/bge-reranker-v2-m3' is multilingual and state-of-the-art as of 2025."""

    min_rerank_score: float = field(default=get_env_value("MIN_RERANK_SCORE", 0.0, float))
    """Minimum reranker score threshold. Chunks scoring below this value are
    filtered out before being passed to the LLM. 0.0 disables filtering."""

    # -----------------------------------------------------------------------
    # Advanced RAG Techniques (2025/2026)
    # See multi_model_rag.advanced_rag for implementations.
    # All features are opt-in — disabled by default.
    # -----------------------------------------------------------------------

    # Contextual Retrieval (Anthropic, Sept 2024)
    # ---
    enable_contextual_retrieval: bool = field(
        default=get_env_value("ENABLE_CONTEXTUAL_RETRIEVAL", False, bool)
    )
    """Prepend a one-sentence chunk-specific summary to each chunk before
    embedding. Anthropic reports a 35% reduction in retrieval failures and up
    to 49% when combined with reranking. Applied at ingestion time through
    ``ContextualChunkEnricher``."""

    contextual_retrieval_max_doc_chars: int = field(
        default=get_env_value("CONTEXTUAL_RETRIEVAL_MAX_DOC_CHARS", 12000, int)
    )
    """Maximum document length passed to the contextualisation prompt."""

    # CRAG-style Retrieval Grader
    # ---
    enable_retrieval_grader: bool = field(
        default=get_env_value("ENABLE_RETRIEVAL_GRADER", False, bool)
    )
    """Enable CRAG-style grading of retrieved context. When the grader flags
    retrieval as ``insufficient`` the pipeline can fall back to query rewriting,
    an expanded search, or a low-confidence answer."""

    retrieval_grader_sufficient_threshold: float = field(
        default=get_env_value("RETRIEVAL_GRADER_SUFFICIENT_THRESHOLD", 0.75, float)
    )
    """Score threshold (0..1) above which retrieval is considered sufficient."""

    # Contextual Compression
    # ---
    enable_context_compression: bool = field(
        default=get_env_value("ENABLE_CONTEXT_COMPRESSION", False, bool)
    )
    """Run retrieved context through an LLM filter that keeps only sentences
    directly relevant to the query. Reduces noise and fits more useful content
    into the LLM context window."""

    # Grounding Verifier
    # ---
    enable_grounding_verification: bool = field(
        default=get_env_value("ENABLE_GROUNDING_VERIFICATION", False, bool)
    )
    """Run a post-generation grounding audit: the LLM scores whether each claim
    in the answer is supported by the retrieved context. Low-scoring answers can
    be regenerated with a stricter prompt or surfaced with a confidence flag."""

    grounding_pass_threshold: float = field(
        default=get_env_value("GROUNDING_PASS_THRESHOLD", 0.7, float)
    )
    """Grounding score threshold (0..1). Answers below this are considered
    ungrounded."""

    # Semantic Answer Cache
    # ---
    enable_semantic_cache: bool = field(default=get_env_value("ENABLE_SEMANTIC_CACHE", False, bool))
    """Enable the in-process query→answer cache. Tier 1 is exact-match on the
    normalized query; tier 2 uses embedding similarity when an embed function is
    available. Greatly reduces latency for repeated or near-duplicate queries."""

    semantic_cache_max_entries: int = field(
        default=get_env_value("SEMANTIC_CACHE_MAX_ENTRIES", 512, int)
    )
    """Maximum number of entries in the semantic cache before LRU eviction."""

    semantic_cache_ttl_seconds: float = field(
        default=get_env_value("SEMANTIC_CACHE_TTL_SECONDS", 0.0, float)
    )
    """Cache TTL in seconds. 0 disables expiry."""

    semantic_cache_similarity_threshold: float = field(
        default=get_env_value("SEMANTIC_CACHE_SIMILARITY_THRESHOLD", 0.92, float)
    )
    """Cosine-similarity threshold for tier-2 semantic hits (0..1)."""

    def __post_init__(self):
        """Post-initialization setup for backward compatibility"""
        # Support legacy environment variable names for backward compatibility
        legacy_parse_method = get_env_value("MINERU_PARSE_METHOD", None, str)
        if legacy_parse_method and not get_env_value("PARSE_METHOD", None, str):
            self.parse_method = legacy_parse_method
            import warnings

            warnings.warn(
                "MINERU_PARSE_METHOD is deprecated. Use PARSE_METHOD instead.",
                DeprecationWarning,
                stacklevel=2,
            )

    @property
    def mineru_parse_method(self) -> str:
        """
        Backward compatibility property for old code.

        .. deprecated::
           Use `parse_method` instead. This property will be removed in a future version.
        """
        import warnings

        warnings.warn(
            "mineru_parse_method is deprecated. Use parse_method instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        return self.parse_method

    @mineru_parse_method.setter
    def mineru_parse_method(self, value: str):
        """Setter for backward compatibility"""
        import warnings

        warnings.warn(
            "mineru_parse_method is deprecated. Use parse_method instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        self.parse_method = value
