export type SearchMode =
  | "Search"
  | "Deep Research"
  | "Multimodal"
  | "Collections";

export type SourceModality = "text" | "image" | "table" | "equation";

export type BridgeMode = "live" | "mock";

export interface InsightMetric {
  label: string;
  value: string;
  detail: string;
}

export interface RecentQuery {
  title: string;
  when: string;
  mode: SearchMode;
}

export interface CitationSource {
  id: string;
  title: string;
  domain: string;
  modality: SourceModality;
  snippet: string;
  relevance: number;
  freshness: string;
}

export interface TimelineEvent {
  stage: string;
  detail: string;
  status: "done" | "active" | "queued" | "failed";
}

export interface UploadItem {
  id: string;
  name: string;
  parser: string;
  pages: number;
  progress: number;
  status: "queued" | "processing" | "ready" | "failed";
}

export interface CollectionSummary {
  id: string;
  name: string;
  documents: number;
  embeddings: string;
  focus: string;
}

export interface QueryResult {
  query: string;
  mode: SearchMode;
  answer: string[];
  followUps: string[];
  metrics: InsightMetric[];
  sources: CitationSource[];
  timeline: TimelineEvent[];
}

export interface DashboardOverview {
  bridgeMode: BridgeMode;
  heroQuestion: string;
  systemPulse: string;
  suggestions: string[];
  recentQueries: RecentQuery[];
  collections: CollectionSummary[];
  uploads: UploadItem[];
  featuredResult: QueryResult;
}

export interface DashboardHealth {
  status: string;
  service: string;
  version: string;
  bridgeMode: BridgeMode;
  provider: string;
  workingDir: string;
}

export interface QueryImprovements {
  enableHyde?: boolean;
  enableMultiQuery?: boolean;
  enableDecomposition?: boolean;
  enableAdaptiveRouting?: boolean;
  responseType?: string;
}

export interface QueryRequest {
  query: string;
  mode: SearchMode;
  improvements?: QueryImprovements;
}

export interface RagImprovementStatus {
  hydeEnabled: boolean;
  multiQueryEnabled: boolean;
  queryDecompositionEnabled: boolean;
  adaptiveRoutingEnabled: boolean;
  keywordExtractionEnabled: boolean;
  rerankerEnabled: boolean;
  responseType: string;
  contextualRetrievalEnabled: boolean;
  retrievalGraderEnabled: boolean;
  contextCompressionEnabled: boolean;
  groundingVerificationEnabled: boolean;
  semanticCacheEnabled: boolean;
}

export interface SourcePreview {
  sourceId: string;
  title: string;
  domain: string;
  modality: SourceModality;
  collection: string;
  parser: string;
  pageLabel: string;
  summary: string;
  highlightedExcerpt: string;
  surroundingContext: string[];
}

export interface ProviderOption {
  id: string;
  label: string;
  status: "configured" | "available" | "standby";
  detail: string;
  llmModels: string[];
  embeddingModels: string[];
}

export interface ParserOption {
  id: string;
  label: string;
  detail: string;
}

export interface DashboardSettings {
  bridgeMode: BridgeMode;
  provider: string;
  parser: string;
  parseMethod: string;
  workingDir: string;
  outputDir: string;
  uploadDir: string;
  llmModel: string;
  visionModel: string;
  embeddingModel: string;
  embeddingDim: number;
  envControlled: boolean;
  providers: ProviderOption[];
  parsers: ParserOption[];
  ragImprovements: RagImprovementStatus;
}

export interface ConnectionValidationResult {
  success: boolean;
  provider: string;
  message: string;
  checkedAt: string;
}

export interface BenchmarkAnswer {
  answer: string;
  latencySeconds: number;
  verdict: "correct" | "partial" | "incorrect";
  matchedExpected: string[];
  missingExpected: string[];
}

export interface UpgradeRecommendation {
  title: string;
  priority: "high" | "medium" | "low";
  detail: string;
  impact: string;
}

export interface DashboardEvaluation {
  bridgeMode: BridgeMode;
  benchmarkName: string;
  sourceArtifact: string;
  question: string;
  model: string;
  embeddingModel: string;
  documentExcerpt: string;
  expectedFacts: Record<string, string>;
  metrics: InsightMetric[];
  plainLlm: BenchmarkAnswer;
  rag: BenchmarkAnswer;
  recommendations: UpgradeRecommendation[];
}

export interface DashboardPlaybook {
  id: string;
  title: string;
  sourceProduct: string;
  summary: string;
  query: string;
  mode: SearchMode;
  capabilities: string[];
  runtimeFit: "offline-first" | "hybrid" | "cloud";
  actionLabel: string;
}

export interface DashboardObservability {
  bridgeMode: BridgeMode;
  provider: string;
  parser: string;
  workingDir: string;
  benchmarkStatus: string;
  benchmarkSourceArtifact: string;
  metrics: InsightMetric[];
  notes: string[];
  timeline: TimelineEvent[];
}
