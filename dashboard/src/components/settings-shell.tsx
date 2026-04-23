"use client";

import clsx from "clsx";
import {
  BadgeCheck,
  BrainCircuit,
  FolderCog,
  Gauge,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";

import { DashboardFrame } from "@/components/dashboard-frame";
import { MetricCard, SectionHeader } from "@/components/dashboard-primitives";
import {
  getDashboardSettings,
  validateDashboardSettingsConnection,
} from "@/lib/api";
import { useDashboardData } from "@/lib/use-dashboard-data";
import type {
  ConnectionValidationResult,
  DashboardSettings,
} from "@/lib/types";

export function SettingsShell() {
  const {
    overview,
    health,
    collections,
    handleRecentQuerySelect,
  } = useDashboardData();
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [validation, setValidation] = useState<ConnectionValidationResult | null>(
    null,
  );
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const nextSettings = await getDashboardSettings();
      if (!cancelled) {
        setSettings(nextSettings);
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleValidate() {
    setIsValidating(true);
    try {
      const result = await validateDashboardSettingsConnection();
      setValidation(result);
    } finally {
      setIsValidating(false);
    }
  }

  if (!settings) {
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
      <main className="space-y-6">
        <section className="glass-panel rounded-[32px] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeader
              eyebrow="Runtime settings"
              title="Provider, parser, and storage posture"
              detail="This page borrows the strongest RAG product pattern from tools like Dify and AnythingLLM: make the active runtime configuration visible, testable, and easy to reason about."
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                <Gauge className="h-3.5 w-3.5 text-[var(--accent)]" />
                {settings.bridgeMode === "live" ? "Live runtime" : "Mock runtime"}
              </div>
              <button
                type="button"
                onClick={() => void handleValidate()}
                disabled={isValidating}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[rgba(91,124,246,0.85)] disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                {isValidating ? "Validating..." : "Validate current runtime"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Provider"
              value={settings.provider}
              detail="The active LLM provider exposed through the dashboard bridge."
            />
            <MetricCard
              label="Parser"
              value={settings.parser}
              detail="Default parser selection for new dashboard-managed uploads."
            />
            <MetricCard
              label="Embedding model"
              value={settings.embeddingModel}
              detail={`${settings.embeddingDim}-dimension vector profile.`}
            />
            <MetricCard
              label="Config source"
              value={settings.envControlled ? "Environment" : "Dashboard"}
              detail="Current runtime settings are shown exactly as the bridge sees them."
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <section className="glass-panel rounded-[32px] p-5 sm:p-7">
            <SectionHeader
              eyebrow="Provider registry"
              title="Available model backends"
              detail="This registry turns env-backed configuration into a readable product surface with model availability and provider posture."
            />

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {settings.providers.map((provider) => (
                <article
                  key={provider.id}
                  className="surface-card rounded-[28px] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--text-primary)]">
                        {provider.label}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        {provider.detail}
                      </p>
                    </div>
                    <div
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        provider.status === "configured" &&
                          "bg-[rgba(16,185,129,0.1)] text-[var(--accent-green)]",
                        provider.status === "available" &&
                          "bg-[var(--accent-dim)] text-[var(--accent)]",
                        provider.status === "standby" &&
                          "bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
                      )}
                    >
                      {provider.status}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                      <p className="eyebrow">LLM models</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {provider.llmModels.map((model) => (
                          <span
                            key={model}
                            className="rounded-full border border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] px-3 py-1 text-xs text-[var(--accent)]"
                          >
                            {model}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                      <p className="eyebrow">Embedding models</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {provider.embeddingModels.map((model) => (
                          <span
                            key={model}
                            className="rounded-full border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] px-3 py-1 text-xs text-[var(--accent-cyan)]"
                          >
                            {model}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Current runtime"
                title="Bridge defaults"
                detail="The active runtime, parser, and storage configuration that the dashboard is reading from right now."
              />

              <div className="mt-5 space-y-3">
                {[
                  {
                    icon: BrainCircuit,
                    label: "Model stack",
                    value: `${settings.llmModel} • ${settings.visionModel}`,
                  },
                  {
                    icon: SlidersHorizontal,
                    label: "Parse policy",
                    value: `${settings.parser} • ${settings.parseMethod}`,
                  },
                  {
                    icon: FolderCog,
                    label: "Storage",
                    value: settings.workingDir,
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="surface-card rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] p-2 text-[var(--accent)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

              <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="RAG Improvements"
                title="Active enhancement suite"
                detail="2025-generation RAG features that run transparently on every query. Toggle individual features per-query in the composer."
              />

              {settings.ragImprovements ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(
                    [
                      {
                        label: "HyDE",
                        enabled: settings.ragImprovements.hydeEnabled,
                        detail: "Hypothetical document embedding",
                      },
                      {
                        label: "Multi-query",
                        enabled: settings.ragImprovements.multiQueryEnabled,
                        detail: "Variant expansion for recall",
                      },
                      {
                        label: "Decomposition",
                        enabled: settings.ragImprovements.queryDecompositionEnabled,
                        detail: "Sub-query synthesis",
                      },
                      {
                        label: "Auto-route",
                        enabled: settings.ragImprovements.adaptiveRoutingEnabled,
                        detail: "Semantic mode selection",
                      },
                      {
                        label: "Keywords",
                        enabled: settings.ragImprovements.keywordExtractionEnabled,
                        detail: "HL/LL graph extraction",
                      },
                      {
                        label: "Reranker",
                        enabled: settings.ragImprovements.rerankerEnabled,
                        detail: "FlagEmbedding cross-encoder",
                      },
                      {
                        label: "Contextual Retrieval",
                        enabled: settings.ragImprovements.contextualRetrievalEnabled,
                        detail: "Anthropic chunk enrichment (-49% miss)",
                      },
                      {
                        label: "CRAG Grader",
                        enabled: settings.ragImprovements.retrievalGraderEnabled,
                        detail: "Self-reflective retrieval quality check",
                      },
                      {
                        label: "Compression",
                        enabled: settings.ragImprovements.contextCompressionEnabled,
                        detail: "Relevant-sentence LLM filter",
                      },
                      {
                        label: "Grounding",
                        enabled: settings.ragImprovements.groundingVerificationEnabled,
                        detail: "Post-gen hallucination audit",
                      },
                      {
                        label: "Semantic Cache",
                        enabled: settings.ragImprovements.semanticCacheEnabled,
                        detail: "Query→answer LRU + embedding lookup",
                      },
                    ] as { label: string; enabled: boolean; detail: string }[]
                  ).map(({ label, enabled, detail }) => (
                    <div
                      key={label}
                      className={clsx(
                        "rounded-[18px] border px-4 py-3",
                        enabled
                          ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "h-2 w-2 rounded-full",
                            enabled ? "bg-emerald-500" : "bg-[var(--text-muted)]",
                          )}
                        />
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                  Loading improvement status…
                </p>
              )}

              {settings.ragImprovements && (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Response format:{" "}
                  <strong>{settings.ragImprovements.responseType}</strong>
                </p>
              )}
            </section>

            <section className="glass-panel rounded-[28px] p-5">
              <SectionHeader
                eyebrow="Validation"
                title="Configuration check"
                detail="Useful for quickly confirming whether the current bridge is configured well enough for the chosen provider."
              />

              <div className="mt-5 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <BadgeCheck className="h-4 w-4 text-emerald-600" />
                  {validation?.provider ?? settings.provider}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {validation?.message ??
                    "Run validation to confirm the active runtime configuration is coherent."}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {validation?.checkedAt
                    ? `Checked ${validation.checkedAt}`
                    : settings.envControlled
                      ? "This runtime is currently environment-controlled."
                      : "Dashboard-managed settings mode."}
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </DashboardFrame>
  );
}
