"use client";

import { ArrowRight, Boxes, FileSearch, Network } from "lucide-react";
import Link from "next/link";

import { DashboardFrame } from "@/components/dashboard-frame";
import { UploadPanel } from "@/components/upload-panel";
import { useDashboardData } from "@/lib/use-dashboard-data";

const ctas = [
  {
    href: "/parser-fleet",
    title: "Parser fleet",
    desc: "Watch the ingestion pipeline as documents are segmented and embedded.",
    icon: FileSearch,
  },
  {
    href: "/collections",
    title: "Collections",
    desc: "Organize processed documents into queryable knowledge bases.",
    icon: Boxes,
  },
  {
    href: "/knowledge-graph",
    title: "Knowledge graph",
    desc: "Inspect the entities and relationships extracted from your corpus.",
    icon: Network,
  },
];

export function IngestionShell() {
  const {
    overview,
    health,
    collections,
    uploads,
    handleUpload,
    handleDeleteUpload,
    handleRecentQuerySelect,
  } = useDashboardData();

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
        <section>
          <div className="flex items-baseline gap-3">
            <span className="index-number">§ 02 · Intake</span>
            <span className="helix-rule flex-1 h-0" />
          </div>
          <h2 className="display-title mt-5" style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>
            Submit to the <em>archive.</em>
          </h2>
          <p className="display-kicker mt-4 max-w-[52ch]">
            Drop PDFs, images, and spreadsheets. The parser fleet handles
            segmentation, OCR, and embedding — your documents arrive shelved,
            indexed, and quietly quotable.
          </p>
        </section>

        <section className="mt-10">
          <UploadPanel
            uploads={uploads}
            onUpload={handleUpload}
            onDelete={handleDeleteUpload}
          />
        </section>

        <section className="mt-14">
          <div className="flex items-baseline gap-3 mb-6">
            <span className="index-number">§ 03 · Departments</span>
            <span className="helix-rule flex-1 h-0" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {ctas.map(({ href, title, desc, icon: Icon }, i) => (
              <Link
                key={href}
                href={href}
                className="card-ink group p-6 block"
              >
                <div className="flex items-center justify-between">
                  <span className="mono text-[0.68rem] text-[var(--helix-saffron)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] transition group-hover:text-[var(--helix-saffron)] group-hover:translate-x-0.5" />
                </div>
                <Icon className="mt-5 h-5 w-5 text-[var(--text-secondary)] group-hover:text-[var(--helix-saffron)] transition" />
                <h3
                  className="mt-4 text-[var(--helix-ink)]"
                  style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", lineHeight: 1.1 }}
                >
                  {title}
                </h3>
                <p className="mt-2 text-[0.82rem] leading-6 text-[var(--text-secondary)]">
                  {desc}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-16 pt-8 helix-rule flex items-baseline justify-between gap-4 text-[var(--text-muted)]">
          <p className="signature">
            <em>Helix</em> — the intake desk, {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
          </p>
          <p className="mono text-[0.7rem] uppercase tracking-wider">
            {uploads.length} on file · {collections.length} collections
          </p>
        </footer>
      </main>
    </DashboardFrame>
  );
}
