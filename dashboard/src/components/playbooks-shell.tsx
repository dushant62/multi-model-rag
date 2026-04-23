"use client";

import clsx from "clsx";
import {
  Activity,
  ArrowRight,
  Compass,
  Eye,
  Layers3,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";

import { DashboardFrame } from "@/components/dashboard-frame";
import { MetricCard, SectionHeader } from "@/components/dashboard-primitives";
import {
  getDashboardObservability,
  getDashboardPlaybooks,
} from "@/lib/api";
import { useDashboardData } from "@/lib/use-dashboard-data";
import type {
  DashboardObservability,
  DashboardPlaybook,
} from "@/lib/types";

function productBadgeClass(sourceProduct: string) {
  if (sourceProduct === "RAGFlow") {
    return "bg-[var(--accent-dim)] text-[var(--accent)]";
  }
  if (sourceProduct === "Dify") {
    return "bg-[rgba(155,110,246,0.1)] text-[var(--accent-purple)]";
  }
  if (sourceProduct === "Open WebUI") {
    return "bg-[rgba(16,185,129,0.1)] text-[var(--accent-green)]";
  }
  return "bg-[rgba(245,158,11,0.1)] text-[var(--accent-amber)]";
}

export function PlaybooksShell() {
  const {
    overview,
    health,
    collections,
    result,
    query,
    mode,
    isQuerying,
    setQuery,
    setMode,
    executeQuery,
    handleRecentQuerySelect,
  } = useDashboardData();
  const [playbooks, setPlaybooks] = useState<DashboardPlaybook[]>([]);
  const [observability, setObservability] =
    useState<DashboardObservability | null>(null);
  const [activePlaybookId, setActivePlaybookId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [nextPlaybooks, nextObservability] = await Promise.all([
        getDashboardPlaybooks(),
        getDashboardObservability(),
      ]);

      if (cancelled) {
        return;
      }

      setPlaybooks(nextPlaybooks);
      setObservability(nextObservability);
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runPlaybook(playbook: DashboardPlaybook) {
    setActivePlaybookId(playbook.id);
    setQuery(playbook.query);
    setMode(playbook.mode);

    try {
      await executeQuery(playbook.query, playbook.mode);
      const nextObservability = await getDashboardObservability();
      setObservability(nextObservability);
    } finally {
      setActivePlaybookId(null);
    }
  }

  if (!observability) {
    return null;
  }

  return (
    <DashboardFrame
      bridgeMode={health.bridgeMode}
      provider={health.provider}
      pulse={overview.systemPulse}
      recentQueries={overview.recentQueries}
      collections={collections}
      onRecentQuerySelect={handleRecentQuerySelect}
    >
      <main className="space-y-5">
        <section className="glass-panel rounded-[32px] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeader
              eyebrow="Integrated product patterns"
              title="Playbooks built from the cloned RAG platforms"
              detail="These presets turn the strongest ideas from RAGFlow, Dify, Open WebUI, and AnythingLLM into runnable workflows inside Multi-Model-RAG instead of leaving them as external references."
            />
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              <Workflow className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
              {playbooks.length} playbooks • {observability.provider} • {observability.parser}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {observability.metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <section className="space-y-6">
            <section className="glass-panel rounded-[32px] p-5 sm:p-7">
              <SectionHeader
                eyebrow="Workflow presets"
                title="Runnable playbooks"
                detail="Each preset is grounded in a real product pattern and executed through the same query path as the answer engine."
              />

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {playbooks.map((playbook) => (
                  <article key={playbook.id} className="surface-card rounded-[28px] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={clsx(
                              "rounded-full px-2.5 py-1 text-xs font-medium",
                              productBadgeClass(playbook.sourceProduct),
                            )}
                          >
                            {playbook.sourceProduct}
                          </span>
                          <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                            {playbook.mode}
                          </span>
                          <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                            {playbook.runtimeFit}
                          </span>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-[var(--text-primary)]">
                            {playbook.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {playbook.summary}
                          </p>
                        </div>
                      </div>
                      <Compass className="h-5 w-5 text-[var(--text-muted)]" />
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                      <p className="eyebrow">Preset query</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">
                        {playbook.query}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {playbook.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                        >
                          {capability}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => void runPlaybook(playbook)}
                      disabled={isQuerying || activePlaybookId === playbook.id}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[rgba(91,124,246,0.85)] disabled:opacity-60"
                    >
                      {activePlaybookId === playbook.id ? "Running..." : playbook.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-[32px] p-5 sm:p-7">
              <SectionHeader
                eyebrow="Workflow preview"
                title={query}
                detail={`${mode} output generated through the main answer engine, so playbooks stay native to the product instead of creating a separate orchestration silo.`}
              />

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {result.metrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    detail={metric.detail}
                  />
                ))}
              </div>

              <div className="mt-8 space-y-5">
                {result.answer.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="max-w-4xl text-base leading-8 text-[var(--text-primary)]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          </section>

          <section>
            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Runtime observability"
                title="Operator visibility"
                detail="This borrows directly from Dify's LLMOps posture and Open WebUI's production visibility: the runtime should be explainable while it is being used."
              />

              <div className="mt-5 space-y-5">
                <div className="surface-card rounded-[24px] p-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-[var(--accent)]" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Runtime posture
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    Bridge {observability.bridgeMode} • provider {observability.provider} • parser{" "}
                    {observability.parser}
                  </p>
                  <p className="mt-2 break-all text-xs text-[var(--text-muted)]">
                    {observability.workingDir}
                  </p>
                </div>

                <div className="surface-card rounded-[24px] p-4">
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-[var(--accent-purple)]" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Benchmark artifact
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                    Status: {observability.benchmarkStatus}
                  </p>
                  <p className="mt-2 break-all text-xs text-[var(--text-muted)]">
                    {observability.benchmarkSourceArtifact}
                  </p>
                </div>
                <div className="border-t border-[var(--border)] pt-5">
                  <p className="eyebrow">Operational notes</p>
                  <div className="mt-4 space-y-3">
                    {observability.notes.map((note) => (
                      <div key={note} className="surface-card rounded-[24px] p-4">
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-5">
                  <p className="eyebrow">Integration trace</p>
                  <div className="mt-4 space-y-4">
                    {observability.timeline.map((item, index) => (
                      <div key={`${item.stage}-${index}`} className="surface-card rounded-2xl p-4">
                        <div className="flex gap-3">
                          <div className="mt-0.5 flex flex-col items-center">
                            <span
                              className={clsx(
                                "h-3 w-3 rounded-full",
                                item.status === "done"
                                  ? "bg-emerald-500"
                                  : item.status === "active"
                                    ? "bg-[var(--accent)]"
                                    : item.status === "failed"
                                      ? "bg-[var(--accent-rose)]"
                                      : "bg-[var(--text-muted)]",
                              )}
                            />
                            {index < observability.timeline.length - 1 ? (
                              <span className="mt-2 h-full w-px bg-[var(--border)]" />
                            ) : null}
                          </div>
                          <div className="pb-1">
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-[var(--text-muted)]" />
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {item.stage}
                              </p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </section>
        </div>
      </main>
    </DashboardFrame>
  );
}
