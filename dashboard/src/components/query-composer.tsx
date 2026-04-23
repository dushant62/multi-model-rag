"use client";

import clsx from "clsx";
import { ArrowUp, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";

import type { QueryImprovements, SearchMode } from "@/lib/types";

const modes: { key: SearchMode; label: string; hint: string }[] = [
  { key: "Search",       label: "Search",       hint: "Standard retrieval across your corpus" },
  { key: "Deep Research",label: "Deep Research", hint: "Hybrid KG + dense retrieval" },
  { key: "Multimodal",   label: "Multimodal",   hint: "Images, tables & equations" },
  { key: "Collections",  label: "Collections",  hint: "Scoped to a single collection" },
];

const RESPONSE_TYPES = ["Multiple Paragraphs", "Bullet Points", "Single Paragraph"] as const;

interface QueryComposerProps {
  mode: SearchMode;
  query: string;
  isBusy: boolean;
  suggestions: string[];
  improvementOptions: QueryImprovements;
  onModeChange: (mode: SearchMode) => void;
  onQueryChange: (query: string) => void;
  onImprovementOptionsChange: (options: QueryImprovements) => void;
  onSubmit: () => void;
}

export function QueryComposer({
  mode,
  query,
  isBusy,
  suggestions,
  improvementOptions,
  onModeChange,
  onQueryChange,
  onImprovementOptionsChange,
  onSubmit,
}: QueryComposerProps) {
  const [showEnhance, setShowEnhance] = useState(false);

  function toggleBool(key: keyof QueryImprovements) {
    const cur = improvementOptions[key] as boolean | undefined;
    onImprovementOptionsChange({
      ...improvementOptions,
      [key]: cur === true ? false : cur === false ? undefined : true,
    });
  }

  function triLabel(key: keyof QueryImprovements) {
    const v = improvementOptions[key] as boolean | undefined;
    return v === true ? "on" : v === false ? "off" : "auto";
  }

  function triClass(key: keyof QueryImprovements) {
    const v = improvementOptions[key] as boolean | undefined;
    if (v === true)  return "bg-[var(--accent-dim)] border-[var(--border-accent)] text-[var(--accent)]";
    if (v === false) return "bg-[rgba(244,63,94,0.1)] border-[rgba(244,63,94,0.3)] text-[var(--accent-rose)]";
    return "bg-transparent border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]";
  }

  return (
    <div className="space-y-3">
      {/* Main search box */}
      <div className="search-ring overflow-hidden">
        {/* Mode strip */}
        <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-3 py-2">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              title={m.hint}
              onClick={() => onModeChange(m.key)}
              className={clsx(
                "rounded-md px-2.5 py-1 text-[0.72rem] font-medium transition-colors",
                m.key === mode
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Text input */}
        <div className="flex items-end gap-2 p-3">
          <textarea
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={3}
            placeholder="Ask anything about your documents…"
            className="min-h-[70px] flex-1 resize-none bg-transparent text-[0.9rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none leading-6"
          />
          <button
            type="button"
            disabled={isBusy || query.trim().length === 0}
            onClick={onSubmit}
            className={clsx(
              "flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg transition-all",
              isBusy || query.trim().length === 0
                ? "bg-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--accent)] text-white hover:bg-[#6b8ef8] shadow-[0_0_16px_var(--accent-glow)]",
            )}
            aria-label="Submit query"
          >
            {isBusy ? (
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onQueryChange(s)}
              className="rounded-full border border-[var(--border-default)] bg-transparent px-3 py-1 text-[0.72rem] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-dim)]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* AI enhancement panel */}
      <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowEnhance((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-[0.72rem] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            RAG Enhancements
          </span>
          {showEnhance ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showEnhance && (
          <div className="border-t border-[var(--border-subtle)] px-3 py-3 space-y-3">
            <p className="text-[0.68rem] text-[var(--text-muted)]">
              Click to cycle: <strong className="text-[var(--text-secondary)]">auto</strong> → on → off
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: "enableHyde",            label: "HyDE" },
                  { key: "enableMultiQuery",       label: "Multi-query" },
                  { key: "enableDecomposition",    label: "Decompose" },
                  { key: "enableAdaptiveRouting",  label: "Auto-route" },
                ] as { key: keyof QueryImprovements; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleBool(key)}
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-[0.68rem] font-medium transition-all cursor-pointer",
                    triClass(key),
                  )}
                >
                  {label} [{triLabel(key)}]
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[0.68rem] text-[var(--text-muted)] flex-shrink-0">Format</span>
              <select
                value={improvementOptions.responseType ?? ""}
                onChange={(e) =>
                  onImprovementOptionsChange({
                    ...improvementOptions,
                    responseType: e.target.value || undefined,
                  })
                }
                className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-[0.68rem] text-[var(--text-secondary)] outline-none focus:border-[var(--border-accent)]"
              >
                <option value="">auto</option>
                {RESPONSE_TYPES.map((rt) => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

