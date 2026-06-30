"use client";

import { useCallback, useEffect, useState } from "react";
import { HardDrive, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiFetch";
import { formatBytes } from "@/components/settings/types";
import { filesCategoryPath } from "@/lib/files/routes";
import { CLOUD_SLUG } from "@/lib/files/types";

type GcsStats = {
  bucket: string;
  objectCount: number;
  totalBytes: number;
  breakdown: unknown[];
  fetchedAt: string;
  cached: boolean;
  source: "database";
};

function GcsStorageStatsContent({
  stats,
  error,
  refreshing,
  onRefresh,
}: {
  stats: GcsStats;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Card className="min-w-0 flex-1 border-border/80 bg-card/80 shadow-sm">
          <CardContent className="flex flex-col gap-2 py-4 sm:py-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HardDrive className="size-4 shrink-0 text-primary" />
              Занято в бакете
            </div>
            <p className="text-2xl font-semibold tabular-nums leading-none sm:text-3xl">
              {formatBytes(stats.totalBytes)}
            </p>
          </CardContent>
        </Card>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-8 shrink-0 gap-1.5 px-2.5 text-xs sm:text-sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Обновить
        </Button>
      </div>

      {stats.source === "database" ? (
        <p className="text-xs text-muted-foreground">
          Оценка по файлам в базе (без превью и бэкапов вне учёта).
        </p>
      ) : null}

      {error ? <p className="text-xs text-amber-500/90">При обновлении: {error}</p> : null}
    </div>
  );
}

export function GcsStorageOverviewSection({
  onVisibleChange,
}: {
  onVisibleChange?: (visible: boolean) => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [stats, setStats] = useState<GcsStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    const url = refresh ? "/api/stats/gcs?refresh=1" : "/api/stats/gcs";
    const res = await apiFetch(url, { cache: "no-store" }, refresh ? 120_000 : 60_000);
    const data = (await res.json()) as {
      configured?: boolean;
      stats?: GcsStats;
      error?: string;
    };

    if (!res.ok) {
      setConfigured(Boolean(data.configured));
      setError(data.error ?? `HTTP ${res.status}`);
      setStats(null);
      return;
    }

    if (!data.configured) {
      setConfigured(false);
      setStats(null);
      setError(null);
      return;
    }

    setConfigured(true);
    setStats(data.stats ?? null);
    setError(data.error ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    load()
      .catch(() => {
        if (active) setError("Не удалось загрузить статистику");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (configured === false) {
      onVisibleChange?.(false);
      return;
    }
    onVisibleChange?.(configured === true && (Boolean(stats) || Boolean(error)));
  }, [loading, configured, stats, error, onVisibleChange]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      await load(true);
    } catch {
      setError("Не удалось обновить статистику");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading || configured === false) {
    return null;
  }

  if (error && !stats) {
    return (
      <section id="gcs" className="scroll-mt-6">
        <header className="mb-4 sm:mb-6">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            Google Cloud Storage
          </h2>
        </header>
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </section>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <section id="gcs" className="scroll-mt-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2 sm:mb-6 sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            Google Cloud Storage
          </h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            Сколько места занято в бакете.
          </p>
        </div>
        <Link
          href={filesCategoryPath(CLOUD_SLUG)}
          className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
        >
          Облако →
        </Link>
      </header>
      <div className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm backdrop-blur-sm sm:p-6">
        <GcsStorageStatsContent
          stats={stats}
          error={error}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
        />
      </div>
    </section>
  );
}
