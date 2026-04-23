"use client";

import clsx from "clsx";
import {
  Boxes,
  FileSearch,
  FlaskConical,
  Layers3,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings as SettingsIcon,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import type { CollectionSummary, RecentQuery } from "@/lib/types";

interface SidebarProps {
  bridgeMode: "live" | "mock";
  provider: string;
  pulse: string;
  recentQueries: RecentQuery[];
  collections: CollectionSummary[];
  onRecentQuerySelect?: (item: RecentQuery) => void;
}

type NavLink = { href: string; label: string; icon: ReactNode };

const nav: NavLink[] = [
  { href: "/",                label: "Search",          icon: <Search size={14} /> },
  { href: "/ingestion",       label: "Ingest",          icon: <UploadCloud size={14} /> },
  { href: "/collections",     label: "Collections",     icon: <Boxes size={14} /> },
  { href: "/playbooks",       label: "Playbooks",       icon: <Layers3 size={14} /> },
  { href: "/parser-fleet",    label: "Parser fleet",    icon: <FileSearch size={14} /> },
  { href: "/knowledge-graph", label: "Knowledge graph", icon: <Network size={14} /> },
  { href: "/evaluation",      label: "Evaluation",      icon: <FlaskConical size={14} /> },
  { href: "/settings",        label: "Settings",        icon: <SettingsIcon size={14} /> },
];

export function Sidebar({
  bridgeMode,
  provider,
  pulse,
  recentQueries,
  collections,
  onRecentQuerySelect,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("sidebar:collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  return (
    <aside
      className={clsx(
        "flex h-screen flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-[width] duration-200",
        collapsed ? "w-[56px]" : "w-[224px]",
      )}
    >
      {/* brand */}
      <div className="flex h-[52px] items-center justify-between px-3 border-b border-[var(--border-subtle)]">
        <Link href="/" className="flex items-center gap-2.5 px-1 min-w-0">
          <div className="h-6 w-6 flex-shrink-0 rounded-[6px] bg-[var(--helix-saffron)] flex items-center justify-center shadow-[0_0_18px_rgba(255,179,71,0.35)]">
            <span className="font-serif text-[0.82rem] text-[#1a1208] italic leading-none" style={{ fontFamily: "var(--font-serif)" }}>H</span>
          </div>
          {!collapsed && (
            <span
              className="text-[1.02rem] tracking-tight text-[var(--helix-ink)] truncate italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Helix
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Toggle sidebar"
          className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          {collapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
        </button>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {!collapsed && (
          <p className="eyebrow px-2 pb-2 pt-1">Index</p>
        )}
        {nav.map((item, i) => {
          const active = pathname === item.href;
          const num = String(i + 1).padStart(2, "0");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                "nav-item",
                active && "nav-item-active",
                collapsed && "justify-center px-2",
              )}
            >
              {!collapsed && <span className="nav-num">{num}</span>}
              <span className="flex-shrink-0 text-[var(--text-muted)]">{item.icon}</span>
              {!collapsed && <span className="truncate flex-1">{item.label}</span>}
              {!collapsed && active && (
                <span className="h-1 w-1 rounded-full bg-[var(--helix-saffron)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* recent */}
      {!collapsed && recentQueries.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-3 py-3">
          <p className="eyebrow px-1 pb-1.5">Dispatch</p>
          <div className="space-y-0.5">
            {recentQueries.slice(0, 4).map((item, idx) => (
              <button
                key={`${item.title}-${idx}`}
                onClick={() => onRecentQuerySelect?.(item)}
                className="w-full rounded-md text-left px-2 py-1.5 text-[0.76rem] leading-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition group"
              >
                <span className="flex items-baseline gap-2">
                  <span className="mono text-[0.62rem] text-[var(--text-faint)] group-hover:text-[var(--helix-saffron)] transition">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="line-clamp-1 flex-1" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "0.92rem" }}>
                    {item.title}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* status */}
      <div className="border-t border-[var(--border-subtle)] px-3 py-3">
        <div className={clsx("flex items-center gap-2", collapsed && "justify-center")}>
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full pulse-dot flex-shrink-0",
              bridgeMode === "live" ? "bg-[var(--accent-live)]" : "bg-[var(--accent-amber)]",
            )}
          />
          {!collapsed && (
            <>
              <span className="text-[0.74rem] text-[var(--text-secondary)] capitalize">{bridgeMode}</span>
              <span className="ml-auto mono text-[0.68rem] text-[var(--helix-saffron)] truncate max-w-[90px]">
                {provider}
              </span>
            </>
          )}
        </div>
        {!collapsed && (
          <p className="mt-2 text-[0.72rem] text-[var(--text-muted)] line-clamp-1 italic" style={{ fontFamily: "var(--font-serif)" }}>
            {pulse}
          </p>
        )}
        {!collapsed && collections.length > 0 && (
          <p className="mt-1.5 text-[0.66rem] text-[var(--text-faint)] mono tracking-wider uppercase">
            Vol. {collections.length.toString().padStart(2, "0")} · {collections.length} collections
          </p>
        )}
      </div>
    </aside>
  );
}
