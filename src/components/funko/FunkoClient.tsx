"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Loader2,
  MessageSquare,
  PackageCheck,
  Search,
  Sparkles,
  Truck,
} from "lucide-react";
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

type FilterMode = "all" | "owned" | "inTransit";

type ItemPatch = Partial<
  Pick<FunkoItem, "owned" | "inTransit" | "notes">
>;

export function FunkoClient() {
  const [categories, setCategories] = useState<FunkoCategory[]>([]);
  const [items, setItems] = useState<FunkoItem[]>([]);
  const [stats, setStats] = useState<FunkoCatalogStats>({
    total: 0,
    owned: 0,
    inTransit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const categorySlug = "animation";

  const load = useCallback(async () => {
    const params = new URLSearchParams({ category: categorySlug });
    if (search.trim()) params.set("search", search.trim());
    if (filter === "owned") params.set("owned", "1");
    if (filter === "inTransit") params.set("inTransit", "1");

    const res = await apiFetch(`/api/funko?${params}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(String(data.error ?? "Не удалось загрузить каталог"));
    }
    setCategories(data.categories as FunkoCategory[]);
    setItems(data.items as FunkoItem[]);
    setStats(data.stats as FunkoCatalogStats);
  }, [filter, search]);

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
    [categories],
  );

  async function handleImportCollection() {
    setImporting(true);
    try {
      const res = await apiFetch("/api/funko/import-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  async function patchItem(id: string, patch: ItemPatch) {
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
      const nextStats = await apiFetch(`/api/funko?category=${categorySlug}`).then(
        (r) => r.json(),
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
            Коллекция Funko Pop
            {activeCategory ? ` · ${activeCategory.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatPill label="Всего" value={stats.total} />
          <StatPill label="Есть" value={stats.owned} icon={PackageCheck} />
          <StatPill label="В пути" value={stats.inTransit} icon={Truck} />
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
              ["inTransit", "В пути"],
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={importing}
            onClick={() => void handleImportCollection()}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Импорт из PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : stats.total === 0 ? (
        <EmptyCatalog importing={importing} onImport={() => void handleImportCollection()} />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Ничего не найдено по текущему фильтру
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
        <p className="font-medium">Коллекция пуста</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Импортируйте 368 фигурок Animation из PDF (стр. 2) — статусы «Есть» /
          «В пути», комментарии и дубли подтянутся автоматически.
        </p>
      </div>
      <Button type="button" disabled={importing} onClick={onImport}>
        {importing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Импорт из PDF
      </Button>
    </div>
  );
}

function FunkoCard({
  item,
  onPatch,
}: {
  item: FunkoItem;
  onPatch: (id: string, patch: ItemPatch) => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(item.notes ?? "");
  }, [item.notes]);

  async function saveNotes() {
    const trimmed = notes.trim();
    if (trimmed === (item.notes ?? "")) return;
    setSavingNotes(true);
    try {
      await onPatch(item.id, { notes: trimmed || null });
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <article
      className={cn(
        "flex gap-3 overflow-hidden rounded-lg border bg-card p-2 shadow-sm transition-colors sm:flex-col sm:gap-0 sm:p-0",
        item.owned && "ring-1 ring-emerald-500/40",
        item.inTransit && !item.owned && "ring-1 ring-amber-500/30",
      )}
    >
      <div className="relative size-20 shrink-0 bg-muted/30 sm:aspect-square sm:size-auto sm:w-full">
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
          <Badge className="absolute top-1 right-1 tabular-nums" variant="secondary">
            #{item.popNumber}
          </Badge>
        )}
        {item.hasDuplicates && (
          <Badge className="absolute bottom-1 left-1 text-[10px]" variant="destructive">
            есть дубли
            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </Badge>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:p-2">
        <h3 className="line-clamp-2 text-xs leading-snug font-medium">{item.title}</h3>

        <div className="relative">
          <MessageSquare className="pointer-events-none absolute top-2 left-2 size-3 text-muted-foreground" />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void saveNotes()}
            placeholder="Комментарий…"
            rows={2}
            disabled={savingNotes}
            className={cn(
              "w-full resize-none rounded-md border border-input bg-background py-1.5 pr-2 pl-7 text-xs",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          />
        </div>

        <div className="mt-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={item.owned ? "default" : "outline"}
            className="h-7 flex-1 px-1 text-xs"
            onClick={() =>
              onPatch(item.id, {
                owned: !item.owned,
                inTransit: item.owned ? item.inTransit : false,
              })
            }
          >
            <PackageCheck className="size-3" />
            Есть
          </Button>
          <Button
            type="button"
            size="sm"
            variant={item.inTransit ? "default" : "outline"}
            className="h-7 flex-1 px-1 text-xs"
            onClick={() =>
              onPatch(item.id, {
                inTransit: !item.inTransit,
                owned: item.inTransit ? item.owned : false,
              })
            }
          >
            <Truck className="size-3" />
            В пути
          </Button>
        </div>
      </div>
    </article>
  );
}
