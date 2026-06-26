"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  MessageSquare,
  PackageCheck,
  Pencil,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FunkoImagePicker } from "@/components/funko/FunkoImagePicker";
import { FunkoItemDialog } from "@/components/funko/FunkoItemDialog";
import { FunkoMobileDrawer, FunkoMobileNavButton } from "@/components/funko/FunkoMobileDrawer";
import { apiFetch } from "@/lib/apiFetch";
import {
  buildFunkoHref,
  DEFAULT_FUNKO_CATEGORY,
  FUNKO_CHANGED_EVENT,
  FUNKO_CREATE_EVENT,
  isAllFunkoCategorySlug,
  notifyFunkoChanged,
  parseFunkoSearchParams,
  type FunkoSort,
} from "@/lib/funko/funkoRoutes";
import { FUNKO_SORT_OPTIONS } from "@/lib/funko/funkoSort";
import { getFunkoCategoryDisplayName } from "@/lib/funko/categoryConfig";
import {
  DASHBOARD_PAGE_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from "@/lib/dashboard/pageLayout";
import type { FunkoCatalogStats, FunkoItem } from "@/lib/funko/types";
import { cn } from "@/lib/utils";

type ItemPatch = Partial<Pick<FunkoItem, "owned" | "inTransit" | "notes">>;

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function FunkoClientInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { category, filter, page, q, sort } = parseFunkoSearchParams(searchParams);
  const categoryLabel = getFunkoCategoryDisplayName(category);
  const createCategorySlug = isAllFunkoCategorySlug(category)
    ? DEFAULT_FUNKO_CATEGORY
    : category;

  const [items, setItems] = useState<FunkoItem[]>([]);
  const [stats, setStats] = useState<FunkoCatalogStats>({
    total: 0,
    owned: 0,
    inTransit: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    pageSize: 24,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<FunkoItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pickerItem, setPickerItem] = useState<FunkoItem | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === q.trim()) return;

    const timer = window.setTimeout(() => {
      router.replace(buildFunkoHref({ category, filter, page: 1, q: searchInput, sort }));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput, category, filter, q, sort, router]);

  useEffect(() => {
    if (!searchParams.get("filter")) {
      router.replace(buildFunkoHref({ category, filter: "owned", page: 1, q, sort }));
    }
  }, [router, searchParams, category, q, sort]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      category,
      filter,
      page: String(page),
      sort,
    });
    if (q.trim()) params.set("q", q.trim());

    const res = await apiFetch(`/api/funko?${params}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(String(data.error ?? "Не удалось загрузить каталог"));
    }
    setItems(data.items as FunkoItem[]);
    setStats(data.stats as FunkoCatalogStats);
    setPagination(data.pagination as Pagination);
  }, [category, filter, page, q, sort]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(FUNKO_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FUNKO_CHANGED_EVENT, onChange);
  }, [load]);

  useEffect(() => {
    const onCreate = () => {
      setEditItem(null);
      setEditorOpen(true);
    };
    window.addEventListener(FUNKO_CREATE_EVENT, onCreate);
    return () => window.removeEventListener(FUNKO_CREATE_EVENT, onCreate);
  }, []);

  function goToPage(nextPage: number) {
    router.push(buildFunkoHref({ category, filter, page: nextPage, q, sort }));
  }

  function setSort(nextSort: FunkoSort) {
    router.push(buildFunkoHref({ category, filter, page: 1, q, sort: nextSort }));
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
      notifyFunkoChanged();
    } catch (err) {
      setItems(prev);
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    }
  }

  async function deleteItem(item: FunkoItem) {
    if (!window.confirm(`Удалить «${item.title}»?`)) return;
    try {
      const res = await apiFetch(`/api/funko/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка удаления"));
      toast.success("Удалено");
      notifyFunkoChanged();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка удаления");
    }
  }

  function onItemSaved() {
    notifyFunkoChanged();
    void load();
  }

  const filterLabel =
    filter === "owned" ? "Есть" : filter === "inTransit" ? "В пути" : "Все";

  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <FunkoMobileDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FunkoMobileNavButton onClick={() => setNavOpen(true)} />
            <div className="min-w-0">
              <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Funko</h1>
              <p className="text-sm text-muted-foreground">
                {categoryLabel} · {filterLabel}
                {q.trim() ? ` · «${q.trim()}»` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="relative w-full shrink-0 sm:w-64 lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="№ или название…"
            className="h-9 pl-9 text-sm"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : stats.total === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {category === "animation"
            ? "Коллекция пуста — импортируйте PDF через «Категории»"
            : "Каталог пуст — импортируйте каталог через «Категории»"}
        </p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Ничего не найдено
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Сортировка</span>
              <Select
                value={sort}
                onValueChange={(v) => {
                  if (v) setSort(v as FunkoSort);
                }}
              >
                <SelectTrigger size="sm" className="h-8 w-full min-w-[10rem] sm:w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNKO_SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              {items.length} из {pagination.total}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <FunkoCard
                key={item.id}
                item={item}
                showCategory={isAllFunkoCategorySlug(category)}
                onPatch={patchItem}
                onEdit={() => {
                  setEditItem(item);
                  setEditorOpen(true);
                }}
                onDelete={() => void deleteItem(item)}
                onPickImage={() => setPickerItem(item)}
              />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {pagination.page} / {pagination.totalPages}
                <span className="hidden sm:inline"> · {pagination.total} шт.</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= pagination.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <FunkoItemDialog
        open={editorOpen}
        item={editItem}
        categorySlug={createCategorySlug}
        onClose={() => setEditorOpen(false)}
        onSaved={() => onItemSaved()}
      />

      <FunkoImagePicker
        open={Boolean(pickerItem)}
        item={pickerItem}
        onClose={() => setPickerItem(null)}
        onSaved={(updated) => {
          setItems((list) =>
            list.map((i) => (i.id === updated.id ? updated : i)),
          );
          notifyFunkoChanged();
        }}
      />
    </div>
  );
}

export function FunkoClient() {
  return (
    <Suspense
      fallback={
        <div className={DASHBOARD_PAGE_CLASS}>
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <FunkoClientInner />
    </Suspense>
  );
}

function FunkoCard({
  item,
  showCategory,
  onPatch,
  onEdit,
  onDelete,
  onPickImage,
}: {
  item: FunkoItem;
  showCategory?: boolean;
  onPatch: (id: string, patch: ItemPatch) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPickImage: () => void;
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
        "flex flex-col overflow-hidden rounded-lg border shadow-sm",
        item.owned &&
          "border-emerald-300/90 bg-emerald-100 dark:border-emerald-700/70 dark:bg-emerald-900/50",
        item.inTransit &&
          !item.owned &&
          "border-amber-300/90 bg-amber-100 dark:border-amber-700/70 dark:bg-amber-900/50",
        !item.owned && !item.inTransit && "bg-card",
      )}
    >
      <div className="relative aspect-square bg-muted/30">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            loading="lazy"
            className="size-full object-contain p-2"
            referrerPolicy="no-referrer"
          />
        ) : (
          <button
            type="button"
            onClick={onPickImage}
            className="flex size-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:bg-muted/50"
          >
            <ImageIcon className="size-6 opacity-50" />
            Добавить фото
          </button>
        )}
        {item.popNumber != null && (
          <Badge className="absolute top-1.5 left-1.5 tabular-nums text-xs font-semibold" variant="default">
            №{item.popNumber}
          </Badge>
        )}
        {item.hasDuplicates && (
          <Badge className="absolute top-1.5 right-1.5 text-[10px]" variant="destructive">
            дубли{item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </Badge>
        )}
        <div className="absolute right-1.5 bottom-1.5 flex gap-0.5">
          <IconBtn label="Редактировать" onClick={onEdit}>
            <Pencil className="size-3" />
          </IconBtn>
          <IconBtn label="Подобрать фото" onClick={onPickImage}>
            <ImageIcon className="size-3" />
          </IconBtn>
          <IconBtn label="Удалить" onClick={onDelete} destructive>
            <Trash2 className="size-3" />
          </IconBtn>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {showCategory && (
          <p className="truncate text-[10px] font-medium text-muted-foreground">
            {item.categoryName}
          </p>
        )}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-xs leading-snug font-medium">
          {item.popNumber != null && (
            <span className="mr-1 font-semibold text-primary tabular-nums">
              №{item.popNumber}
            </span>
          )}
          {item.title}
        </h3>

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

function IconBtn({
  children,
  label,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-md bg-background/90 p-1.5 shadow-sm backdrop-blur transition-colors hover:bg-accent",
        destructive && "hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}
