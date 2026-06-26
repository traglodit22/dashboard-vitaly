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

export function DashboardHome() {
  const { setVisibleIds } = useOverviewNav()!;
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [balances, setBalances] = useState<BalanceProvider[]>([]);
  const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

    const visible = new Set<OverviewSectionId>(["orders", "laslegas", "statuses"]);
    if (favoriteFolders.length > 0) visible.add("favorites");
    if (balances.length > 0) visible.add("balances");
    setVisibleIds(visible);
  }, [loading, stats, favoriteFolders.length, balances.length, setVisibleIds]);

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
      const res = await apiFetch("/api/balances/check", { method: "POST" });
      const data = await res.json();
      await loadAll();
      if (data.low?.length > 0) {
        toast.warning(`Низкий баланс у ${data.low.length} панелей`);
      } else {
        toast.success("Балансы обновлены");
      }
    } catch {
      toast.error("Не удалось обновить балансы");
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

  const orderCards = [
    {
      label: "Всего заказов",
      value: numFmt.format(stats.total),
      icon: Package,
      highlight: false,
      color: "",
    },
    {
      label: "На складе",
      value: numFmt.format(stats.onWarehouse),
      icon: Warehouse,
      highlight: true,
      color: "text-sky-400",
    },
    {
      label: "В пути",
      value: numFmt.format(stats.inTransit),
      icon: Truck,
      highlight: true,
      color: "text-amber-400",
    },
    {
      label: "Доставлено",
      value: numFmt.format(stats.delivered),
      icon: CheckCircle2,
      highlight: false,
      color: "text-emerald-400",
    },
    {
      label: "Ожидают трек",
      value: numFmt.format(stats.awaitingTrack),
      icon: Clock,
      highlight: false,
      color: "text-muted-foreground",
    },
    {
      label: "Общий вес",
      value: `${decFmt.format(stats.totalWeightKg)} кг`,
      icon: Scale,
      highlight: false,
      color: "text-muted-foreground",
    },
    {
      label: "Сумма заказов",
      value: `¥${decFmt.format(stats.totalValueCny)}`,
      icon: DollarSign,
      highlight: false,
      color: "text-muted-foreground",
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
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshBalances}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Обновить все
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {balances.map((p) => (
              <BalanceTile key={p.id} provider={p} />
            ))}
          </div>
        </OverviewBlock>
      )}

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
        description="Сводная статистика по всем отправкам и заказам."
      >
        <div className={FLUID_GRID}>
          {orderCards.map(({ label, value, icon: Icon, highlight, color }) => (
            <Card
              key={label}
              className={cn(
                "border-border/80 bg-card/80 shadow-sm backdrop-blur-sm transition-colors",
                highlight && "border-primary/25 bg-primary/[0.04] ring-1 ring-primary/15",
              )}
            >
              <CardContent className="flex flex-col gap-3 py-4 sm:py-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className={cn("size-4 shrink-0", color || "text-primary")} />
                  <span className="leading-snug">{label}</span>
                </div>
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums leading-none sm:text-3xl",
                    color && color !== "text-muted-foreground" ? color : "",
                  )}
                >
                  {value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </OverviewBlock>

      <OverviewBlock
        id="statuses"
        title="Статусы отправок"
        description="Быстрый срез по ключевым этапам доставки."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusRow
            label="Отправлено в ДоброПост"
            value={stats.sentTotal}
            color="text-emerald-400"
            accent="from-emerald-500/15"
          />
          <StatusRow
            label="Ожидают трек-код"
            value={stats.awaitingTrack}
            color="text-amber-400"
            accent="from-amber-500/15"
          />
          <StatusRow
            label="На складе"
            value={stats.onWarehouse}
            color="text-sky-400"
            accent="from-sky-500/15"
          />
          <StatusRow
            label="Доставлено"
            value={stats.delivered}
            color="text-emerald-400"
            accent="from-emerald-500/15"
          />
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
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  unboxed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {unboxed ? (
        children
      ) : (
        <div className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm backdrop-blur-sm sm:p-6">
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

  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{p.name}</span>
        {hasError ? (
          <AlertCircle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          isLow && <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
        )}
      </div>
      <span
        className={cn(
          "font-mono text-xl font-semibold tabular-nums sm:text-2xl",
          hasError ? "text-destructive" : isLow ? "text-red-500" : noData ? "text-muted-foreground" : "",
        )}
      >
        {hasError ? "Ошибка" : noData ? "—" : `${balFmt.format(p.lastBalance!)} ${p.currency}`}
      </span>
      {hasError && (
        <span className="truncate text-xs text-destructive/80" title={p.lastError!}>
          {p.lastError}
        </span>
      )}
      {!hasError && isLow && (
        <span className="text-xs text-red-400">
          Порог: {balFmt.format(p.threshold)} {p.currency}
        </span>
      )}
    </>
  );

  const cls = cn(
    "flex min-h-[7rem] flex-col justify-center gap-2 rounded-xl border p-4 transition-all",
    hasError
      ? "border-destructive/40 bg-destructive/10"
      : isLow
        ? "border-red-500/40 bg-red-500/10"
        : "border-border/80 bg-muted/25 hover:border-primary/30 hover:bg-muted/40",
    url && "cursor-pointer",
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function StatusRow({
  label,
  value,
  color,
  accent,
}: {
  label: string;
  value: number;
  color: string;
  accent: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/70 bg-gradient-to-br to-transparent p-4 sm:p-5",
        accent,
      )}
    >
      <span className="text-xs leading-snug text-muted-foreground sm:text-sm">{label}</span>
      <span className={cn("text-2xl font-semibold tabular-nums sm:text-3xl", color)}>
        {numFmt.format(value)}
      </span>
    </div>
  );
}
