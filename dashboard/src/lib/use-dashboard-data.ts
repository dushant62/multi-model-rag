"use client";

import { useEffect, useMemo, useState } from "react";

import {
  deleteUploadItem,
  getDashboardCollections,
  getDashboardHealth,
  getDashboardOverview,
  runDashboardQuery,
  uploadDashboardFiles,
} from "@/lib/api";
import { getMockOverview } from "@/lib/mock-data";
import type {
  CollectionSummary,
  DashboardHealth,
  DashboardOverview,
  QueryImprovements,
  QueryResult,
  RecentQuery,
  SearchMode,
  UploadItem,
} from "@/lib/types";

export function useDashboardData() {
  const fallbackOverview = useMemo(() => getMockOverview(), []);
  const [overview, setOverview] = useState<DashboardOverview>(fallbackOverview);
  const [health, setHealth] = useState<DashboardHealth>({
    status: "ok",
    service: "multi-model-rag-dashboard-api",
    version: "dev",
    bridgeMode: fallbackOverview.bridgeMode,
    provider: "openai",
    workingDir: "./rag_storage",
  });
  const [collections, setCollections] = useState<CollectionSummary[]>(
    fallbackOverview.collections,
  );
  const [result, setResult] = useState<QueryResult>(fallbackOverview.featuredResult);
  const [uploads, setUploads] = useState<UploadItem[]>(fallbackOverview.uploads);
  const [query, setQuery] = useState(fallbackOverview.heroQuestion);
  const [mode, setMode] = useState<SearchMode>(fallbackOverview.featuredResult.mode);
  const [isBooting, setIsBooting] = useState(true);
  const [isQuerying, setIsQuerying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [improvementOptions, setImprovementOptions] = useState<QueryImprovements>({});

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const [nextOverview, nextCollections, nextHealth] = await Promise.all([
        getDashboardOverview(),
        getDashboardCollections(),
        getDashboardHealth(),
      ]);

      if (cancelled) {
        return;
      }

      setOverview(nextOverview);
      setCollections(nextCollections);
      setHealth(nextHealth);
      setResult(nextOverview.featuredResult);
      setUploads(nextOverview.uploads);
      setQuery(nextOverview.heroQuestion);
      setMode(nextOverview.featuredResult.mode);
      setLastError(null);
      setIsBooting(false);
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [fallbackOverview]);

  async function refreshHealth() {
    const nextHealth = await getDashboardHealth();
    setHealth(nextHealth);
  }

  async function executeQuery(nextQuery: string, nextMode: SearchMode) {
    const trimmedQuery = nextQuery.trim();
    if (trimmedQuery.length === 0 || isQuerying) {
      return;
    }

    setQuery(trimmedQuery);
    setMode(nextMode);
    setIsQuerying(true);

    try {
      const nextResult = await runDashboardQuery({
        query: trimmedQuery,
        mode: nextMode,
        improvements: Object.keys(improvementOptions).length > 0 ? improvementOptions : undefined,
      });

      setResult(nextResult);
      setLastError(null);
      setOverview((current) => ({
        ...current,
        recentQueries: [
          { title: trimmedQuery, when: "just now", mode: nextMode },
          ...current.recentQueries.filter((item) => item.title !== trimmedQuery),
        ].slice(0, 4),
      }));
      await refreshHealth();
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Dashboard query failed.",
      );
    } finally {
      setIsQuerying(false);
    }
  }

  async function handleSubmit() {
    await executeQuery(query, mode);
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    try {
      const accepted = await uploadDashboardFiles(Array.from(fileList));
      setUploads((current) => [...accepted, ...current].slice(0, 6));
      setLastError(null);
      await refreshHealth();
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Dashboard upload failed.",
      );
    }
  }

  async function handleDeleteUpload(uploadId: string) {
    try {
      await deleteUploadItem(uploadId);
      setUploads((current) => current.filter((item) => item.id !== uploadId));
      setLastError(null);
    } catch (error) {
      setLastError(
        error instanceof Error ? error.message : "Failed to remove upload.",
      );
    }
  }

  function handleRecentQuerySelect(item: RecentQuery) {
    void executeQuery(item.title, item.mode);
  }

  return {
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
    improvementOptions,
    setQuery,
    setMode,
    setImprovementOptions,
    executeQuery,
    handleSubmit,
    handleUpload,
    handleDeleteUpload,
    handleRecentQuerySelect,
  };
}
