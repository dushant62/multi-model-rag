import type {
  BenchmarkAnswer,
  CollectionSummary,
  ConnectionValidationResult,
  DashboardEvaluation,
  DashboardObservability,
  DashboardPlaybook,
  DashboardSettings,
  DashboardOverview,
  ParserOption,
  ProviderOption,
  QueryRequest,
  QueryResult,
  SourcePreview,
  TimelineEvent,
  SearchMode,
  UploadItem,
  CitationSource,
} from "@/lib/types";

const collectionCatalog: CollectionSummary[] = [
  {
    id: "roadmaps",
    name: "Product roadmap vault",
    documents: 48,
    embeddings: "192k vectors",
    focus: "Product strategy, release plans, meeting notes",
  },
  {
    id: "research",
    name: "Research synthesis lab",
    documents: 31,
    embeddings: "88k vectors",
    focus: "Papers, charts, evaluation tables, multimodal benchmarks",
  },
  {
    id: "finance",
    name: "Finance intelligence board",
    documents: 17,
    embeddings: "41k vectors",
    focus: "Quarterly reports, KPI tables, annotated dashboards",
  },
];

const activeUploads: UploadItem[] = [
  {
    id: "deck",
    name: "q2-product-review.pdf",
    parser: "Docling",
    pages: 84,
    progress: 100,
    status: "ready",
  },
  {
    id: "spec",
    name: "vision-model-benchmark.pptx",
    parser: "MinerU",
    pages: 36,
    progress: 72,
    status: "processing",
  },
  {
    id: "sheet",
    name: "supply-chain-variance.xlsx",
    parser: "PaddleOCR",
    pages: 18,
    progress: 28,
    status: "queued",
  },
];

const suggestionDeck = [
  "Compare the latest roadmap deck against last quarter's launch promises",
  "Find every chart that explains the latency regression story",
  "Turn the equation-heavy appendix into an executive summary",
  "Which uploaded documents mention parser fallback behavior?",
];

function modalityMix(query: string) {
  const lower = query.toLowerCase();

  if (lower.includes("equation") || lower.includes("formula")) {
    return ["equation", "text", "table"] as const;
  }

  if (lower.includes("chart") || lower.includes("image") || lower.includes("vision")) {
    return ["image", "text", "table"] as const;
  }

  if (lower.includes("table") || lower.includes("kpi") || lower.includes("finance")) {
    return ["table", "text", "image"] as const;
  }

  return ["text", "image", "table"] as const;
}

function buildSources(query: string) {
  const [primary, secondary, tertiary] = modalityMix(query);

  return [
    {
      id: "src-1",
      title: "Q2 roadmap review deck",
      domain: "internal://roadmaps/q2-review",
      modality: primary,
      snippet:
        "This document aligns the executive roadmap with delivery progress and annotates visual changes across milestone slides.",
      relevance: 0.96,
      freshness: "2h ago",
    },
    {
      id: "src-2",
      title: "Multimodal benchmark appendix",
      domain: "internal://research/benchmarks",
      modality: secondary,
      snippet:
        "Benchmark tables and evaluation notes provide supporting evidence for retrieval quality, latency, and parser behavior.",
      relevance: 0.91,
      freshness: "Yesterday",
    },
    {
      id: "src-3",
      title: "Knowledge graph delta notes",
      domain: "internal://graph/delta-log",
      modality: tertiary,
      snippet:
        "Cross-modal relationship extraction highlights entities, figures, and calculation changes that impact the synthesized answer.",
      relevance: 0.86,
      freshness: "3d ago",
    },
  ];
}

function buildMetrics(mode: SearchMode) {
  return [
    {
      label: "Answer confidence",
      value: mode === "Deep Research" ? "94%" : "89%",
      detail: "Weighted from citation density and parser agreement",
    },
    {
      label: "Source coverage",
      value: mode === "Multimodal" ? "11 modalities" : "7 modalities",
      detail: "Text, image, table, equation and graph relationships",
    },
    {
      label: "Retrieval latency",
      value: mode === "Collections" ? "312ms" : "248ms",
      detail: "Simulated end-to-end orchestration window",
    },
  ];
}

function buildTimeline(mode: SearchMode) {
  const deep = mode === "Deep Research";

  return [
    {
      stage: "Parse harmonization",
      detail: deep
        ? "Cross-checking Docling and MinerU block alignment."
        : "Using cached parse structure and modality map.",
      status: "done" as const,
    },
    {
      stage: "Cross-modal retrieval",
      detail: deep
        ? "Merging dense retrieval, graph traversals, and evidence reranking."
        : "Combining semantic search with citation-focused reranking.",
      status: "active" as const,
    },
    {
      stage: "Answer shaping",
      detail:
        "Packaging synthesis, source provenance, and follow-up exploration paths for the dashboard canvas.",
      status: "queued" as const,
    },
  ];
}

function buildAnswer(query: string, mode: SearchMode) {
  return [
    `Multi-Model-RAG treats "${query}" as a ${mode.toLowerCase()} task and composes the answer from text blocks, visual evidence, tabular deltas, and graph-linked citations instead of collapsing everything into plain text first.`,
    "The strongest signal comes from the product roadmap deck and the benchmark appendix, where the same themes recur across narrative slides, chart captions, and structured evaluation tables. That overlap is why the answer confidence stays high even when the evidence spans different modalities.",
    "The workspace keeps the synthesis, source ledger, parser trace, and collection context together so the answer reads like a finished product surface rather than a detached model response.",
  ];
}

export function createMockQueryResult({
  query,
  mode,
}: QueryRequest): QueryResult {
  return {
    query,
    mode,
    answer: buildAnswer(query, mode),
    followUps: [
      "Show only image-backed evidence for this answer",
      "Trace which parser introduced the most uncertainty",
      "Convert this synthesis into an executive update",
    ],
    metrics: buildMetrics(mode),
    sources: buildSources(query),
    timeline: buildTimeline(mode),
  };
}

export function createMockUploads(fileNames: string[]): UploadItem[] {
  return fileNames.map((name, index) => ({
    id: `upload-${name}-${index}`,
    name,
    parser: index % 2 === 0 ? "Docling" : "MinerU",
    pages: 12 + index * 7,
    progress: index === 0 ? 45 : 0,
    status: index === 0 ? "processing" : "queued",
  }));
}

export function createMockUploadTimeline(upload: UploadItem): TimelineEvent[] {
  if (upload.status === "ready") {
    return [
      {
        stage: "Document received",
        detail: "The file has been accepted into the workspace queue.",
        status: "done",
      },
      {
        stage: "Parsing and extraction",
        detail: `${upload.parser} completed text and structure recovery.`,
        status: "done",
      },
      {
        stage: "Embedding and indexing",
        detail: "The document is ready for retrieval and citation previews.",
        status: "done",
      },
    ];
  }

  if (upload.status === "processing") {
    return [
      {
        stage: "Document received",
        detail: "The file is in the ingestion lane and queued for parser work.",
        status: "done",
      },
      {
        stage: "Parsing and extraction",
        detail: `${upload.parser} is processing page structure and content blocks.`,
        status: "active",
      },
      {
        stage: "Embedding and indexing",
        detail: "Vector indexing will begin as soon as extraction is complete.",
        status: "queued",
      },
    ];
  }

  if (upload.status === "failed") {
    return [
      {
        stage: "Document received",
        detail: "The file reached the ingest lane.",
        status: "done",
      },
      {
        stage: "Parsing and extraction",
        detail: `${upload.parser} reported an issue while preparing this document.`,
        status: "failed",
      },
      {
        stage: "Embedding and indexing",
        detail: "Indexing is paused until the ingest failure is resolved.",
        status: "queued",
      },
    ];
  }

  return [
    {
      stage: "Document received",
      detail: "The file has been accepted and is waiting for parser capacity.",
      status: "done",
    },
    {
      stage: "Parsing and extraction",
      detail: `${upload.parser} has been selected for the next processing window.`,
      status: "active",
    },
    {
      stage: "Embedding and indexing",
      detail: "Embeddings will be created once parsing is complete.",
      status: "queued",
    },
  ];
}

export function getMockCollections(): CollectionSummary[] {
  return collectionCatalog;
}

export function createMockSourcePreview(source: CitationSource): SourcePreview {
  return {
    sourceId: source.id,
    title: source.title,
    domain: source.domain,
    modality: source.modality,
    collection:
      source.id === "src-1"
        ? "Product roadmap vault"
        : source.id === "src-2"
          ? "Research synthesis lab"
          : "Finance intelligence board",
    parser: source.id === "src-3" ? "PaddleOCR" : "Docling",
    pageLabel: source.id === "src-1" ? "Pages 14-18" : "Section preview",
    summary:
      "This preview exposes the supporting context behind the citation so users can verify why the source appears in the answer.",
    highlightedExcerpt: source.snippet,
    surroundingContext: [
      "The surrounding section connects the cited claim to the broader project narrative and clarifies how the evidence was interpreted.",
      "Metadata from the parser and collection help explain why this document ranked highly for the current question.",
      "This is where a production source viewer would expose the exact chunk, page anchor, and adjacent excerpt.",
    ],
  };
}

const mockProviders: ProviderOption[] = [
  {
    id: "openai",
    label: "OpenAI-compatible",
    status: "standby",
    detail: "Best for live multimodal runs with richer vision support.",
    llmModels: ["gpt-4o-mini", "gpt-4o"],
    embeddingModels: ["text-embedding-3-large"],
  },
  {
    id: "ollama",
    label: "Ollama",
    status: "available",
    detail: "Local-first option for offline or self-hosted RAG deployments.",
    llmModels: ["llama3.2"],
    embeddingModels: ["nomic-embed-text"],
  },
];

const mockParsers: ParserOption[] = [
  {
    id: "mineru",
    label: "MinerU",
    detail: "Balanced multimodal parser for mixed research material.",
  },
  {
    id: "docling",
    label: "Docling",
    detail: "Layout-aware parser for reports, decks, and enterprise documents.",
  },
  {
    id: "paddleocr",
    label: "PaddleOCR",
    detail: "OCR-heavy parser for scans, screenshots, and image-first inputs.",
  },
];

export function getMockDashboardSettings(): DashboardSettings {
  return {
    bridgeMode: "mock",
    provider: "openai",
    parser: "mineru",
    parseMethod: "auto",
    workingDir: "./rag_storage",
    outputDir: "./output/dashboard",
    uploadDir: "./rag_storage/dashboard_uploads",
    llmModel: "gpt-4o-mini",
    visionModel: "gpt-4o",
    embeddingModel: "text-embedding-3-large",
    embeddingDim: 3072,
    envControlled: true,
    providers: mockProviders,
    parsers: mockParsers,
    ragImprovements: {
      hydeEnabled: false,
      multiQueryEnabled: false,
      queryDecompositionEnabled: false,
      adaptiveRoutingEnabled: true,
      keywordExtractionEnabled: true,
      rerankerEnabled: true,
      responseType: "Multiple Paragraphs",
      contextualRetrievalEnabled: false,
      retrievalGraderEnabled: false,
      contextCompressionEnabled: false,
      groundingVerificationEnabled: false,
      semanticCacheEnabled: false,
    },
  };
}

export function getMockConnectionValidation(): ConnectionValidationResult {
  return {
    success: false,
    provider: "openai",
    message: "No OpenAI-compatible API key is configured for the dashboard bridge.",
    checkedAt: "just now",
  };
}

function buildMockBenchmarkAnswer(
  answer: string,
  latencySeconds: number,
  verdict: BenchmarkAnswer["verdict"],
  matchedExpected: string[],
  missingExpected: string[],
): BenchmarkAnswer {
  return {
    answer,
    latencySeconds,
    verdict,
    matchedExpected,
    missingExpected,
  };
}

export function getMockDashboardEvaluation(): DashboardEvaluation {
  return {
    bridgeMode: "mock",
    benchmarkName: "Plain vs RAG grounding benchmark",
    sourceArtifact:
      "/home/noodle/Multi-Model-RAG-lab/reports/gemma_plain_vs_rag_benchmark_output.json",
    question:
      "What is the codename for the parser fallback strategy, and which reranking stack was approved in the project brief?",
    model: "gemma3:1b",
    embeddingModel: "nomic-embed-text",
    documentExcerpt:
      "Project Helix internal research brief. The parser fallback strategy is code-named Helix-Saffron. The approved retrieval stack combines BGE reranking with ColBERT late interaction.",
    expectedFacts: {
      parser_fallback_codename: "Helix-Saffron",
      approved_reranking_stack: "BGE reranking with ColBERT late interaction",
    },
    metrics: [
      {
        label: "Grounding gain",
        value: "+1 facts",
        detail: "Plain matched 0/2 hidden facts; RAG matched 1/2 fully and recovered the key stack family.",
      },
      {
        label: "Latency delta",
        value: "182.6s",
        detail: "The current benchmark proves quality improvement, but the runtime still needs a serious speed pass.",
      },
      {
        label: "Current winner",
        value: "RAG",
        detail: "The benchmark clearly favors retrieval-backed grounding over the plain local model.",
      },
      {
        label: "Runtime posture",
        value: "Collections stable • parser queue visible • citation depth healthy",
        detail: "This ties the quality story back to the current dashboard posture.",
      },
    ],
    plainLlm: buildMockBenchmarkAnswer(
      "The codename for the parser fallback strategy is Phoenix. The reranking stack approved in the project brief is Stable.",
      8.13,
      "incorrect",
      [],
      ["parser_fallback_codename", "approved_reranking_stack"],
    ),
    rag: buildMockBenchmarkAnswer(
      "The codename for the parser fallback strategy is Helix-Saffron. The reranking stack approved in the project brief is BGE reranking.",
      190.765,
      "partial",
      ["parser_fallback_codename"],
      ["approved_reranking_stack"],
    ),
    recommendations: [
      {
        title: "Promote reranking into the runtime default",
        priority: "high",
        detail:
          "The current answer still misses the full ColBERT late-interaction detail, which means retrieval ordering needs to improve.",
        impact: "Higher factual recall on multi-part benchmark questions.",
      },
      {
        title: "Add timing observability per retrieval stage",
        priority: "high",
        detail:
          "The current stack improves grounding, but it pays too much latency for a simple benchmark document.",
        impact: "Makes optimization decisions measurable and stakeholder-visible.",
      },
      {
        title: "Expand evaluation coverage beyond one hidden-fact test",
        priority: "medium",
        detail:
          "The benchmark harness is now real and reusable; the next move is repeating it across tables, images, and heavier document sets.",
        impact: "Builds a credible quality story instead of a single anecdote.",
      },
    ],
  };
}

export function getMockDashboardPlaybooks(): DashboardPlaybook[] {
  return [
    {
      id: "ragflow-grounded-audit",
      title: "Grounded evidence audit",
      sourceProduct: "RAGFlow",
      summary:
        "A chunk-trace-oriented preset for auditing which uploaded evidence best supports a high-stakes answer.",
      query:
        "Audit which uploaded documents explain the current latency regression and show the strongest grounded citations.",
      mode: "Deep Research",
      capabilities: [
        "Grounded citations",
        "Chunk-trace thinking",
        "Parser-aware retrieval",
      ],
      runtimeFit: "hybrid",
      actionLabel: "Run audit",
    },
    {
      id: "dify-executive-workflow",
      title: "Executive workflow brief",
      sourceProduct: "Dify",
      summary:
        "A repeatable workflow-style preset for turning the current corpus into an executive summary with risks and next actions.",
      query:
        "Create an executive brief from the current collections that explains what changed, what is risky, and what needs follow-up.",
      mode: "Collections",
      capabilities: [
        "Workflow preset",
        "Executive synthesis",
        "Repeatable operator flow",
      ],
      runtimeFit: "cloud",
      actionLabel: "Run workflow",
    },
    {
      id: "open-webui-offline-scan",
      title: "Offline-first retrieval scan",
      sourceProduct: "Open WebUI",
      summary:
        "A local-first preset that keeps provider posture visible while identifying sources suited for an offline answer path.",
      query:
        "Run an offline-first retrieval scan across the workspace and summarize which sources are best suited for a local model answer.",
      mode: "Search",
      capabilities: [
        "Offline-first posture",
        "Provider visibility",
        "Local-model readiness",
      ],
      runtimeFit: "offline-first",
      actionLabel: "Run scan",
    },
    {
      id: "anythingllm-workspace-operator",
      title: "Workspace operator handoff",
      sourceProduct: "AnythingLLM",
      summary:
        "A workspace-first preset that packages sources, actions, and open questions into an operator handoff.",
      query:
        "Build a workspace operator handoff that lists the best sources, open questions, and next actions for the active corpus.",
      mode: "Multimodal",
      capabilities: [
        "Workspace-first flow",
        "Source-backed handoff",
        "Operator context",
      ],
      runtimeFit: "hybrid",
      actionLabel: "Generate handoff",
    },
  ];
}

export function getMockDashboardObservability(): DashboardObservability {
  return {
    bridgeMode: "mock",
    provider: "openai",
    parser: "mineru",
    workingDir: "./rag_storage",
    benchmarkStatus: "artifact loaded",
    benchmarkSourceArtifact:
      "/home/noodle/Multi-Model-RAG-lab/reports/gemma_plain_vs_rag_benchmark_output.json",
    metrics: [
      {
        label: "Ready uploads",
        value: "1",
        detail: "Documents currently available for grounded retrieval.",
      },
      {
        label: "Ingestion queue",
        value: "2",
        detail: "Files still moving through parser and indexing stages.",
      },
      {
        label: "Playbooks ready",
        value: "4",
        detail: "Runnable workflows derived from cloned product patterns.",
      },
      {
        label: "Benchmark leader",
        value: "RAG",
        detail: "Current evaluation artifact favors retrieval-backed grounding.",
      },
    ],
    notes: [
      "Dify-style workflow thinking is now represented as runnable dashboard playbooks.",
      "Open WebUI-style provider posture stays visible through bridge, provider, parser, and working directory exposure.",
      "AnythingLLM-style workspace guidance stays attached to the presets instead of getting hidden in docs.",
    ],
    timeline: [
      {
        stage: "Workflow presets",
        detail:
          "RAGFlow, Dify, Open WebUI, and AnythingLLM patterns were converted into runnable playbooks.",
        status: "done",
      },
      {
        stage: "Runtime visibility",
        detail:
          "Bridge, provider, parser, and ingestion posture remain visible to the operator.",
        status: "done",
      },
      {
        stage: "Benchmark grounding",
        detail:
          "The evaluation layer is still connected to the saved Gemma benchmark artifact.",
        status: "done",
      },
    ],
  };
}

export function getMockOverview(): DashboardOverview {
  return {
    bridgeMode: "mock",
    heroQuestion:
      "What changed across the uploaded product roadmap decks this week?",
    systemPulse:
      "Collections stable • parser queue visible • citation depth healthy",
    suggestions: suggestionDeck,
    recentQueries: [
      {
        title: "Why did latency spike after the April model refresh?",
        when: "8m ago",
        mode: "Deep Research",
      },
      {
        title: "Extract chart-backed risks from the board pack",
        when: "23m ago",
        mode: "Multimodal",
      },
      {
        title: "Compare KPI tables against last quarter's memo",
        when: "1h ago",
        mode: "Collections",
      },
    ],
    collections: collectionCatalog,
    uploads: activeUploads,
    featuredResult: createMockQueryResult({
      query: "What changed across the uploaded product roadmap decks this week?",
      mode: "Deep Research",
    }),
  };
}
