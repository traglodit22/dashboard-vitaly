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
import { toast } from "sonner";
import { filesCategoryPath, FILES_CHANGED_EVENT } from "@/lib/files/routes";
import { CLOUD_SLUG } from "@/lib/files/types";

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
  try { return new URL(p.apiUrl).origin; } catch { return ""; }
}

const numFmt = new Intl.NumberFormat("ru-RU");
const decFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const balFmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DashboardHome() {
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
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAll]);

  useEffect(() => {
    const onChange = () => void loadAll();
    window.addEventListener(FILES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, onChange);
  }, [loadAll]);

  async function refreshBalances() {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/balances/check", { method: "POST" });
      const data = await res.json();
      await loadAll();
      if (data.low?.length > 0) {
        toast.warning(`Низкий баланс у ${data.low.length} панелей`);
      } else {
        toast.success(`Балансы обновлены`);
      }
    } catch {
      toast.error("Не удалось обновить балансы");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Загрузка…
      </div>
    );
  }

  if (!stats) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Не удалось загрузить статистику.</p>;
  }

  const cards = [
    { label: "Всего заказов",  value: numFmt.format(stats.total),                   icon: Package,      highlight: false, color: "" },
    { label: "На складе",      value: numFmt.format(stats.onWarehouse),              icon: Warehouse,    highlight: true,  color: "text-sky-400" },
    { label: "В пути",         value: numFmt.format(stats.inTransit),                icon: Truck,        highlight: true,  color: "text-amber-400" },
    { label: "Доставлено",     value: numFmt.format(stats.delivered),                icon: CheckCircle2, highlight: false, color: "text-emerald-400" },
    { label: "Ожидают трек",   value: numFmt.format(stats.awaitingTrack),            icon: Clock,        highlight: false, color: "text-muted-foreground" },
    { label: "Общий вес",      value: `${decFmt.format(stats.totalWeightKg)} кг`,    icon: Scale,        highlight: false, color: "text-muted-foreground" },
    { label: "Сумма заказов",  value: `¥${decFmt.format(stats.totalValueCny)}`,      icon: DollarSign,   highlight: false, color: "text-muted-foreground" },
  ] as const;

  return (
    <div className="space-y-6 sm:space-y-8">

      {favoriteFolders.length > 0 && (
        <Card>
          <CardContent className="py-4 sm:py-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                Быстрый доступ к файлам
              </p>
              <Link
                href={filesCategoryPath(CLOUD_SLUG)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Все файлы →
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {favoriteFolders.map((folder) => (
                <Link
                  key={folder.id}
                  href={filesCategoryPath(folder.categorySlug, folder.id)}
                  className="flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 sm:px-3 sm:text-sm"
                  title={folder.name}
                >
                  <Folder className="size-3.5 shrink-0 text-amber-500" />
                  <span className="truncate">{folder.name}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balances — top */}
      {balances.length > 0 && (
        <Card>
          <CardContent className="py-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="size-4 text-primary" />
                Балансы панелей
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={refreshBalances}
                disabled={refreshing}
              >
                {refreshing
                  ? <Loader2 className="size-4 animate-spin" />
                  : <RefreshCw className="size-4" />}
                Обновить все
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {balances.map((p) => {
                const isLow = p.lastBalance !== null && p.lastBalance < p.threshold;
                const hasError = Boolean(p.lastError);
                const noData = p.lastBalance === null && !hasError;
                const url = effectivePanelUrl(p);
                const inner = (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs text-muted-foreground">{p.name}</span>
                      {hasError
                        ? <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                        : isLow && <AlertTriangle className="size-3.5 shrink-0 text-red-500" />}
                    </div>
                    <span className={cn(
                      "font-mono text-lg font-semibold tabular-nums",
                      hasError ? "text-destructive" : isLow ? "text-red-500" : noData ? "text-muted-foreground" : "",
                    )}>
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
                  "flex flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                  hasError ? "border-destructive/40 bg-destructive/10"
                    : isLow ? "border-red-500/40 bg-red-500/10"
                    : "border-border bg-muted/30",
                  url && "cursor-pointer hover:border-primary/40",
                );
                return url ? (
                  <a key={p.id} href={url} target="_blank" rel="noopener noreferrer" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <div key={p.id} className={cls}>{inner}</div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, highlight, color }) => (
          <Card key={label} className={cn("transition-colors", highlight && "ring-primary/30 bg-primary/5")}>
            <CardContent className="flex flex-col gap-3 py-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={cn("size-4 shrink-0", color || "text-primary")} />
                <span>{label}</span>
              </div>
              <p className={cn("text-2xl font-semibold tabular-nums leading-none", color && color !== "text-muted-foreground" ? color : "")}>
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick status breakdown */}
      <Card>
        <CardContent className="py-5">
          <p className="mb-4 text-sm font-medium">Быстрый срез по статусам</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatusRow label="Отправлено в ДоброПост" value={stats.sentTotal}    color="text-emerald-400" />
            <StatusRow label="Ожидают трек-код"       value={stats.awaitingTrack} color="text-amber-400" />
            <StatusRow label="На складе"              value={stats.onWarehouse}   color="text-sky-400" />
            <StatusRow label="Доставлено"             value={stats.delivered}     color="text-emerald-400" />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function StatusRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-semibold tabular-nums", color)}>
        {new Intl.NumberFormat("ru-RU").format(value)}
      </span>
    </div>
  );
}
