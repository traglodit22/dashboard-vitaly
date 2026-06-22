"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  ExternalLink,
  Search,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { reorderById } from "@/lib/procurement/reorderList";
import {
  effectiveRowHighlight,
  ROW_HIGHLIGHT_CLASS,
  ROW_HIGHLIGHT_LABEL,
  type RowHighlight,
} from "@/lib/procurement/rowHighlight";
import type { ProcurementCategory, ProcurementItem } from "@/lib/procurement/mapRow";

const ROW_SWATCH: Record<RowHighlight, string> = {
  red: "bg-red-500 border-red-600",
  yellow: "bg-amber-400 border-amber-500",
  green: "bg-emerald-500 border-emerald-600",
};

export function ProcurementClient() {
  const [categories, setCategories] = useState<ProcurementCategory[]>([]);
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    groupName: "",
    name: "",
    needQty: "0",
    haveQty: "0",
    inTransitQty: "0",
    notes: "",
    link: "",
  });

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/procurement/categories", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Не удалось загрузить закупки", { description: data.error });
      return [];
    }
    const list: ProcurementCategory[] = data.categories ?? [];
    setCategories(list);
    setCategoryId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      return list[0]?.id ?? "";
    });
    return list;
  }, []);

  const loadItems = useCallback(async (catId: string) => {
    if (!catId) {
      setItems([]);
      return;
    }
    const res = await apiFetch(`/api/procurement/items?categoryId=${catId}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    loadCategories().finally(() => setLoading(false));
  }, [loadCategories]);

  useEffect(() => {
    if (categoryId) loadItems(categoryId);
  }, [categoryId, loadItems]);

  const searchActive = search.trim().length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.groupName?.toLowerCase().includes(q) ?? false) ||
        (i.notes?.toLowerCase().includes(q) ?? false) ||
        (i.link?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  const sortedItems = useMemo(
    () => [...filtered].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru")),
    [filtered],
  );

  const stats = useMemo(() => {
    let need = 0;
    let have = 0;
    let transit = 0;
    let open = 0;
    for (const i of items) {
      need += i.needQty;
      have += i.haveQty;
      transit += i.inTransitQty;
      if (i.remaining > 0) open += 1;
    }
    return { need, have, transit, open, total: items.length };
  }, [items]);

  async function patchItem(id: string, patch: Partial<ProcurementItem>) {
    const res = await apiFetch(`/api/procurement/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error("Не удалось сохранить");
      return false;
    }
    const data = await res.json();
    setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
    return true;
  }

  async function removeItem(id: string, name: string) {
    const res = await apiFetch(`/api/procurement/items/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Удалено", { description: name });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      toast.error("Не удалось удалить");
    }
  }

  async function persistCategoryOrder(next: ProcurementCategory[]) {
    const res = await apiFetch("/api/procurement/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((c) => c.id) }),
    });
    if (!res.ok) {
      toast.error("Не удалось сохранить порядок категорий");
      loadCategories();
    }
  }

  async function persistItemOrder(next: ProcurementItem[]) {
    const res = await apiFetch("/api/procurement/items/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((i) => i.id) }),
    });
    if (!res.ok) {
      toast.error("Не удалось сохранить порядок позиций");
      if (categoryId) loadItems(categoryId);
      return;
    }
    const sortMap = new Map(next.map((item, i) => [item.id, (i + 1) * 10]));
    setItems((prev) =>
      prev.map((item) =>
        sortMap.has(item.id) ? { ...item, sortOrder: sortMap.get(item.id)! } : item,
      ),
    );
  }

  function onCategoryDrop(targetId: string) {
    if (!dragCatId || dragCatId === targetId) return;
    const next = reorderById(categories, dragCatId, targetId);
    setCategories(next);
    setDragCatId(null);
    persistCategoryOrder(next);
  }

  function onItemDrop(targetId: string) {
    if (!dragItemId || dragItemId === targetId || searchActive) return;
    const next = reorderById(sortedItems, dragItemId, targetId);
    setDragItemId(null);
    persistItemOrder(next);
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const res = await apiFetch("/api/procurement/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error("Не удалось создать категорию");
      return;
    }
    const data = await res.json();
    setNewCategoryName("");
    setCategories((prev) => [...prev, data.category]);
    setCategoryId(data.category.id);
    toast.success("Категория создана", { description: name });
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !draft.name.trim()) return;
    const res = await apiFetch("/api/procurement/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        groupName: draft.groupName.trim() || null,
        name: draft.name.trim(),
        needQty: Number(draft.needQty) || 0,
        haveQty: Number(draft.haveQty) || 0,
        inTransitQty: Number(draft.inTransitQty) || 0,
        notes: draft.notes.trim() || null,
        link: draft.link.trim() || null,
      }),
    });
    if (!res.ok) {
      toast.error("Не удалось добавить позицию");
      return;
    }
    const data = await res.json();
    setItems((prev) => [...prev, data.item]);
    setDraft({
      groupName: draft.groupName,
      name: "",
      needQty: "0",
      haveQty: "0",
      inTransitQty: "0",
      notes: "",
      link: "",
    });
    setShowAdd(false);
    toast.success("Позиция добавлена");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Категории — перетащите для сортировки, кликните для выбора
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              draggable={categories.length > 1}
              onDragStart={() => setDragCatId(c.id)}
              onDragEnd={() => setDragCatId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                onCategoryDrop(c.id);
              }}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                categoryId === c.id
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border bg-background hover:bg-muted/50",
                dragCatId === c.id && "opacity-50",
              )}
            >
              <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
              {c.name}
            </button>
          ))}
          {categories.length === 0 && (
            <span className="text-sm text-muted-foreground">Нет категорий</span>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            placeholder="Новая категория"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" onClick={addCategory}>
            <Plus className="mr-1 size-4" />
            Категория
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Позиций", value: stats.total },
          { label: "Надо (сумма)", value: stats.need },
          { label: "Есть + едут", value: stats.have + stats.transit },
          { label: "Не закрыто", value: stats.open },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию, группе, заметке, ссылке…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="button" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="mr-1 size-4" />
          Позиция
        </Button>
      </div>

      {searchActive && (
        <p className="text-xs text-muted-foreground">
          Сортировка перетаскиванием отключена при активном поиске.
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["red", "yellow", "green"] as const).map((c) => (
          <span key={c} className="inline-flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full border", ROW_SWATCH[c])} />
            {ROW_HIGHLIGHT_LABEL[c]}
          </span>
        ))}
        <span>— клик по кружку в строке задаёт цвет вручную (повторный клик — авто)</span>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Новая позиция</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Группа</Label>
                <Input
                  value={draft.groupName}
                  onChange={(e) => setDraft((d) => ({ ...d, groupName: e.target.value }))}
                  placeholder="Постельное и текстиль"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Название</Label>
                <Input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Надо</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.needQty}
                  onChange={(e) => setDraft((d) => ({ ...d, needQty: e.target.value }))}
                />
              </div>
              <div>
                <Label>Есть</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.haveQty}
                  onChange={(e) => setDraft((d) => ({ ...d, haveQty: e.target.value }))}
                />
              </div>
              <div>
                <Label>Едут</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.inTransitQty}
                  onChange={(e) => setDraft((d) => ({ ...d, inTransitQty: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Ссылка</Label>
                <Input
                  value={draft.link}
                  onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Заметка</Label>
                <Input
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit">Добавить</Button>
                <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="min-w-0 overflow-visible">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="size-5 text-primary" />
            {categories.find((c) => c.id === categoryId)?.name ?? "Закупки"}
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {sortedItems.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 overflow-x-auto p-0">
          {sortedItems.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "Нет позиций в этой категории."
                : "Ничего не найдено по запросу."}
            </p>
          ) : (
            <Table className="w-full min-w-[720px] table-fixed">
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="hidden md:table-column md:w-[11%]" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-16" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-10" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Название</TableHead>
                  <TableHead className="hidden md:table-cell">Группа</TableHead>
                  <TableHead className="text-right">Надо</TableHead>
                  <TableHead className="text-right">Есть</TableHead>
                  <TableHead className="text-right">Едут</TableHead>
                  <TableHead className="text-right">Осталось</TableHead>
                  <TableHead>Ссылка</TableHead>
                  <TableHead>Заметка</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    draggable={!searchActive}
                    dragging={dragItemId === item.id}
                    onDragStart={() => setDragItemId(item.id)}
                    onDragEnd={() => setDragItemId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      onItemDrop(item.id);
                    }}
                    onPatch={patchItem}
                    onRemove={removeItem}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemRow({
  item,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onPatch,
  onRemove,
}: {
  item: ProcurementItem;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onPatch: (id: string, patch: Partial<ProcurementItem>) => Promise<boolean>;
  onRemove: (id: string, name: string) => void;
}) {
  const [need, setNeed] = useState(String(item.needQty));
  const [have, setHave] = useState(String(item.haveQty));
  const [transit, setTransit] = useState(String(item.inTransitQty));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [link, setLink] = useState(item.link ?? "");

  useEffect(() => {
    setNeed(String(item.needQty));
    setHave(String(item.haveQty));
    setTransit(String(item.inTransitQty));
    setNotes(item.notes ?? "");
    setLink(item.link ?? "");
  }, [item]);

  const remaining =
    (Number(need) || 0) - (Number(have) || 0) - (Number(transit) || 0);

  async function saveQty() {
    await onPatch(item.id, {
      needQty: Number(need) || 0,
      haveQty: Number(have) || 0,
      inTransitQty: Number(transit) || 0,
    });
  }

  async function saveNotes() {
    if (notes === (item.notes ?? "")) return;
    await onPatch(item.id, { notes: notes || null });
  }

  async function saveLink() {
    if (link === (item.link ?? "")) return;
    await onPatch(item.id, { link: link.trim() || null });
  }

  const linkHref = link.trim();

  const liveHighlight = effectiveRowHighlight({
    ...item,
    needQty: Number(need) || 0,
    haveQty: Number(have) || 0,
    inTransitQty: Number(transit) || 0,
    remaining,
  });

  async function setHighlight(color: RowHighlight) {
    const next = item.highlightColor === color ? null : color;
    await onPatch(item.id, { highlightColor: next });
  }

  return (
    <TableRow
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
      className={cn(
        dragging && "opacity-50",
        liveHighlight && ROW_HIGHLIGHT_CLASS[liveHighlight],
      )}
    >
      <TableCell className="w-12 px-2">
        <div className="flex items-center gap-1.5">
          {draggable && (
            <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
          )}
          <div className="flex flex-col gap-1">
            {(["red", "yellow", "green"] as const).map((c) => (
              <button
                key={c}
                type="button"
                title={ROW_HIGHLIGHT_LABEL[c]}
                onClick={() => setHighlight(c)}
                className={cn(
                  "size-3.5 rounded-full border-2 transition-transform hover:scale-110",
                  ROW_SWATCH[c],
                  item.highlightColor === c && "ring-2 ring-foreground ring-offset-1",
                  item.highlightColor === null &&
                    liveHighlight === c &&
                    "ring-1 ring-muted-foreground",
                )}
              />
            ))}
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="line-clamp-2 font-medium leading-snug">{item.name}</div>
      </TableCell>
      <TableCell className="hidden whitespace-normal text-xs text-muted-foreground md:table-cell">
        <span className="line-clamp-2">{item.groupName ?? "—"}</span>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          className="h-8 w-full min-w-0 text-right tabular-nums"
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          className="h-8 w-full min-w-0 text-right tabular-nums"
          value={have}
          onChange={(e) => setHave(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          className="h-8 w-full min-w-0 text-right tabular-nums"
          value={transit}
          onChange={(e) => setTransit(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono tabular-nums",
          remaining > 0 ? "font-semibold text-destructive" : "text-emerald-600",
        )}
      >
        {remaining}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex min-w-0 items-center gap-1">
          <Input
            className="h-8 min-w-0 flex-1 text-xs"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={saveLink}
            placeholder="https://…"
          />
          {linkHref && /^https?:\/\//i.test(linkHref) && (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-primary hover:text-primary/80"
              title="Открыть ссылку"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <Input
          className="h-8 w-full min-w-0 text-xs"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.id, item.name)}
          title="Удалить"
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
