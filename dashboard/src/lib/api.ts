import {
  createMockSourcePreview,
  createMockUploadTimeline,
  getMockConnectionValidation,
  getMockDashboardEvaluation,
  getMockDashboardObservability,
  getMockDashboardPlaybooks,
  getMockDashboardSettings,
  getMockCollections,
  getMockOverview,
} from "@/lib/mock-data";
import type {
  CollectionSummary,
  ConnectionValidationResult,
  DashboardEvaluation,
  DashboardObservability,
  DashboardPlaybook,
  DashboardHealth,
  DashboardOverview,
  DashboardSettings,
  QueryRequest,
  QueryResult,
  SourcePreview,
  TimelineEvent,
  UploadItem,
  CitationSource,
} from "@/lib/types";

// When NEXT_PUBLIC_MULTIMODEL_API_BASE_URL is unset, fall back to same-origin
// in the browser (Next.js rewrites proxy /api/dashboard/* to the backend) and
// 127.0.0.1:8000 on the server. This keeps local dev + Railway single-port
// deploy both working without code changes.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_MULTIMODEL_API_BASE_URL ??
  (typeof window === "undefined" ? "http://127.0.0.1:8000" : "");

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
      return payload.detail;
    }
  } catch {
    // Fall through to the generic message below.
  }

  return `Dashboard bridge request failed: ${response.status}`;
}

async function safeJson<T>(
  path: string,
  init: RequestInit,
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return (await response.json()) as T;
  } catch {
    return fallback();
  }
}

async function strictJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function normalizeQueryResult(payload: unknown): QueryResult {
  if (
    payload &&
    typeof payload === "object" &&
    "followUps" in payload &&
    Array.isArray((payload as { followUps?: unknown[] }).followUps)
  ) {
    return payload as QueryResult;
  }

  const snake = payload as {
    query: string;
    mode: QueryResult["mode"];
    answer: string[];
    follow_ups: string[];
    metrics: QueryResult["metrics"];
    sources: QueryResult["sources"];
    timeline: QueryResult["timeline"];
  };

  return {
    query: snake.query,
    mode: snake.mode,
    answer: snake.answer,
    followUps: snake.follow_ups,
    metrics: snake.metrics,
    sources: snake.sources,
    timeline: snake.timeline,
  };
}

function normalizeOverview(payload: unknown): DashboardOverview {
  if (
    payload &&
    typeof payload === "object" &&
    "bridgeMode" in payload &&
    "featuredResult" in payload
  ) {
    return payload as DashboardOverview;
  }

  const snake = payload as {
    bridge_mode: DashboardOverview["bridgeMode"];
    hero_question: string;
    system_pulse: string;
    suggestions: string[];
    recent_queries: DashboardOverview["recentQueries"];
    collections: DashboardOverview["collections"];
    uploads: DashboardOverview["uploads"];
    featured_result: unknown;
  };

  return {
    bridgeMode: snake.bridge_mode,
    heroQuestion: snake.hero_question,
    systemPulse: snake.system_pulse,
    suggestions: snake.suggestions,
    recentQueries: snake.recent_queries,
    collections: snake.collections,
    uploads: snake.uploads,
    featuredResult: normalizeQueryResult(snake.featured_result),
  };
}

function normalizeHealth(payload: unknown): DashboardHealth {
  if (
    payload &&
    typeof payload === "object" &&
    "bridgeMode" in payload &&
    "workingDir" in payload
  ) {
    return payload as DashboardHealth;
  }

  const snake = payload as {
    status: string;
    service: string;
    version: string;
    bridge_mode: DashboardHealth["bridgeMode"];
    provider: string;
    working_dir: string;
  };

  return {
    status: snake.status,
    service: snake.service,
    version: snake.version,
    bridgeMode: snake.bridge_mode,
    provider: snake.provider,
    workingDir: snake.working_dir,
  };
}

function normalizeSourcePreview(payload: unknown): SourcePreview {
  if (
    payload &&
    typeof payload === "object" &&
    "sourceId" in payload &&
    "highlightedExcerpt" in payload
  ) {
    return payload as SourcePreview;
  }

  const snake = payload as {
    source_id: string;
    title: string;
    domain: string;
    modality: SourcePreview["modality"];
    collection: string;
    parser: string;
    page_label: string;
    summary: string;
    highlighted_excerpt: string;
    surrounding_context: string[];
  };

  return {
    sourceId: snake.source_id,
    title: snake.title,
    domain: snake.domain,
    modality: snake.modality,
    collection: snake.collection,
    parser: snake.parser,
    pageLabel: snake.page_label,
    summary: snake.summary,
    highlightedExcerpt: snake.highlighted_excerpt,
    surroundingContext: snake.surrounding_context,
  };
}

function normalizeSettings(payload: unknown): DashboardSettings {
  if (
    payload &&
    typeof payload === "object" &&
    "bridgeMode" in payload &&
    "envControlled" in payload
  ) {
    return payload as DashboardSettings;
  }

  const snake = payload as {
    bridge_mode: DashboardSettings["bridgeMode"];
    provider: string;
    parser: string;
    parse_method: string;
    working_dir: string;
    output_dir: string;
    upload_dir: string;
    llm_model: string;
    vision_model: string;
    embedding_model: string;
    embedding_dim: number;
    env_controlled: boolean;
    providers: Array<{
      id: string;
      label: string;
      status: DashboardSettings["providers"][number]["status"];
      detail: string;
      llm_models: string[];
      embedding_models: string[];
    }>;
    parsers: DashboardSettings["parsers"];
    rag_improvements?: {
      hyde_enabled: boolean;
      multi_query_enabled: boolean;
      query_decomposition_enabled: boolean;
      adaptive_routing_enabled: boolean;
      keyword_extraction_enabled: boolean;
      reranker_enabled: boolean;
      response_type: string;
      contextual_retrieval_enabled?: boolean;
      retrieval_grader_enabled?: boolean;
      context_compression_enabled?: boolean;
      grounding_verification_enabled?: boolean;
      semantic_cache_enabled?: boolean;
    };
  };

  const ri = snake.rag_improvements;
  return {
    bridgeMode: snake.bridge_mode,
    provider: snake.provider,
    parser: snake.parser,
    parseMethod: snake.parse_method,
    workingDir: snake.working_dir,
    outputDir: snake.output_dir,
    uploadDir: snake.upload_dir,
    llmModel: snake.llm_model,
    visionModel: snake.vision_model,
    embeddingModel: snake.embedding_model,
    embeddingDim: snake.embedding_dim,
    envControlled: snake.env_controlled,
    providers: snake.providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      status: provider.status,
      detail: provider.detail,
      llmModels: provider.llm_models,
      embeddingModels: provider.embedding_models,
    })),
    parsers: snake.parsers,
    ragImprovements: ri
      ? {
          hydeEnabled: ri.hyde_enabled,
          multiQueryEnabled: ri.multi_query_enabled,
          queryDecompositionEnabled: ri.query_decomposition_enabled,
          adaptiveRoutingEnabled: ri.adaptive_routing_enabled,
          keywordExtractionEnabled: ri.keyword_extraction_enabled,
          rerankerEnabled: ri.reranker_enabled,
          responseType: ri.response_type,
          contextualRetrievalEnabled: ri.contextual_retrieval_enabled ?? false,
          retrievalGraderEnabled: ri.retrieval_grader_enabled ?? false,
          contextCompressionEnabled: ri.context_compression_enabled ?? false,
          groundingVerificationEnabled: ri.grounding_verification_enabled ?? false,
          semanticCacheEnabled: ri.semantic_cache_enabled ?? false,
        }
      : {
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

function normalizeConnectionValidation(
  payload: unknown,
): ConnectionValidationResult {
  if (
    payload &&
    typeof payload === "object" &&
    "checkedAt" in payload &&
    "message" in payload
  ) {
    return payload as ConnectionValidationResult;
  }

  const snake = payload as {
    success: boolean;
    provider: string;
    message: string;
    checked_at: string;
  };

  return {
    success: snake.success,
    provider: snake.provider,
    message: snake.message,
    checkedAt: snake.checked_at,
  };
}

function normalizeBenchmarkAnswer(
  payload: unknown,
): DashboardEvaluation["plainLlm"] {
  if (
    payload &&
    typeof payload === "object" &&
    "latencySeconds" in payload &&
    "matchedExpected" in payload
  ) {
    return payload as DashboardEvaluation["plainLlm"];
  }

  const snake = payload as {
    answer: string;
    latency_seconds: number;
    verdict: DashboardEvaluation["plainLlm"]["verdict"];
    matched_expected: string[];
    missing_expected: string[];
  };

  return {
    answer: snake.answer,
    latencySeconds: snake.latency_seconds,
    verdict: snake.verdict,
    matchedExpected: snake.matched_expected,
    missingExpected: snake.missing_expected,
  };
}

function normalizeEvaluation(payload: unknown): DashboardEvaluation {
  if (
    payload &&
    typeof payload === "object" &&
    "benchmarkName" in payload &&
    "plainLlm" in payload
  ) {
    return payload as DashboardEvaluation;
  }

  const snake = payload as {
    bridge_mode: DashboardEvaluation["bridgeMode"];
    benchmark_name: string;
    source_artifact: string;
    question: string;
    model: string;
    embedding_model: string;
    document_excerpt: string;
    expected_facts: Record<string, string>;
    metrics: DashboardEvaluation["metrics"];
    plain_llm: unknown;
    rag: unknown;
    recommendations: DashboardEvaluation["recommendations"];
  };

  return {
    bridgeMode: snake.bridge_mode,
    benchmarkName: snake.benchmark_name,
    sourceArtifact: snake.source_artifact,
    question: snake.question,
    model: snake.model,
    embeddingModel: snake.embedding_model,
    documentExcerpt: snake.document_excerpt,
    expectedFacts: snake.expected_facts,
    metrics: snake.metrics,
    plainLlm: normalizeBenchmarkAnswer(snake.plain_llm),
    rag: normalizeBenchmarkAnswer(snake.rag),
    recommendations: snake.recommendations,
  };
}

function normalizePlaybook(payload: unknown): DashboardPlaybook {
  if (
    payload &&
    typeof payload === "object" &&
    "sourceProduct" in payload &&
    "runtimeFit" in payload
  ) {
    return payload as DashboardPlaybook;
  }

  const snake = payload as {
    id: string;
    title: string;
    source_product: string;
    summary: string;
    query: string;
    mode: DashboardPlaybook["mode"];
    capabilities: string[];
    runtime_fit: DashboardPlaybook["runtimeFit"];
    action_label: string;
  };

  return {
    id: snake.id,
    title: snake.title,
    sourceProduct: snake.source_product,
    summary: snake.summary,
    query: snake.query,
    mode: snake.mode,
    capabilities: snake.capabilities,
    runtimeFit: snake.runtime_fit,
    actionLabel: snake.action_label,
  };
}

function normalizeObservability(payload: unknown): DashboardObservability {
  if (
    payload &&
    typeof payload === "object" &&
    "benchmarkStatus" in payload &&
    "workingDir" in payload
  ) {
    return payload as DashboardObservability;
  }

  const snake = payload as {
    bridge_mode: DashboardObservability["bridgeMode"];
    provider: string;
    parser: string;
    working_dir: string;
    benchmark_status: string;
    benchmark_source_artifact: string;
    metrics: DashboardObservability["metrics"];
    notes: string[];
    timeline: DashboardObservability["timeline"];
  };

  return {
    bridgeMode: snake.bridge_mode,
    provider: snake.provider,
    parser: snake.parser,
    workingDir: snake.working_dir,
    benchmarkStatus: snake.benchmark_status,
    benchmarkSourceArtifact: snake.benchmark_source_artifact,
    metrics: snake.metrics,
    notes: snake.notes,
    timeline: snake.timeline,
  };
}

export async function getDashboardHealth(): Promise<DashboardHealth> {
  const health = await safeJson(
    "/health",
    { method: "GET" },
    () =>
      ({
        status: "ok",
        service: "multi-model-rag-dashboard-api",
        version: "dev",
        bridgeMode: "mock",
        provider: "openai",
        workingDir: "./rag_storage",
      }) satisfies DashboardHealth,
  );
  return normalizeHealth(health);
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const overview = await safeJson("/api/dashboard/overview", { method: "GET" }, () =>
    getMockOverview(),
  );
  return normalizeOverview(overview);
}

export async function getDashboardCollections(): Promise<CollectionSummary[]> {
  return safeJson("/api/dashboard/collections", { method: "GET" }, () =>
    getMockCollections(),
  );
}

export async function runDashboardQuery(
  request: QueryRequest,
): Promise<QueryResult> {
  const result = await strictJson(
    "/api/dashboard/query",
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
  return normalizeQueryResult(result);
}

export async function uploadDashboardFiles(
  files: File[],
): Promise<UploadItem[]> {
  if (files.length === 0) {
    return [];
  }

  try {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const response = await fetch(`${API_BASE_URL}/api/dashboard/uploads`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return (await response.json()) as UploadItem[];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Dashboard upload failed.");
  }
}

export async function getDashboardUploadTimeline(
  upload: UploadItem,
): Promise<TimelineEvent[]> {
  return safeJson(
    `/api/dashboard/uploads/${encodeURIComponent(upload.id)}/timeline`,
    { method: "GET" },
    () => createMockUploadTimeline(upload),
  );
}

export async function getDashboardSourcePreview(
  source: CitationSource,
): Promise<SourcePreview> {
  const preview = await safeJson(
    `/api/dashboard/sources/${encodeURIComponent(source.id)}/preview`,
    { method: "GET" },
    () => createMockSourcePreview(source),
  );
  return normalizeSourcePreview(preview);
}

export async function getDashboardSettings(): Promise<DashboardSettings> {
  const settings = await safeJson("/api/dashboard/settings", { method: "GET" }, () =>
    getMockDashboardSettings(),
  );
  return normalizeSettings(settings);
}

export async function validateDashboardSettingsConnection(): Promise<ConnectionValidationResult> {
  const result = await safeJson(
    "/api/dashboard/settings/validate-connection",
    { method: "POST" },
    () => getMockConnectionValidation(),
  );
  return normalizeConnectionValidation(result);
}

export async function getDashboardEvaluation(): Promise<DashboardEvaluation> {
  const evaluation = await safeJson(
    "/api/dashboard/evaluation",
    { method: "GET" },
    () => getMockDashboardEvaluation(),
  );
  return normalizeEvaluation(evaluation);
}

export async function runDashboardEvaluationBenchmark(): Promise<DashboardEvaluation> {
  const evaluation = await safeJson(
    "/api/dashboard/evaluation/run",
    { method: "POST" },
    () => getMockDashboardEvaluation(),
  );
  return normalizeEvaluation(evaluation);
}

export async function getDashboardPlaybooks(): Promise<DashboardPlaybook[]> {
  const playbooks = await safeJson(
    "/api/dashboard/playbooks",
    { method: "GET" },
    () => getMockDashboardPlaybooks(),
  );
  return playbooks.map((playbook) => normalizePlaybook(playbook));
}

export async function getDashboardObservability(): Promise<DashboardObservability> {
  const observability = await safeJson(
    "/api/dashboard/observability",
    { method: "GET" },
    () => getMockDashboardObservability(),
  );
  return normalizeObservability(observability);
}

export async function deleteUploadItem(uploadId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/uploads/${encodeURIComponent(uploadId)}`,
    { method: "DELETE", cache: "no-store" },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(await parseErrorMessage(response));
  }
}
