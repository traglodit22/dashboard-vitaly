"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Loader2,
  PackageCheck,
  Plus,
  Search,
  Sparkles,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import {
  buildFunkoHref,
  DEFAULT_FUNKO_CATEGORY,
  FUNKO_CHANGED_EVENT,
  notifyFunkoChanged,
  parseFunkoSearchParams,
  requestFunkoCreate,
  type FunkoFilter,
} from "@/lib/funko/funkoRoutes";
import type { FunkoCatalogStats } from "@/lib/funko/types";
import { cn } from "@/lib/utils";

function FunkoSidebarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { category, filter, q } = parseFunkoSearchParams(searchParams);

  const [search, setSearch] = useState(q);
  const [stats, setStats] = useState<FunkoCatalogStats>({
    total: 0,
    owned: 0,
    inTransit: 0,
  });
  const [importing, setImporting] = useState(false);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    const res = await apiFetch(
      `/api/funko?category=${encodeURIComponent(category)}&page=1&pageSize=1`,
      { cache: "no-store" },
    );
    const data = await res.json();
    if (res.ok) setStats(data.stats as FunkoCatalogStats);
  }, [category]);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    void (async () => {
      try {
        await loadStats();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStats]);

  useEffect(() => {
    const onChange = () => void loadStats();
    window.addEventListener(FUNKO_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FUNKO_CHANGED_EVENT, onChange);
  }, [loadStats]);

  function navigate(opts: {
    category?: string;
    filter?: FunkoFilter;
    page?: number;
    q?: string;
  }) {
    const href = buildFunkoHref({
      category: opts.category ?? category,
      filter: opts.filter ?? filter,
      page: opts.page ?? 1,
      q: opts.q !== undefined ? opts.q : q,
    });
    if (pathname !== "/funko") {
      router.push(href);
      return;
    }
    router.push(href);
  }

  function applySearch() {
    navigate({ q: search, page: 1 });
  }

  async function handleImportCollection() {
    if (category !== DEFAULT_FUNKO_CATEGORY) {
      toast.error("Импорт PDF доступен только для Animation");
      return;
    }
    setImporting(true);
    try {
      const res = await apiFetch("/api/funko/import-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка импорта"));
      toast.success(String(data.message ?? "Импорт завершён"));
      notifyFunkoChanged();
      navigate({ filter: "owned", page: 1 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  }

  async function handleImportCatalog() {
    setImportingCatalog(true);
    try {
      const res = await apiFetch("/api/funko/import-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlug: category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка импорта"));
      toast.success(String(data.message ?? "Каталог импортирован"));
      notifyFunkoChanged();
      navigate({ filter: "all", page: 1 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setImportingCatalog(false);
    }
  }

  const filters: { key: FunkoFilter; label: string; icon: typeof PackageCheck; count: number }[] = [
    { key: "owned", label: "Есть", icon: PackageCheck, count: stats.owned },
    { key: "inTransit", label: "В пути", icon: Truck, count: stats.inTransit },
    { key: "all", label: "Все", icon: Sparkles, count: stats.total },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2">
      <div className="space-y-2 px-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder="Поиск…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full"
          onClick={applySearch}
        >
          Найти
        </Button>
      </div>

      <div className="space-y-0.5 px-1">
        {filters.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate({ filter: key, page: 1 })}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
              filter === key
                ? "bg-primary/15 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <Icon className="size-4 shrink-0" />
              {label}
            </span>
            <span className="tabular-nums text-xs opacity-80">
              {loading ? "…" : count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-auto space-y-1.5 border-t border-border px-2 pt-3">
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => requestFunkoCreate()}
        >
          <Plus className="size-4" />
          Новая позиция
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          disabled={importingCatalog}
          onClick={() => void handleImportCatalog()}
        >
          {importingCatalog ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Импорт каталога
        </Button>
        {category === DEFAULT_FUNKO_CATEGORY && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={importing}
            onClick={() => void handleImportCollection()}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Импорт PDF
          </Button>
        )}
      </div>
    </div>
  );
}

export function FunkoSidebar() {
  return (
    <Suspense fallback={<div className="p-3 text-xs text-muted-foreground">Загрузка…</div>}>
      <FunkoSidebarInner />
    </Suspense>
  );
}
