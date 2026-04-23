"use client";

import { Cpu, LoaderCircle, Radar, ScanSearch } from "lucide-react";

import { DashboardFrame } from "@/components/dashboard-frame";
import { MetricCard, SectionHeader } from "@/components/dashboard-primitives";
import { UploadPanel } from "@/components/upload-panel";
import { useDashboardData } from "@/lib/use-dashboard-data";

const parserCatalog = [
  {
    name: "Docling",
    specialty: "Layout-aware extraction for dense reports and board decks.",
    bestFor: "PDFs, presentations, structured business docs",
  },
  {
    name: "MinerU",
    specialty: "Strong multimodal recovery across mixed academic and scanned material.",
    bestFor: "Research papers, multimodal notes, complex figures",
  },
  {
    name: "PaddleOCR",
    specialty: "OCR-heavy intake for forms, tables, and scanned operational files.",
    bestFor: "Scans, screenshots, image-first documents",
  },
] as const;

export function ParserFleetShell() {
  const {
    overview,
    health,
    collections,
    uploads,
    lastError,
    handleUpload,
    handleDeleteUpload,
    handleRecentQuerySelect,
  } = useDashboardData();

  const ready = uploads.filter((item) => item.status === "ready").length;
  const processing = uploads.filter((item) => item.status === "processing").length;
  const failed = uploads.filter((item) => item.status === "failed").length;

  return (
    <DashboardFrame
      bridgeMode={health.bridgeMode}
      provider={health.provider}
      pulse={overview.systemPulse}
      recentQueries={overview.recentQueries}
      collections={collections}
      onRecentQuerySelect={handleRecentQuerySelect}
    >
      <main className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeader
              eyebrow="Ingestion pipeline"
              title="Document intake, parser routing, and queue operations"
              detail="This is the main upload surface for the product. Treat ingestion like a visible engine: what is entering, which parser is handling it, and what is ready for retrieval."
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              <Radar className="h-3.5 w-3.5 text-[var(--accent)]" />
              Provider {health.provider}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Ready uploads"
              value={`${ready}`}
              detail="Documents that are indexed and available for citation-backed answers."
            />
            <MetricCard
              label="Processing"
              value={`${processing}`}
              detail="Files currently moving through extraction, chunking, or indexing."
            />
            <MetricCard
              label="Failures"
              value={`${failed}`}
              detail="Items that need operator attention, a retry, or a parser switch."
            />
            <MetricCard
              label="Runtime"
              value={health.bridgeMode === "live" ? "Live" : "Mock"}
              detail={health.workingDir}
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
          <section className="glass-panel rounded-[32px] p-5 sm:p-7">
            <SectionHeader
              eyebrow="Fleet view"
              title="Built-in parser lineup"
              detail="Each parser is framed as an explicit route with a clear role in the ingestion workflow."
            />

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {parserCatalog.map((parser) => {
                const active = uploads.some(
                  (item) => item.parser.toLowerCase() === parser.name.toLowerCase(),
                );

                return (
                  <article
                    key={parser.name}
                    className="surface-card rounded-[28px] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[var(--text-primary)]">
                          {parser.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                          {parser.specialty}
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">
                          Best for
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-primary)]">
                          {parser.bestFor}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                          {active
                            ? "Currently represented in the ingestion queue."
                            : "Available for the next incoming batch."}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] p-3 text-[var(--accent)]">
                        <Cpu className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          active ? "bg-emerald-500" : "bg-[var(--text-muted)]"
                        }`}
                      />
                      {active ? "Active in queue" : "Standby"}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 surface-card rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Queue activity"
                title="Current ingest lane"
                detail="Keep the active queue readable so long-running document work feels operational, not opaque."
              />

              <div className="mt-5 space-y-3">
                {uploads.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {item.parser} • {item.pages} pages
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-panel)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                        {item.status === "processing" ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {item.status}
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--panel-muted)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-600"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <UploadPanel
              uploads={uploads}
              errorMessage={lastError}
              bridgeMode={health.bridgeMode}
              onUpload={handleUpload}
              onDelete={handleDeleteUpload}
            />

            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Routing guidance"
                title="How uploads move through the engine"
                detail="The frontend now follows the real backend architecture more closely: upload first, parser selection second, then indexing and retrieval readiness."
              />

              <div className="mt-5 space-y-3">
                {[
                  "Start with Docling for well-structured decks and reports where layout fidelity matters.",
                  "Switch to MinerU when mixed figures, tables, and academic-style pages need better multimodal recovery.",
                  "Use PaddleOCR when the corpus is scan-heavy and text needs to be recovered before retrieval quality improves.",
                ].map((item) => (
                  <div
                    key={item}
                    className="surface-card rounded-2xl p-4 text-sm leading-6 text-[var(--text-primary)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] p-2 text-[var(--accent-green)]">
                        <ScanSearch className="h-4 w-4" />
                      </div>
                      <p>{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </DashboardFrame>
  );
}
