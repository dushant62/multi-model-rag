"use client";

import clsx from "clsx";
import { ArrowRight, Clock3 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DashboardFrame } from "@/components/dashboard-frame";
import { QueryComposer } from "@/components/query-composer";
import { SourceList } from "@/components/source-list";
import { SourceViewerModal } from "@/components/source-viewer-modal";
import { useDashboardData } from "@/lib/use-dashboard-data";
import type { CitationSource, SearchMode } from "@/lib/types";

const MODES: SearchMode[] = ["Search", "Deep Research", "Multimodal", "Collections"];

export function DashboardShell() {
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<CitationSource | null>(null);

  const {
    overview,
    health,
    collections,
    result,
    uploads,
    query,
    mode,
    isBooting,
    isQuerying,
    lastError,
    setQuery,
    setMode,
    executeQuery,
    handleSubmit,
    handleRecentQuerySelect,
    improvementOptions,
    setImprovementOptions,
  } = useDashboardData();

  useEffect(() => {
    if (isBooting) return;
    const q = searchParams.get("q");
    if (!q) return;
    const m = searchParams.get("mode");
    const next = (MODES.includes(m as SearchMode) ? m : "Search") as SearchMode;
    const token = `${q}::${next}`;
    if (handledDeepLinkRef.current === token) return;
    handledDeepLinkRef.current = token;
    setQuery(q);
    setMode(next);
    void executeQuery(q, next);
  }, [executeQuery, isBooting, searchParams, setMode, setQuery]);

  return (
    <DashboardFrame
      bridgeMode={health.bridgeMode}
      provider={health.provider}
      pulse={overview.systemPulse}
      recentQueries={overview.recentQueries}
      collections={collections}
      onRecentQuerySelect={handleRecentQuerySelect}
    >
      <main className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 lg:py-14">
        {/* ── Editorial Hero ───────────────────────────────────── */}
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="index-number">§ 01 · Dispatch</span>
              <span className="helix-rule flex-1 h-0" />
            </div>

            <h2 className="display-title mt-5">
              Query the <em>corpus</em>,<br />
              cite the archive.
            </h2>

            <p className="display-kicker mt-5 max-w-[46ch]">
              Helix is a multimodal reading room — every answer arrives with its
              margins, its footnotes, its provenance. Ask a question; we&rsquo;ll return
              the reasoning behind it.
            </p>

            {lastError && (
              <div className="mt-6 rounded-md border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3 py-2 text-[0.8rem] text-[var(--accent-rose)]">
                {lastError}
              </div>
            )}

            <div className="mt-7">
              <QueryComposer
                mode={mode}
                query={query}
                isBusy={isQuerying}
                suggestions={overview.suggestions}
                improvementOptions={improvementOptions}
                onModeChange={setMode}
                onQueryChange={setQuery}
                onImprovementOptionsChange={setImprovementOptions}
                onSubmit={handleSubmit}
              />
            </div>
          </div>

          {/* Manifesto card */}
          <aside className="card-paper p-7 lg:mt-6 relative overflow-hidden">
            <p className="eyebrow" style={{ color: "var(--helix-saffron)" }}>Masthead</p>
            <p
              className="mt-3 leading-snug"
              style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", color: "var(--helix-ink)" }}
            >
              A quiet desk for<br />
              <em style={{ color: "var(--helix-saffron)" }}>unhurried retrieval.</em>
            </p>
            <p className="mt-4 text-[0.82rem] leading-6 text-[var(--text-secondary)]">
              Multi-Model RAG · a parser fleet, a graph cartographer, and a
              reranker editor-in-chief. Grounded in your documents. Nothing
              invented, everything cited.
            </p>
            <div className="mt-5 pt-4 border-t border-[rgba(255,179,71,0.18)] grid grid-cols-2 gap-3">
              <div>
                <p className="label-mono" style={{ color: "rgba(255,179,71,0.8)" }}>Edition</p>
                <p className="mt-1 mono text-[0.82rem] text-[var(--helix-ink)]">Vol. 01 · {health.version}</p>
              </div>
              <div>
                <p className="label-mono" style={{ color: "rgba(255,179,71,0.8)" }}>Desk</p>
                <p className="mt-1 mono text-[0.82rem] text-[var(--helix-ink)]">{health.provider}</p>
              </div>
            </div>
          </aside>
        </section>

        {/* ── Result ───────────────────────────────────────────── */}
        <section className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <article className="card-ink p-7">
            <div className="flex items-start justify-between gap-3 pb-5 helix-rule">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="index-number">§ 02 · Answer</span>
                  <span className="label-mono">· {result.mode}</span>
                </div>
                <h3
                  className="mt-2 leading-snug text-[var(--helix-ink)] display-serif"
                  style={{ fontSize: "1.6rem" }}
                >
                  {result.query}
                </h3>
              </div>
              <span
                className={clsx(
                  "pill flex-shrink-0",
                  isBooting ? "pill-warn" : "pill-live",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current pulse-dot" />
                {isBooting ? "Loading" : "Filed"}
              </span>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {result.metrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5"
                >
                  <p className="label-mono text-[0.62rem]">{m.label}</p>
                  <p className="mt-1 text-[0.98rem] font-semibold tracking-tight text-[var(--text-primary)]">
                    {m.value}
                  </p>
                  <p className="mt-0.5 text-[0.72rem] leading-4 text-[var(--text-secondary)] line-clamp-2">
                    {m.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-7 space-y-5 max-w-[66ch]">
              {result.answer.map((p, i) => (
                <p
                  key={p}
                  className={clsx(
                    "text-[0.96rem] leading-8 text-[var(--text-primary)]",
                    i === 0 && "first-letter:font-[var(--font-serif)] first-letter:text-[2.6rem] first-letter:leading-[0.9] first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-[var(--helix-saffron)]",
                  )}
                >
                  {p}
                </p>
              ))}
            </div>

            {result.followUps.length > 0 && (
              <div className="mt-8 pt-5 helix-rule">
                <p className="eyebrow mb-3">Further reading</p>
                <div className="flex flex-col gap-1.5">
                  {result.followUps.map((q, i) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void executeQuery(q, mode)}
                      className="group flex items-baseline gap-3 text-left py-1"
                    >
                      <span className="mono text-[0.64rem] text-[var(--text-faint)] group-hover:text-[var(--helix-saffron)] transition">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="flex-1 link-sweep text-[0.94rem]"
                        style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
                      >
                        {q}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 pt-5 border-t border-[var(--border-subtle)]">
              <p className="signature">
                — filed by the reranker desk, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
              </p>
            </div>
          </article>

          {/* ── Rail ─────────────────────────────────────────── */}
          <aside className="space-y-6">
            <section className="card-ink p-6">
              <div className="flex items-center justify-between mb-4 pb-3 helix-rule">
                <div className="flex items-baseline gap-2">
                  <span className="index-number">§ 03</span>
                  <p className="eyebrow">Footnotes</p>
                </div>
                <span className="mono text-[0.68rem] text-[var(--text-muted)]">
                  {result.sources.length}
                </span>
              </div>
              <SourceList sources={result.sources} onSourceSelect={setSelectedSource} />
            </section>

            <section className="card-ink p-6">
              <div className="flex items-center justify-between mb-4 pb-3 helix-rule">
                <div className="flex items-baseline gap-2">
                  <span className="index-number">§ 04</span>
                  <p className="eyebrow">Press run</p>
                </div>
                <Clock3 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </div>
              <ol className="space-y-0">
                {result.timeline.map((t, idx) => {
                  const dot =
                    t.status === "done"   ? "bg-[var(--accent-live)]"
                  : t.status === "active" ? "bg-[var(--helix-saffron)]"
                  : t.status === "failed" ? "bg-[var(--accent-rose)]"
                  : "bg-[var(--text-muted)]";
                  return (
                    <li key={`${t.stage}-${idx}`} className="flex gap-3 pb-3 last:pb-0">
                      <div className="flex flex-col items-center pt-1">
                        <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />
                        {idx < result.timeline.length - 1 && (
                          <span className="flex-1 w-px bg-[var(--border-subtle)] mt-1 min-h-[14px]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <p className="text-[0.82rem] font-medium text-[var(--text-primary)]">
                          {t.stage}
                        </p>
                        <p className="mt-0.5 text-[0.74rem] leading-5 text-[var(--text-secondary)]">
                          {t.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="card-ink p-6">
              <div className="flex items-center justify-between mb-4 pb-3 helix-rule">
                <div className="flex items-baseline gap-2">
                  <span className="index-number">§ 05</span>
                  <p className="eyebrow">Colophon</p>
                </div>
                <span className="mono text-[0.68rem] text-[var(--text-muted)]">
                  {uploads.length} uploads
                </span>
              </div>
              <dl className="space-y-2.5 text-[0.82rem]">
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>Provider</dt>
                  <dd className="mono text-[var(--helix-saffron)]">{health.provider}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>Runtime</dt>
                  <dd className="mono text-[var(--text-primary)]">{health.version}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>Collections</dt>
                  <dd className="mono text-[var(--text-primary)]">{collections.length}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </section>

        {/* ── Signature footer ─────────────────────────────────── */}
        <footer className="mt-16 pt-8 helix-rule flex items-baseline justify-between gap-4 text-[var(--text-muted)]">
          <p className="signature">
            <em>Helix</em> — an editorial desk for retrieval-augmented generation.
          </p>
          <p className="mono text-[0.7rem] uppercase tracking-wider">
            Set in Instrument Serif · Geist · {new Date().getFullYear()}
          </p>
        </footer>

        <SourceViewerModal source={selectedSource} onClose={() => setSelectedSource(null)} />
      </main>
    </DashboardFrame>
  );
}
