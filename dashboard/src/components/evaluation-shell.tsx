"use client";

import clsx from "clsx";
import { Activity, BrainCircuit, FlaskConical, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { DashboardFrame } from "@/components/dashboard-frame";
import { MetricCard, SectionHeader } from "@/components/dashboard-primitives";
import {
  getDashboardEvaluation,
  runDashboardEvaluationBenchmark,
} from "@/lib/api";
import { useDashboardData } from "@/lib/use-dashboard-data";
import type { DashboardEvaluation } from "@/lib/types";

function VerdictBadge({
  verdict,
}: {
  verdict: DashboardEvaluation["plainLlm"]["verdict"];
}) {
  return (
    <span
      className={clsx(
        "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        verdict === "correct" && "bg-[rgba(16,185,129,0.1)] text-[var(--accent-green)]",
        verdict === "partial" && "bg-[rgba(245,158,11,0.1)] text-[var(--accent-amber)]",
        verdict === "incorrect" && "bg-[rgba(244,63,94,0.08)] text-[var(--accent-rose)]",
      )}
    >
      {verdict}
    </span>
  );
}

export function EvaluationShell() {
  const {
    overview,
    health,
    collections,
    handleRecentQuerySelect,
  } = useDashboardData();
  const [evaluation, setEvaluation] = useState<DashboardEvaluation | null>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      const nextEvaluation = await getDashboardEvaluation();
      if (!cancelled) {
        setEvaluation(nextEvaluation);
      }
    }

    void loadEvaluation();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRunBenchmark() {
    setIsRunningBenchmark(true);
    try {
      const nextEvaluation = await runDashboardEvaluationBenchmark();
      setEvaluation(nextEvaluation);
    } finally {
      setIsRunningBenchmark(false);
    }
  }

  if (!evaluation) {
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
              eyebrow="Evaluation lab"
              title="Proof that grounding beats guesswork"
              detail="This page translates real benchmark artifacts into a stakeholder-ready product surface: quality gain, latency cost, answer comparison, and the engineering work that most directly improves the next result."
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                <FlaskConical className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
                {evaluation.model} • {evaluation.embeddingModel}
              </div>
              <button
                type="button"
                onClick={() => void handleRunBenchmark()}
                disabled={isRunningBenchmark}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[rgba(91,124,246,0.85)] disabled:opacity-60"
              >
                <Activity className="h-4 w-4" />
                {isRunningBenchmark ? "Running benchmark..." : "Run fresh benchmark"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {evaluation.metrics.map((metric) => (
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
          <section className="space-y-5">
            <section className="glass-panel rounded-[32px] p-5 sm:p-7">
              <SectionHeader
                eyebrow="Benchmark prompt"
                title={evaluation.question}
                detail={`Artifact source: ${evaluation.sourceArtifact}`}
              />

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {[
                  {
                    label: "Plain LLM",
                    icon: BrainCircuit,
                    accent: "text-[var(--text-secondary)]",
                    answer: evaluation.plainLlm,
                  },
                  {
                    label: "RAG pipeline",
                    icon: Sparkles,
                    accent: "text-[var(--accent)]",
                    answer: evaluation.rag,
                  },
                ].map(({ label, icon: Icon, accent, answer }) => (
                  <article key={label} className="surface-card rounded-[28px] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2">
                          <Icon className={clsx("h-4 w-4", accent)} />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-[var(--text-primary)]">{label}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            {answer.latencySeconds.toFixed(3)}s
                          </p>
                        </div>
                      </div>
                      <VerdictBadge verdict={answer.verdict} />
                    </div>

                    <p className="mt-4 text-sm leading-7 text-[var(--text-primary)]">{answer.answer}</p>

                    <div className="mt-5 space-y-3">
                      <div className="rounded-2xl border border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] p-4">
                        <p className="eyebrow">Matched expected facts</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {answer.matchedExpected.length > 0 ? (
                            answer.matchedExpected.map((fact) => (
                              <span
                                key={fact}
                                className="rounded-full bg-[rgba(16,185,129,0.1)] px-3 py-1 text-xs text-[var(--accent-green)]"
                              >
                                {fact}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-[var(--text-secondary)]">No benchmark facts recovered.</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] p-4">
                        <p className="eyebrow">Missing expected facts</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {answer.missingExpected.length > 0 ? (
                            answer.missingExpected.map((fact) => (
                              <span
                                key={fact}
                                className="rounded-full bg-[rgba(244,63,94,0.08)] px-3 py-1 text-xs text-[var(--accent-rose)]"
                              >
                                {fact}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-[var(--text-secondary)]">Nothing missing on this benchmark.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-[32px] p-5 sm:p-7">
              <SectionHeader
                eyebrow="Injected benchmark context"
                title="Document excerpt"
                detail="The benchmark remains inspectable by keeping the injected evidence visible underneath the result comparison."
              />
              <div className="surface-card mt-6 rounded-[28px] p-5">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--accent-purple)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Injected document excerpt</p>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--text-primary)]">
                  {evaluation.documentExcerpt}
                </p>
              </div>
            </section>
          </section>

          <section>
            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Benchmark brief"
                title="Expected facts and next engineering moves"
                detail="The right rail now combines the benchmark target, artifact provenance, and resulting recommendations in one place."
              />

              <div className="mt-5 space-y-5">
                <div>
                  <p className="eyebrow">Expected facts</p>
                  <div className="mt-4 space-y-3">
                    {Object.entries(evaluation.expectedFacts).map(([key, value]) => (
                      <div key={key} className="surface-card rounded-[24px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{key}</p>
                        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-5">
                  <p className="eyebrow">Engineering moves</p>
                  <div className="mt-4 space-y-3">
                    {evaluation.recommendations.map((item) => (
                      <article key={item.title} className="surface-card rounded-[24px] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                          <span
                            className={clsx(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
                              item.priority === "high" && "bg-[rgba(244,63,94,0.08)] text-[var(--accent-rose)]",
                              item.priority === "medium" && "bg-[rgba(245,158,11,0.1)] text-[var(--accent-amber)]",
                              item.priority === "low" && "bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
                            )}
                          >
                            {item.priority}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{item.detail}</p>
                        <div className="mt-4 rounded-2xl border border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Impact</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{item.impact}</p>
                        </div>
                      </article>
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
