"use client";

import { Command, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/sidebar";
import type { CollectionSummary, RecentQuery } from "@/lib/types";

interface DashboardFrameProps {
  bridgeMode: "live" | "mock";
  provider: string;
  pulse: string;
  recentQueries: RecentQuery[];
  collections: CollectionSummary[];
  onRecentQuerySelect?: (item: RecentQuery) => void;
  children: ReactNode;
}

const ROUTE_TITLES: Record<string, string> = {
  "/":                "Search",
  "/ingestion":       "Ingest",
  "/collections":     "Collections",
  "/playbooks":       "Playbooks",
  "/parser-fleet":    "Parser fleet",
  "/knowledge-graph": "Knowledge graph",
  "/evaluation":      "Evaluation",
  "/settings":        "Settings",
};

export function DashboardFrame({
  bridgeMode,
  provider,
  pulse,
  recentQueries,
  collections,
  onRecentQuerySelect,
  children,
}: DashboardFrameProps) {
  const pathname = usePathname();
  const title = (pathname && ROUTE_TITLES[pathname]) || "Workspace";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <Sidebar
        bridgeMode={bridgeMode}
        provider={provider}
        pulse={pulse}
        recentQueries={recentQueries}
        collections={collections}
        onRecentQuerySelect={onRecentQuerySelect}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[52px] items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="chip-saffron">§ {String(Object.keys(ROUTE_TITLES).indexOf(pathname ?? "") + 1).padStart(2, "0")}</span>
            <h1
              className="truncate tracking-tight text-[var(--helix-ink)]"
              style={{ fontFamily: "var(--font-serif)", fontSize: "1.05rem" }}
            >
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden md:inline-flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[0.76rem] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition"
            >
              <Search className="h-3 w-3" />
              <span>Search</span>
              <span className="flex items-center gap-0.5 ml-1">
                <span className="kbd"><Command className="inline h-2.5 w-2.5" /></span>
                <span className="kbd">K</span>
              </span>
            </Link>

            <div className={bridgeMode === "live" ? "pill pill-live" : "pill pill-warn"}>
              <span
                className={`h-1.5 w-1.5 rounded-full pulse-dot ${
                  bridgeMode === "live" ? "bg-[var(--accent-live)]" : "bg-[var(--accent-amber)]"
                }`}
              />
              {bridgeMode}
            </div>
          </div>
        </header>

        <div className="ticker">
          <div className="ticker-track">
            {Array.from({ length: 2 }).flatMap((_, loop) => [
              <span key={`p-${loop}`}>{pulse}</span>,
              <span key={`s1-${loop}`} className="sep">◆</span>,
              <span key={`prov-${loop}`}>Provider · {provider}</span>,
              <span key={`s2-${loop}`} className="sep">◆</span>,
              <span key={`col-${loop}`}>{collections.length} collections indexed</span>,
              <span key={`s3-${loop}`} className="sep">◆</span>,
              <span key={`rec-${loop}`}>
                Latest · {recentQueries[0]?.title ?? "awaiting dispatch"}
              </span>,
              <span key={`s4-${loop}`} className="sep">◆</span>,
              <span key={`edt-${loop}`}>Helix · Vol. 01 · Dispatch from the knowledge desk</span>,
              <span key={`s5-${loop}`} className="sep">◆</span>,
            ])}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
