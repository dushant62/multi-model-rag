"use client";

import { GitBranchPlus, Network, Orbit, Sigma } from "lucide-react";
import { useState } from "react";

import { DashboardFrame } from "@/components/dashboard-frame";
import { MetricCard, SectionHeader } from "@/components/dashboard-primitives";
import { SourceList } from "@/components/source-list";
import { SourceViewerModal } from "@/components/source-viewer-modal";
import { useDashboardData } from "@/lib/use-dashboard-data";
import type { CitationSource } from "@/lib/types";

export function KnowledgeGraphShell() {
  const [selectedSource, setSelectedSource] = useState<CitationSource | null>(null);
  const {
    overview,
    health,
    collections,
    result,
    handleRecentQuerySelect,
  } = useDashboardData();

  const estimatedNodes = collections.reduce((sum, item) => sum + item.documents * 6, 0);
  const estimatedEdges = result.sources.length * 14;
  const graphNodes = [
    { id: "query", label: result.query, x: 50, y: 50, tone: "core" as const },
    ...collections.slice(0, 3).map((item, index) => ({
      id: item.id,
      label: item.name,
      x: [18, 50, 82][index] ?? 50,
      y: 18,
      tone: "collection" as const,
    })),
    ...result.sources.slice(0, 3).map((source, index) => ({
      id: source.id,
      label: source.title,
      x: [22, 50, 78][index] ?? 50,
      y: 82,
      tone: "source" as const,
    })),
  ];
  const centerNode = graphNodes[0];
  const edgeTargets = graphNodes.slice(1);

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
              eyebrow="Knowledge graph"
              title="Cross-modal relationship surface"
              detail="Turn sources, collections, and answer context into a navigable relationship view instead of hiding the graph behind the answer."
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-3 py-1 text-xs text-[var(--accent-amber)]">
              <Orbit className="h-3.5 w-3.5" />
              Estimated view — live graph API coming soon
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Estimated nodes"
              value={`${estimatedNodes}`}
              detail="Approximate connected entities derived from corpus volume and multimodal density."
            />
            <MetricCard
              label="Estimated edges"
              value={`${estimatedEdges}`}
              detail="A working estimate of source, entity, and answer relationships."
            />
            <MetricCard
              label="Active evidence"
              value={`${result.sources.length}`}
              detail="Sources currently feeding the answer engine and the graph view."
            />
            <MetricCard
              label="Query context"
              value={result.mode}
              detail="The active answer context powering the graph-oriented reading mode."
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <section className="glass-panel rounded-[32px] p-5 sm:p-7">
            <SectionHeader
              eyebrow="Relationship map"
              title="Query, collections, and evidence in one frame"
              detail="This custom map borrows the clarity of graph tooling without turning the page into a developer-centric node editor."
            />

            <div className="mt-6 relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-6">
              <div className="grid-glow absolute inset-0 opacity-20" />
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                {edgeTargets.map((node) => (
                  <line
                    key={`edge-${node.id}`}
                    x1={centerNode.x}
                    y1={centerNode.y}
                    x2={node.x}
                    y2={node.y}
                    stroke="rgba(91,124,246,0.2)"
                    strokeWidth="0.9"
                    strokeDasharray={node.tone === "collection" ? "0" : "3 2"}
                  />
                ))}
              </svg>

              <div className="relative h-[420px]">
                {graphNodes.map((node) => (
                  <div
                    key={node.id}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                      node.tone === "core"
                        ? "border-[var(--border-accent)] bg-[var(--accent)] text-white"
                        : node.tone === "collection"
                          ? "border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] text-[var(--accent)]"
                          : "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] text-[var(--accent-green)]"
                    }`}
                    style={{ left: `${node.x}%`, top: `${node.y}%`, maxWidth: "14rem" }}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Evidence ledger"
                title="Sources feeding the map"
                detail="The graph stays grounded in the same citation objects shown in the answer workspace."
              />
              <div className="mt-5">
                <SourceList
                  sources={result.sources}
                  onSourceSelect={setSelectedSource}
                />
              </div>
            </section>

            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Relationship seeds"
                title="Suggested graph pivots"
                detail="Derived from the active answer and arranged as practical next hops."
              />
              <div className="mt-5 space-y-3">
                {result.sources.map((source, index) => (
                  <div
                    key={source.id}
                    className="surface-card rounded-2xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-[rgba(155,110,246,0.3)] bg-[rgba(155,110,246,0.1)] p-2 text-[var(--accent-purple)]">
                        {index % 2 === 0 ? (
                          <GitBranchPlus className="h-4 w-4" />
                        ) : (
                          <Sigma className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {source.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                          Pivot from {source.modality} evidence into related entities,
                          sections, and answer themes.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Reading posture"
                title="What this page is optimized for"
                detail="The graph route is meant to help teams scan connections without losing the calm tone of the rest of the workspace."
              />

              <div className="mt-5 space-y-3">
                {[
                  "Use the map as a reading aid first, with the heavy graph tooling arriving only when live graph APIs provide richer fidelity.",
                  "Keep node labels human-readable so the route feels like a research surface instead of a developer debugging panel.",
                  "Tie future click-through interactions back to chunk citations, parser traces, and collection context.",
                ].map((item) => (
                  <div
                    key={item}
                    className="surface-card rounded-2xl p-4 text-sm leading-6 text-[var(--text-primary)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] p-2 text-[var(--accent)]">
                        <Network className="h-4 w-4" />
                      </div>
                      <p>{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
        <SourceViewerModal
          source={selectedSource}
          onClose={() => setSelectedSource(null)}
        />
      </main>
    </DashboardFrame>
  );
}
