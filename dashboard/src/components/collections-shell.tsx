"use client";

import { Database, Layers3, LibraryBig } from "lucide-react";

import { DashboardFrame } from "@/components/dashboard-frame";
import { MetricCard, SectionHeader } from "@/components/dashboard-primitives";
import { UploadPanel } from "@/components/upload-panel";
import { useDashboardData } from "@/lib/use-dashboard-data";

export function CollectionsShell() {
  const {
    overview,
    health,
    collections,
    uploads,
    handleUpload,
    handleRecentQuerySelect,
  } = useDashboardData();

  const totalDocuments = collections.reduce((sum, item) => sum + item.documents, 0);

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
              eyebrow="Collections"
              title="Stable workspaces for each research domain"
              detail="Collections turn the corpus into named work areas, so retrieval feels grounded in a persistent context instead of a one-off prompt."
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              <Database className="h-3.5 w-3.5 text-[var(--accent)]" />
              {totalDocuments} tracked documents
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Collections"
              value={`${collections.length}`}
              detail="Each workspace keeps its own focus area, evidence density, and retrieval posture."
            />
            <MetricCard
              label="Tracked documents"
              value={`${totalDocuments}`}
              detail="Documents currently represented across the active workspace catalog."
            />
            <MetricCard
              label="Bridge mode"
              value={health.bridgeMode === "live" ? "Live" : "Mock"}
              detail={`Provider: ${health.provider}`}
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
          <section className="glass-panel rounded-[32px] p-5 sm:p-7">
            <SectionHeader
              eyebrow="Collection catalog"
              title="Active retrieval domains"
              detail="Each collection behaves like a durable product surface with enough context to understand what lives there and why."
            />

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {collections.map((item) => (
                <article
                  key={item.id}
                  className="surface-card rounded-[28px] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">{item.name}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        {item.focus}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] p-3 text-[var(--accent)]">
                      <LibraryBig className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                      <p className="eyebrow">Documents</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                        {item.documents}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                      <p className="eyebrow">Embeddings</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                        {item.embeddings}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--panel-muted)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-600"
                      style={{ width: `${Math.round((item.documents / totalDocuments) * 100)}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <UploadPanel uploads={uploads} onUpload={handleUpload} />

            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Operating notes"
                title="How collections should feel"
                detail="The workspace is shaped to look like a product teams would actually use every day: structured, calm, and grounded in the corpus."
              />

              <div className="mt-5 space-y-3">
                {[
                  "Keep each collection legible at a glance so teams understand the corpus before they ask a question.",
                  "Use uploads and parser context as part of the workspace story, not as a hidden backend side effect.",
                  "Leave room for future collection-level settings such as defaults, retention, and citation policies.",
                ].map((item) => (
                  <div
                    key={item}
                    className="surface-card rounded-2xl p-4 text-sm leading-6 text-[var(--text-primary)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] p-2 text-[var(--accent-cyan)]">
                        <Layers3 className="h-4 w-4" />
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
