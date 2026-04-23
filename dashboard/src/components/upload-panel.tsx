"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { CloudUpload, LoaderCircle, Trash2 } from "lucide-react";

import { getDashboardUploadTimeline } from "@/lib/api";
import type { BridgeMode, UploadItem } from "@/lib/types";

interface UploadPanelProps {
  uploads: UploadItem[];
  errorMessage?: string | null;
  bridgeMode?: BridgeMode;
  onUpload: (files: FileList | null) => void;
  onDelete?: (uploadId: string) => void;
}

export function UploadPanel({
  uploads,
  errorMessage,
  bridgeMode = "live",
  onUpload,
  onDelete,
}: UploadPanelProps) {
  const [timelineDetails, setTimelineDetails] = useState<
    Record<string, Awaited<ReturnType<typeof getDashboardUploadTimeline>>>
  >({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTimelines() {
      const next = await Promise.all(
        uploads.map(async (u) => [u.id, await getDashboardUploadTimeline(u)] as const),
      );
      if (!cancelled) setTimelineDetails(Object.fromEntries(next));
    }

    void loadTimelines();

    const inProgress = uploads.filter(
      (item) => item.status === "processing" || item.status === "queued",
    );

    if (inProgress.length === 0) return () => { cancelled = true; };

    const interval = window.setInterval(() => void loadTimelines(), 3000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [uploads]);

  const isMock = bridgeMode === "mock";

  async function handleDelete(uploadId: string) {
    if (!onDelete) return;
    setDeletingId(uploadId);
    try { onDelete(uploadId); }
    finally { setDeletingId(null); }
  }

  return (
    <section className="panel rounded-xl p-5 space-y-4">
      <div>
        <p className="eyebrow">Ingestion</p>
        <h3 className="mt-1 text-[0.95rem] font-semibold text-[var(--text-primary)]">
          Upload documents
        </h3>
        <p className="mt-1 text-[0.78rem] leading-5 text-[var(--text-secondary)]">
          PDF, DOCX, PPTX, XLSX, images. Files enter the parse queue and become citation-ready once indexed.
        </p>
      </div>

      {isMock && (
        <div className="rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-[0.75rem] text-[var(--accent-amber)]">
          Mock mode — uploads are simulated. Set your API key to enable live ingestion.
        </div>
      )}

      {!isMock && errorMessage && (
        <div className="rounded-lg border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-[0.75rem] text-[var(--accent-rose)]">
          {errorMessage}
        </div>
      )}

      <label
        className={clsx(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-center transition-colors cursor-pointer",
          isMock
            ? "border-[var(--border-subtle)] opacity-40 cursor-not-allowed"
            : "border-[var(--border-default)] hover:border-[var(--border-accent)] hover:bg-[var(--accent-dim)]",
        )}
      >
        <CloudUpload className={clsx("h-6 w-6", isMock ? "text-[var(--text-muted)]" : "text-[var(--accent)]")} />
        <span className="text-[0.78rem] font-medium text-[var(--text-secondary)]">
          {isMock ? "Upload disabled in mock mode" : "Drop files or click to choose"}
        </span>
        <input
          type="file"
          multiple
          disabled={isMock}
          className="hidden"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.png,.jpg,.jpeg"
          onChange={(e) => onUpload(e.target.files)}
        />
      </label>

      <div className="space-y-2">
        {uploads.map((item) => (
          <div key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8rem] font-medium text-[var(--text-primary)]">{item.name}</p>
                <p className="text-[0.68rem] text-[var(--text-muted)] mt-0.5">
                  {item.parser} · {item.pages} pages
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium border",
                    item.status === "ready"      && "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.1)] text-[var(--accent-green)]",
                    item.status === "processing" && "border-[rgba(91,124,246,0.3)] bg-[var(--accent-dim)] text-[var(--accent)]",
                    item.status === "queued"     && "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-muted)]",
                    item.status === "failed"     && "border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] text-[var(--accent-rose)]",
                  )}
                >
                  {item.status === "processing" && <LoaderCircle className="h-3 w-3 animate-spin" />}
                  {item.status}
                </span>
                {onDelete && (
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    disabled={deletingId === item.id}
                    onClick={() => void handleDelete(item.id)}
                    className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[rgba(244,63,94,0.12)] hover:text-[var(--accent-rose)] transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all",
                  item.status === "failed"
                    ? "bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-amber)]"
                    : "bg-gradient-to-r from-[var(--accent)] to-[var(--accent-cyan)]",
                )}
                style={{ width: `${item.progress}%` }}
              />
            </div>
            {(timelineDetails[item.id] ?? []).length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(timelineDetails[item.id] ?? []).map((event, i) => (
                  <div
                    key={`${event.stage}-${i}`}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={clsx(
                          "h-1.5 w-1.5 rounded-full flex-shrink-0",
                          event.status === "done"   && "bg-[var(--accent-green)]",
                          event.status === "active" && "bg-[var(--accent)]",
                          event.status === "queued" && "bg-[var(--text-muted)]",
                          event.status === "failed" && "bg-[var(--accent-rose)]",
                        )}
                      />
                      <p className="text-[0.65rem] font-semibold text-[var(--text-secondary)] truncate">
                        {event.stage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}



