"use client";

import clsx from "clsx";
import { ImageIcon, Sigma, Table2, TextQuote } from "lucide-react";

import type { CitationSource, SourceModality } from "@/lib/types";

const modalityMeta: Record<
  SourceModality,
  { label: string; icon: typeof TextQuote; color: string }
> = {
  text:     { label: "Text",     icon: TextQuote,  color: "text-[var(--accent)]" },
  image:    { label: "Image",    icon: ImageIcon,  color: "text-[var(--accent-purple)]" },
  table:    { label: "Table",    icon: Table2,     color: "text-[var(--accent-green)]" },
  equation: { label: "Equation", icon: Sigma,      color: "text-[var(--accent-amber)]" },
};

interface SourceListProps {
  sources: CitationSource[];
  onSourceSelect?: (source: CitationSource) => void;
}

export function SourceList({ sources, onSourceSelect }: SourceListProps) {
  return (
    <div className="space-y-2">
      {sources.map((source, index) => {
        const meta = modalityMeta[source.modality];
        const Icon = meta.icon;

        return (
          <article
            key={source.id}
            className={clsx(
              "group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]",
              "transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]",
            )}
          >
            <button
              type="button"
              onClick={() => onSourceSelect?.(source)}
              className="w-full text-left p-3"
            >
              <div className="flex items-start gap-3">
                {/* Citation number */}
                <span className="flex-shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-dim)] text-[0.65rem] font-semibold text-[var(--accent)]">
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={clsx("h-3 w-3 flex-shrink-0", meta.color)} />
                    <span className="text-[0.65rem] font-medium text-[var(--text-muted)] truncate">
                      {source.domain}
                    </span>
                    <span className="ml-auto text-[0.65rem] text-[var(--text-muted)] flex-shrink-0">
                      {source.freshness}
                    </span>
                  </div>
                  <h3 className="text-[0.82rem] font-semibold text-[var(--text-primary)] leading-tight truncate">
                    {source.title}
                  </h3>
                  <p className="mt-1 text-[0.75rem] leading-5 text-[var(--text-secondary)] line-clamp-2">
                    {source.snippet}
                  </p>

                  {/* Relevance bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-cyan)]"
                        style={{ width: `${Math.round(source.relevance * 100)}%` }}
                      />
                    </div>
                    <span className="text-[0.65rem] font-medium text-[var(--text-muted)]">
                      {Math.round(source.relevance * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </article>
        );
      })}
    </div>
  );
}

