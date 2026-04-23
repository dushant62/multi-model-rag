"use client";

import { FileText, Layers3, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getDashboardSourcePreview } from "@/lib/api";
import type { CitationSource, SourcePreview } from "@/lib/types";

interface SourceViewerModalProps {
  source: CitationSource | null;
  onClose: () => void;
}

export function SourceViewerModal({
  source,
  onClose,
}: SourceViewerModalProps) {
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!source) {
      return;
    }

    const activeSource = source;

    let cancelled = false;

    async function loadPreview() {
      setIsLoading(true);
      try {
        const nextPreview = await getDashboardSourcePreview(activeSource);
        if (!cancelled) {
          setPreview(nextPreview);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPreview();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, source]);

  if (!source) {
    return null;
  }

  const activePreview = preview ?? {
    sourceId: source.id,
    title: source.title,
    domain: source.domain,
    modality: source.modality,
    collection: "Loading workspace context",
    parser: "Loading parser",
    pageLabel: "Preparing preview",
    summary: "Loading citation context...",
    highlightedExcerpt: source.snippet,
    surroundingContext: [],
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-base)]/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] p-5 sm:p-7"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-viewer-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="eyebrow">Source preview</p>
            <h2
              id="source-viewer-title"
              className="display-title text-[2rem] text-[var(--text-primary)] sm:text-[2.35rem]"
            >
              {activePreview.title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">{activePreview.domain}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Close source preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="surface-card rounded-[24px] p-4">
            <p className="eyebrow">Collection</p>
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
              {activePreview.collection}
            </p>
          </div>
          <div className="surface-card rounded-[24px] p-4">
            <p className="eyebrow">Parser</p>
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
              {activePreview.parser}
            </p>
          </div>
          <div className="surface-card rounded-[24px] p-4">
            <p className="eyebrow">Location</p>
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
              {activePreview.pageLabel}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_280px]">
          <section className="space-y-4">
            <div className="surface-card rounded-[28px] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <FileText className="h-4 w-4 text-[var(--accent)]" />
                Summary
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                {isLoading ? "Loading source context..." : activePreview.summary}
              </p>
            </div>

            <div className="rounded-[28px] border border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
                <Sparkles className="h-4 w-4" />
                Highlighted excerpt
              </div>
              <p className="mt-4 text-base leading-8 text-[var(--text-primary)]">
                {activePreview.highlightedExcerpt}
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="surface-card rounded-[28px] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <Layers3 className="h-4 w-4 text-[var(--accent-cyan)]" />
                Surrounding context
              </div>
              <div className="mt-4 space-y-3">
                {activePreview.surroundingContext.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-sm leading-6 text-[var(--text-secondary)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
