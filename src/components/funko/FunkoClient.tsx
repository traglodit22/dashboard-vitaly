"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Heart, Loader2, PackageCheck, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import {
  DASHBOARD_PAGE_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from "@/lib/dashboard/pageLayout";
import type { FunkoCatalogStats, FunkoCategory, FunkoItem } from "@/lib/funko/types";
import { cn } from "@/lib/utils";

type FilterMode = "all" | "owned" | "want";

export function FunkoClient() {
  const [categories, setCategories] = useState<FunkoCategory[]>([]);
  const [items, setItems] = useState<FunkoItem[]>([]);
  const [stats, setStats] = useState<FunkoCatalogStats>({ total: 0, owned: 0, want: 0 });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [categorySlug, setCategorySlug] = useState("animation");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ category: categorySlug });
    if (search.trim()) params.set("search", search.trim());
    if (filter === "owned") params.set("owned", "1");
    if (filter === "want") params.set("want", "1");

    const res = await apiFetch(`/api/funko?${params}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(String(data.error ?? "Не удалось загрузить каталог"));
    }
    setCategories(data.categories as FunkoCategory[]);
    setItems(data.items as FunkoItem[]);
    setStats(data.stats as FunkoCatalogStats);
  }, [categorySlug, filter, search]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug) ?? null,
    [categories, categorySlug],
  );

  async function handleImport(replace = false) {
    setImporting(true);
    try {
      const res = await apiFetch("/api/funko/import-animations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка импорта"));
      toast.success(String(data.message ?? `Импортировано ${data.imported}`));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  }

  async function patchItem(id: string, patch: Partial<Pick<FunkoItem, "owned" | "want">>) {
    const prev = items;
    setItems((list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

    try {
      const res = await apiFetch(`/api/funko/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка сохранения"));
      setItems((list) =>
        list.map((item) => (item.id === id ? (data.item as FunkoItem) : item)),
      );
      const nextStats = await apiFetch(`/api/funko?category=${categorySlug}`).then((r) =>
        r.json(),
      );
      setStats(nextStats.stats as FunkoCatalogStats);
    } catch (err) {
      setItems(prev);
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    }
  }

  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Funko</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Каталог коллекции Funko Pop
            {activeCategory ? ` · ${activeCategory.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatPill label="Всего" value={stats.total} />
          <StatPill label="Есть" value={stats.owned} icon={PackageCheck} />
          <StatPill label="Хочу" value={stats.want} icon={Heart} />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["all", "Все"],
              ["owned", "Есть"],
              ["want", "Хочу"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
          {stats.total === 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={importing}
              onClick={() => void handleImport(false)}
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Импорт Animation
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : stats.total === 0 ? (
        <EmptyCatalog importing={importing} onImport={() => void handleImport(false)} />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Ничего не найдено по текущему фильтру
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <FunkoCard key={item.id} item={item} onPatch={patchItem} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 tabular-nums">
      {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function EmptyCatalog({
  importing,
  onImport,
}: {
  importing: boolean;
  onImport: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Sparkles className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">Каталог пуст</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Импортируйте ~1150 фигурок из категории Pop! Animation (данные hobbydb /
          kennymkchan/funko-pop-data).
        </p>
      </div>
      <Button type="button" disabled={importing} onClick={onImport}>
        {importing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Импортировать Pop! Animation
      </Button>
    </div>
  );
}

function FunkoCard({
  item,
  onPatch,
}: {
  item: FunkoItem;
  onPatch: (id: string, patch: Partial<Pick<FunkoItem, "owned" | "want">>) => void;
}) {
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-colors",
        item.owned && "ring-1 ring-emerald-500/40",
        item.want && !item.owned && "ring-1 ring-rose-500/30",
      )}
    >
      <div className="relative aspect-square bg-muted/30">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="size-full object-contain p-1"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            Нет фото
          </div>
        )}
        {item.popNumber != null && (
          <Badge className="absolute top-1.5 right-1.5 tabular-nums" variant="secondary">
            #{item.popNumber}
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-xs leading-snug font-medium">
          {item.title}
        </h3>
        <div className="mt-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={item.owned ? "default" : "outline"}
            className="h-7 flex-1 px-1 text-xs"
            onClick={() => onPatch(item.id, { owned: !item.owned })}
          >
            <PackageCheck className="size-3" />
            Есть
          </Button>
          <Button
            type="button"
            size="sm"
            variant={item.want ? "default" : "outline"}
            className="h-7 flex-1 px-1 text-xs"
            onClick={() => onPatch(item.id, { want: !item.want })}
          >
            <Heart className="size-3" />
            Хочу
          </Button>
        </div>
      </div>
    </article>
  );
}
