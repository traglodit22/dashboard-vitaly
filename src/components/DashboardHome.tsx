"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Package,
  Warehouse,
  Truck,
  CheckCircle2,
  Clock,
  Wallet,
  AlertTriangle,
  AlertCircle,
  Scale,
  DollarSign,
  RefreshCw,
  Star,
  Folder,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { LasLegasStats } from "@/components/laslegas/LasLegasStats";
import { GcsStorageOverviewSection } from "@/components/gcs/GcsStorageStats";
import { toast } from "sonner";
import { filesCategoryPath, FILES_CHANGED_EVENT } from "@/lib/files/routes";
import { CLOUD_SLUG } from "@/lib/files/types";
import { useOverviewNav } from "@/components/overview/OverviewNavContext";
import {
  scrollToOverviewSection,
  parseOverviewSection,
  type OverviewSectionId,
} from "@/components/overview/overviewNav";

interface FavoriteFolder {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
}

interface OrderStats {
  total: number;
  sentTotal: number;
  awaitingTrack: number;
  onWarehouse: number;
  inTransit: number;
  delivered: number;
  totalWeightKg: number;
  totalValueCny: number;
}

interface BalanceProvider {
  id: string;
  name: string;
  apiUrl: string;
  panelUrl: string;
  currency: string;
  threshold: number;
  lastBalance: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  active: boolean;
}

function effectivePanelUrl(p: BalanceProvider): string {
  if (p.panelUrl) return p.panelUrl;
  try {
    return new URL(p.apiUrl).origin;
  } catch {
    return "";
  }
}

const numFmt = new Intl.NumberFormat("ru-RU");
const decFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const balFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FLUID_GRID =
  "grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]";

const PIPELINE_STAGES = [
  {
    key: "awaitingTrack",
    label: "Ожидают трек",
    hint: "Ещё не отправлены в ДоброПост",
    icon: Clock,
    color: "text-amber-400",
    accent: "from-amber-500/12",
    border: "border-amber-500/20",
  },
  {
    key: "sentTotal",
    label: "В ДоброПост",
    hint: "Отправлено на склад перевозчика",
    icon: Package,
    color: "text-emerald-400",
    accent: "from-emerald-500/12",
    border: "border-emerald-500/20",
  },
  {
    key: "onWarehouse",
    label: "На складе",
    hint: "Ожидают отправки клиенту",
    icon: Warehouse,
    color: "text-sky-400",
    accent: "from-sky-500/12",
    border: "border-sky-500/20",
  },
  {
    key: "inTransit",
    label: "В пути",
    hint: "Уже ушли со склада",
    icon: Truck,
    color: "text-amber-400",
    accent: "from-amber-500/12",
    border: "border-amber-500/25",
  },
  {
    key: "delivered",
    label: "Доставлено",
    hint: "Получены получателем",
    icon: CheckCircle2,
    color: "text-emerald-400",
    accent: "from-emerald-500/12",
    border: "border-emerald-500/20",
  },
] as const;

export function DashboardHome() {
  const { setVisibleIds } = useOverviewNav()!;
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [balances, setBalances] = useState<BalanceProvider[]>([]);
  const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gcsVisible, setGcsVisible] = useState(false);

  const loadAll = useCallback(async () => {
    const [statsData, balData, favData] = await Promise.all([
      apiFetch("/api/stats/overview", { cache: "no-store" }).then((r) => r.json()),
      apiFetch("/api/balances", { cache: "no-store" }).then((r) => r.json()),
      apiFetch("/api/files/folders/favorites", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setStats(statsData.orders ?? null);
    setBalances((balData.providers ?? []).filter((p: BalanceProvider) => p.active));
    setFavoriteFolders(favData.folders ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    loadAll()
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAll]);

  useEffect(() => {
    const onChange = () => void loadAll();
    window.addEventListener(FILES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, onChange);
  }, [loadAll]);

  useEffect(() => {
    if (loading || !stats) return;

    const visible = new Set<OverviewSectionId>(["orders", "laslegas"]);
    if (favoriteFolders.length > 0) visible.add("favorites");
    if (balances.length > 0) visible.add("balances");
    if (gcsVisible) visible.add("gcs");
    setVisibleIds(visible);
  }, [loading, stats, favoriteFolders.length, balances.length, gcsVisible, setVisibleIds]);

  useEffect(() => {
    if (loading || !stats) return;
    const id = parseOverviewSection(window.location.hash);
    if (!id) return;
    const timer = window.setTimeout(() => scrollToOverviewSection(id), 100);
    return () => window.clearTimeout(timer);
  }, [loading, stats]);

  async function refreshBalances() {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/balances/check", { method: "POST" }, 300_000);
      const data = await res.json().catch(() => ({}));
      const payload = data as { error?: string; results?: { error?: string }[]; low?: unknown[] };
      if (!res.ok) {
        throw new Error(String(payload.error ?? `HTTP ${res.status}`));
      }
      await loadAll();
      const failed = (payload.results ?? []).filter((r) => r.error).length;
      if (failed > 0) {
        toast.warning(`Обновлено с ошибками у ${failed} панелей`);
      } else if ((payload.low?.length ?? 0) > 0) {
        toast.warning(`Низкий баланс у ${payload.low!.length} панелей`);
      } else {
        toast.success("Балансы обновлены");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить балансы";
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Загрузка…
      </div>
    );
  }

  if (!stats) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Не удалось загрузить статистику.
      </p>
    );
  }

  const summaryCards = [
    {
      label: "Всего заказов",
      value: numFmt.format(stats.total),
      icon: Package,
      hint: "Все записи в системе",
    },
    {
      label: "Общий вес",
      value: `${decFmt.format(stats.totalWeightKg)} кг`,
      icon: Scale,
      hint: "Суммарный вес отправлений",
    },
    {
      label: "Сумма заказов",
      value: `¥${decFmt.format(stats.totalValueCny)}`,
      icon: DollarSign,
      hint: "Стоимость товаров в юанях",
    },
  ] as const;

  return (
    <div className="min-w-0 flex-1 space-y-8 sm:space-y-10">
      {favoriteFolders.length > 0 && (
        <OverviewBlock
          id="favorites"
          title="Быстрый доступ"
          description="Избранные папки из облака — один клик до нужных файлов."
          action={
            <Link
              href={filesCategoryPath(CLOUD_SLUG)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
            >
              Все файлы →
            </Link>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {favoriteFolders.map((folder) => (
              <Link
                key={folder.id}
                href={filesCategoryPath(folder.categorySlug, folder.id)}
                className="group flex items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3.5 transition-all hover:border-primary/35 hover:bg-primary/[0.04] hover:shadow-sm"
                title={folder.name}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                  <Folder className="size-4 text-amber-500" />
                </div>
                <span className="min-w-0 truncate font-medium group-hover:text-primary">
                  {folder.name}
                </span>
              </Link>
            ))}
          </div>
        </OverviewBlock>
      )}

      {balances.length > 0 && (
        <OverviewBlock
          id="balances"
          title="Балансы панелей"
          description="SmmLaba и другие панели — актуальные остатки и пороги."
          compact
          action={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs sm:text-sm"
              onClick={refreshBalances}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Обновить
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {balances.map((p) => (
              <BalanceTile key={p.id} provider={p} />
            ))}
          </div>
        </OverviewBlock>
      )}

      <GcsStorageOverviewSection onVisibleChange={setGcsVisible} />

      <OverviewBlock
        id="laslegas"
        title="Las Legas"
        description="Статистика музея LEGO — посетители, билеты и выручка."
        unboxed
      >
        <LasLegasStats embedded />
      </OverviewBlock>

      <OverviewBlock
        id="orders"
        title="Заказы"
        description="Сводка по отправкам: от ожидания трека до доставки, плюс вес и сумма."
        action={
          <Link
            href="/orders"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
          >
            Все заказы →
          </Link>
        }
      >
        <div className="space-y-6">
          <div className={FLUID_GRID}>
            {summaryCards.map(({ label, value, icon: Icon, hint }) => (
              <Card
                key={label}
                className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm"
                title={hint}
              >
                <CardContent className="flex flex-col gap-3 py-4 sm:py-5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="size-4 shrink-0 text-primary" />
                    <span className="leading-snug">{label}</span>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums leading-none sm:text-3xl">
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Этапы доставки
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {PIPELINE_STAGES.map((stage, index) => {
                const Icon = stage.icon;
                const value = stats[stage.key];
                return (
                  <div key={stage.key} className="relative min-w-0">
                    {index > 0 ? (
                      <span
                        className="pointer-events-none absolute -left-2 top-1/2 hidden -translate-y-1/2 text-muted-foreground/35 xl:block"
                        aria-hidden
                      >
                        →
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "flex h-full flex-col gap-2 rounded-xl border bg-gradient-to-br to-transparent p-4 sm:p-5",
                        stage.accent,
                        stage.border,
                      )}
                      title={stage.hint}
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                        <Icon className={cn("size-4 shrink-0", stage.color)} />
                        <span className="min-w-0 leading-snug">{stage.label}</span>
                      </div>
                      <span
                        className={cn(
                          "text-2xl font-semibold tabular-nums sm:text-3xl",
                          stage.color,
                        )}
                      >
                        {numFmt.format(value)}
                      </span>
                      <span className="text-[11px] leading-snug text-muted-foreground/80">
                        {stage.hint}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </OverviewBlock>
    </div>
  );
}

function OverviewBlock({
  id,
  title,
  description,
  action,
  unboxed,
  compact,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  unboxed?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <header
        className={cn(
          "flex flex-wrap items-start justify-between gap-2 sm:gap-3",
          compact ? "mb-2.5 sm:mb-3" : "mb-4 sm:mb-6",
        )}
      >
        <div className="min-w-0">
          <h2
            className={cn(
              "font-semibold tracking-tight",
              compact ? "text-base sm:text-lg" : "text-lg sm:text-xl",
            )}
          >
            {title}
          </h2>
          {description ? (
            <p
              className={cn(
                "mt-0.5 max-w-3xl text-muted-foreground",
                compact ? "text-xs sm:text-sm" : "text-sm",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {unboxed ? (
        children
      ) : (
        <div
          className={cn(
            "rounded-xl border border-border/80 bg-card/50 shadow-sm backdrop-blur-sm",
            compact ? "p-2.5 sm:p-3" : "p-4 sm:p-6",
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function BalanceTile({ provider: p }: { provider: BalanceProvider }) {
  const isLow = p.lastBalance !== null && p.lastBalance < p.threshold;
  const hasError = Boolean(p.lastError);
  const noData = p.lastBalance === null && !hasError;
  const url = effectivePanelUrl(p);

  const statusTone = hasError
    ? "border-l-destructive/70 bg-destructive/[0.06] hover:bg-destructive/10"
    : isLow
      ? "border-l-red-500/70 bg-red-500/[0.06] hover:bg-red-500/10"
      : "border-l-emerald-500/50 bg-muted/20 hover:border-l-primary/50 hover:bg-muted/35";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-1">
        <span className="min-w-0 truncate text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px]">
          {p.name}
        </span>
        {hasError ? (
          <AlertCircle className="size-3 shrink-0 text-destructive" />
        ) : isLow ? (
          <AlertTriangle className="size-3 shrink-0 text-red-500" />
        ) : (
          <Wallet className="size-3 shrink-0 text-muted-foreground/50" />
        )}
      </div>

      <div className="mt-1 flex min-w-0 items-baseline gap-1">
        <span
          className={cn(
            "truncate font-mono text-sm font-semibold tabular-nums leading-none sm:text-base",
            hasError ? "text-destructive" : isLow ? "text-red-500" : noData ? "text-muted-foreground" : "",
          )}
        >
          {hasError ? "—" : noData ? "—" : balFmt.format(p.lastBalance!)}
        </span>
        {!hasError && !noData && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {p.currency}
          </span>
        )}
      </div>

      {hasError ? (
        <span className="mt-0.5 truncate text-[10px] leading-tight text-destructive/80" title={p.lastError!}>
          Ошибка
        </span>
      ) : isLow ? (
        <span className="mt-0.5 text-[10px] leading-tight text-red-400/90">
          &lt; {balFmt.format(p.threshold)}
        </span>
      ) : null}
    </>
  );

  const cls = cn(
    "flex flex-col rounded-lg border border-border/60 border-l-[3px] px-2 py-2 transition-colors sm:px-2.5 sm:py-2.5",
    statusTone,
    url && "cursor-pointer active:scale-[0.98]",
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls} title={p.name}>
      {inner}
    </a>
  ) : (
    <div className={cls} title={p.name}>
      {inner}
    </div>
  );
}
