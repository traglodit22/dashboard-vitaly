"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  PackageCheck,
  Plus,
  Save,
  Search,
  Sparkles,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import { getCategoryDef } from "@/lib/funko/categoryConfig";
import {
  buildFunkoHref,
  DEFAULT_FUNKO_CATEGORY,
  FUNKO_CATEGORY_ORDER_CHANGED_EVENT,
  FUNKO_CHANGED_EVENT,
  notifyFunkoCategoryOrderChanged,
  notifyFunkoChanged,
  parseFunkoSearchParams,
  requestFunkoCreate,
  type FunkoFilter,
} from "@/lib/funko/funkoRoutes";
import type { FunkoCatalogStats, FunkoCategory } from "@/lib/funko/types";
import { cn } from "@/lib/utils";

function FunkoSidebarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { category, filter, q } = parseFunkoSearchParams(searchParams);

  const [search, setSearch] = useState(q);
  const [categories, setCategories] = useState<FunkoCategory[]>([]);
  const [orderDraft, setOrderDraft] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [stats, setStats] = useState<FunkoCatalogStats>({
    total: 0,
    owned: 0,
    inTransit: 0,
  });
  const [importing, setImporting] = useState(false);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [loading, setLoading] = useState(true);

  const orderedCategories = useMemo(() => {
    if (!sortMode || !orderDraft.length) return categories;
    const map = new Map(categories.map((c) => [c.slug, c]));
    const out: FunkoCategory[] = [];
    for (const slug of orderDraft) {
      const cat = map.get(slug);
      if (cat) {
        out.push(cat);
        map.delete(slug);
      }
    }
    for (const cat of categories) {
      if (map.has(cat.slug)) out.push(cat);
    }
    return out;
  }, [categories, orderDraft, sortMode]);

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/funko/categories", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setCategories(data.categories as FunkoCategory[]);
      setOrderDraft((data.order as string[]) ?? []);
    }
  }, []);

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
        await Promise.all([loadCategories(), loadStats()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCategories, loadStats]);

  useEffect(() => {
    const onChange = () => void loadStats();
    const onOrder = () => void loadCategories();
    window.addEventListener(FUNKO_CHANGED_EVENT, onChange);
    window.addEventListener(FUNKO_CATEGORY_ORDER_CHANGED_EVENT, onOrder);
    return () => {
      window.removeEventListener(FUNKO_CHANGED_EVENT, onChange);
      window.removeEventListener(FUNKO_CATEGORY_ORDER_CHANGED_EVENT, onOrder);
    };
  }, [loadStats, loadCategories]);

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
    router.push(href);
  }

  function applySearch() {
    navigate({ q: search, page: 1 });
  }

  function moveCategory(index: number, direction: -1 | 1) {
    setOrderDraft((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveCategoryOrder() {
    setSavingOrder(true);
    try {
      const res = await apiFetch("/api/funko/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка сохранения"));
      setCategories(data.categories as FunkoCategory[]);
      setOrderDraft((data.order as string[]) ?? orderDraft);
      setSortMode(false);
      notifyFunkoCategoryOrderChanged();
      toast.success("Порядок категорий сохранён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingOrder(false);
    }
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
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-1 pb-2">
      <div className="flex shrink-0 items-center justify-between px-2 pt-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          Категории
        </span>
        <button
          type="button"
          onClick={() => {
            if (sortMode) {
              void loadCategories();
              setSortMode(false);
            } else {
              setOrderDraft(categories.map((c) => c.slug));
              setSortMode(true);
            }
          }}
          className={cn(
            "rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            sortMode && "bg-primary/15 text-primary",
          )}
          aria-label={sortMode ? "Отменить сортировку" : "Сортировать категории"}
          title={sortMode ? "Отменить" : "Сортировать"}
        >
          <ArrowDownUp className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
        {loading && !categories.length ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">Загрузка…</div>
        ) : (
          orderedCategories.map((cat, index) => {
            const label = getCategoryDef(cat.slug)?.shortLabel ?? cat.name;
            const active = cat.slug === category;
            if (sortMode) {
              return (
                <div
                  key={cat.slug}
                  className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5"
                >
                  <span className="min-w-0 flex-1 truncate px-2 py-1.5 text-xs font-medium">
                    {label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={index === 0}
                    onClick={() => moveCategory(index, -1)}
                    aria-label={`Поднять «${label}»`}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={index === orderDraft.length - 1}
                    onClick={() => moveCategory(index, 1)}
                    aria-label={`Опустить «${label}»`}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>
              );
            }
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => navigate({ category: cat.slug, page: 1 })}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="truncate">{label}</span>
              </button>
            );
          })
        )}
      </div>

      {sortMode && (
        <div className="shrink-0 px-2">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full"
            disabled={savingOrder}
            onClick={() => void saveCategoryOrder()}
          >
            {savingOrder ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Сохранить порядок
          </Button>
        </div>
      )}

      <div className="shrink-0 space-y-2 border-t border-border px-2 pt-2">
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

      <div className="shrink-0 space-y-0.5 px-1">
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

      <div className="mt-auto shrink-0 space-y-1.5 border-t border-border px-2 pt-3">
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
