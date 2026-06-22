"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  Search,
  GripVertical,
  Pencil,
  ImageIcon,
  Copy,
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

const QTY_INPUT =
  "h-8 w-[4.5rem] min-w-[4.5rem] shrink-0 px-1.5 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function buildTypeByItemId(items: ProcurementItem[]): Map<string, string | null> {
  const sorted = [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"),
  );
  const map = new Map<string, string | null>();
  let currentType: string | null = null;
  for (const row of sorted) {
    if (row.rowType === "type") {
      currentType = row.name;
    } else {
      map.set(row.id, currentType);
    }
  }
  return map;
}

export function ProcurementClient() {
  const [categories, setCategories] = useState<ProcurementCategory[]>([]);
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [typeDraftName, setTypeDraftName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    needQty: "0",
    haveQty: "0",
    inTransitQty: "0",
    notes: "",
    link: "",
    linkLabel: "",
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

  const typeByItemId = useMemo(() => buildTypeByItemId(items), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      if (i.rowType === "type") {
        return i.name.toLowerCase().includes(q);
      }
      const typeName = typeByItemId.get(i.id);
      return (
        i.name.toLowerCase().includes(q) ||
        (typeName?.toLowerCase().includes(q) ?? false) ||
        (i.notes?.toLowerCase().includes(q) ?? false) ||
        (i.link?.toLowerCase().includes(q) ?? false) ||
        (i.linkLabel?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, typeByItemId]);

  const sortedItems = useMemo(
    () => [...filtered].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru")),
    [filtered],
  );

  const stats = useMemo(() => {
    let need = 0;
    let have = 0;
    let transit = 0;
    let open = 0;
    let total = 0;
    for (const i of items) {
      if (i.rowType === "type") continue;
      total += 1;
      need += i.needQty;
      have += i.haveQty;
      transit += i.inTransitQty;
      if (i.remaining > 0) open += 1;
    }
    return { need, have, transit, open, total };
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

  function replaceItem(item: ProcurementItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
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
    setItems((prev) => {
      const byId = new Map(prev.map((item) => [item.id, item]));
      for (const row of next) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
      return next.map((row) => ({
        ...byId.get(row.id)!,
        sortOrder: sortMap.get(row.id)!,
      }));
    });
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
        name: draft.name.trim(),
        needQty: Number(draft.needQty) || 0,
        haveQty: Number(draft.haveQty) || 0,
        inTransitQty: Number(draft.inTransitQty) || 0,
        notes: draft.notes.trim() || null,
        link: draft.link.trim() || null,
        linkLabel: draft.linkLabel.trim() || null,
      }),
    });
    if (!res.ok) {
      toast.error("Не удалось добавить позицию");
      return;
    }
    const data = await res.json();
    setItems((prev) => [...prev, data.item]);
    setDraft({
      name: "",
      needQty: "0",
      haveQty: "0",
      inTransitQty: "0",
      notes: "",
      link: "",
      linkLabel: "",
    });
    setShowAdd(false);
    toast.success("Позиция добавлена");
  }

  async function addTypeRow(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !typeDraftName.trim()) return;
    const res = await apiFetch("/api/procurement/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        name: typeDraftName.trim(),
        rowType: "type",
      }),
    });
    if (!res.ok) {
      toast.error("Не удалось добавить тип");
      return;
    }
    const data = await res.json();
    setItems((prev) => [...prev, data.item]);
    setTypeDraftName("");
    setShowAddType(false);
    toast.success("Тип добавлен");
  }

  async function duplicateType(source: ProcurementItem) {
    const res = await apiFetch("/api/procurement/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: source.categoryId,
        name: source.name,
        rowType: "type",
      }),
    });
    if (!res.ok) {
      toast.error("Не удалось скопировать тип");
      return;
    }
    const data = await res.json();
    const newItem: ProcurementItem = data.item;
    const ordered = [...items].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"),
    );
    const idx = ordered.findIndex((i) => i.id === source.id);
    const next = [...ordered];
    next.splice(idx + 1, 0, newItem);
    await persistItemOrder(next);
    toast.success("Тип скопирован");
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
            placeholder="Поиск по названию, типу, заметке, ссылке…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setShowAddType((v) => !v)}>
          <Plus className="mr-1 size-4" />
          Тип
        </Button>
        <Button type="button" onClick={() => setShowAdd((v) => !v)}>
          <Plus className="mr-1 size-4" />
          Позиция
        </Button>
      </div>

      {showAddType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Новый тип (разделитель)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addTypeRow} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Label>Название типа</Label>
                <Input
                  required
                  autoFocus
                  value={typeDraftName}
                  onChange={(e) => setTypeDraftName(e.target.value)}
                  placeholder="Постельное и текстиль"
                />
              </div>
              <Button type="submit">Добавить</Button>
              <Button type="button" variant="ghost" onClick={() => setShowAddType(false)}>
                Отмена
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {searchActive && (
        <p className="text-xs text-muted-foreground">
          Сортировка перетаскиванием отключена при активном поиске.
        </p>
      )}

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Новая позиция</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <div>
                <Label>Ссылка (URL)</Label>
                <Input
                  value={draft.link}
                  onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))}
                  placeholder="https://…"
                />
              </div>
              <div>
                <Label>Текст ссылки</Label>
                <Input
                  value={draft.linkLabel}
                  onChange={(e) => setDraft((d) => ({ ...d, linkLabel: e.target.value }))}
                  placeholder="Купить"
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
              {sortedItems.filter((i) => i.rowType !== "type").length}
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
            <Table className="w-full min-w-[900px] table-fixed">
              <colgroup>
                <col className="w-8" />
                <col className="w-14" />
                <col />
                <col className="w-[11%]" />
                <col className="w-[4.75rem]" />
                <col className="w-[4.75rem]" />
                <col className="w-[4.75rem]" />
                <col className="w-[4.75rem]" />
                <col className="w-[5.5rem]" />
                <col />
                <col className="w-12" />
                <col className="w-10" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead />
                  <TableHead className="hidden sm:table-cell">Фото</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Надо</TableHead>
                  <TableHead className="text-right">Есть</TableHead>
                  <TableHead className="text-right">Едут</TableHead>
                  <TableHead className="text-right">Осталось</TableHead>
                  <TableHead>Ссылка</TableHead>
                  <TableHead>Заметка</TableHead>
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) =>
                  item.rowType === "type" ? (
                    <TypeRow
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
                      onDuplicate={duplicateType}
                    />
                  ) : (
                    <ItemRow
                      key={item.id}
                      item={item}
                      typeName={typeByItemId.get(item.id) ?? null}
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
                      onItemReplace={replaceItem}
                    />
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TypeRow({
  item,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onPatch,
  onRemove,
  onDuplicate,
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
  onDuplicate: (item: ProcurementItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(item.name);

  useEffect(() => {
    setDraftName(item.name);
  }, [item.name]);

  async function saveName() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.error("Название не может быть пустым");
      return;
    }
    if (trimmed === item.name) {
      setEditing(false);
      return;
    }
    const ok = await onPatch(item.id, { name: trimmed });
    if (ok) setEditing(false);
  }

  return (
    <TableRow
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
      className={cn(
        "border-y border-primary/20 bg-primary/[0.06] hover:bg-primary/[0.09]",
        dragging && "opacity-50",
      )}
    >
      <TableCell className="w-8 px-2">
        {draggable && (
          <GripVertical className="size-4 cursor-grab text-muted-foreground active:cursor-grabbing" />
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell" />
      <TableCell colSpan={8} className="whitespace-normal py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="h-5 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden />
            {editing ? (
              <Input
                autoFocus
                className="h-8 max-w-md font-semibold"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveName();
                  }
                  if (e.key === "Escape") {
                    setDraftName(item.name);
                    setEditing(false);
                  }
                }}
              />
            ) : (
              <span className="truncate text-sm font-semibold tracking-tight">{item.name}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {editing ? (
              <>
                <Button type="button" size="sm" className="h-8" onClick={() => void saveName()}>
                  OK
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setDraftName(item.name);
                    setEditing(false);
                  }}
                >
                  Отмена
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  title="Редактировать"
                  onClick={() => {
                    setDraftName(item.name);
                    setEditing(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  title="Копировать"
                  onClick={() => void onDuplicate(item)}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  title="Удалить"
                  onClick={() => onRemove(item.id, item.name)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-1" />
      <TableCell className="w-10" />
    </TableRow>
  );
}

function ItemRow({
  item,
  typeName,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onPatch,
  onRemove,
  onItemReplace,
}: {
  item: ProcurementItem;
  typeName: string | null;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onPatch: (id: string, patch: Partial<ProcurementItem>) => Promise<boolean>;
  onRemove: (id: string, name: string) => void;
  onItemReplace: (item: ProcurementItem) => void;
}) {
  const [need, setNeed] = useState(String(item.needQty));
  const [have, setHave] = useState(String(item.haveQty));
  const [transit, setTransit] = useState(String(item.inTransitQty));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(item.name);

  useEffect(() => {
    setNeed(String(item.needQty));
    setHave(String(item.haveQty));
    setTransit(String(item.inTransitQty));
    setNotes(item.notes ?? "");
    setDraftName(item.name);
  }, [item]);

  const remaining =
    (Number(need) || 0) - (Number(have) || 0) - (Number(transit) || 0);

  async function saveName() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.error("Название не может быть пустым");
      setDraftName(item.name);
      setEditingName(false);
      return;
    }
    if (trimmed === item.name) {
      setEditingName(false);
      return;
    }
    const ok = await onPatch(item.id, { name: trimmed });
    if (ok) setEditingName(false);
  }

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

  async function saveLink(link: string | null, linkLabel: string | null) {
    await onPatch(item.id, { link, linkLabel });
  }

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
      <TableCell className="w-8 px-2">
        {draggable && (
          <GripVertical className="size-4 cursor-grab text-muted-foreground active:cursor-grabbing" />
        )}
      </TableCell>
      <TableCell className="hidden px-1 sm:table-cell">
        <ItemImageCell item={item} onUpdated={onItemReplace} />
      </TableCell>
      <TableCell className="whitespace-normal">
        {editingName ? (
          <Input
            autoFocus
            className="h-8 font-medium"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveName();
              }
              if (e.key === "Escape") {
                setDraftName(item.name);
                setEditingName(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(item.name);
              setEditingName(true);
            }}
            className="line-clamp-2 w-full cursor-text text-left font-medium leading-snug hover:text-primary"
            title="Нажмите, чтобы изменить название"
          >
            {item.name}
          </button>
        )}
      </TableCell>
      <TableCell className="whitespace-normal">
        {typeName ? (
          <span
            className="inline-block max-w-full truncate rounded-md bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground"
            title={typeName}
          >
            {typeName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </TableCell>
      <TableCell className="px-1">
        <Input
          type="number"
          min={0}
          className={QTY_INPUT}
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell className="px-1">
        <Input
          type="number"
          min={0}
          className={QTY_INPUT}
          value={have}
          onChange={(e) => setHave(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell className="px-1">
        <Input
          type="number"
          min={0}
          className={QTY_INPUT}
          value={transit}
          onChange={(e) => setTransit(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell
        className={cn(
          "px-1 text-right font-mono tabular-nums",
          remaining > 0 ? "font-semibold text-destructive" : "text-emerald-600",
        )}
      >
        {remaining}
      </TableCell>
      <TableCell className="whitespace-normal px-1">
        <LinkCell link={item.link} linkLabel={item.linkLabel} onSave={saveLink} />
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
      <TableCell className="px-1">
        <div className="flex flex-col items-center gap-1">
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

function ItemImageCell({
  item,
  onUpdated,
}: {
  item: ProcurementItem;
  onUpdated: (item: ProcurementItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const hasImage = Boolean(item.imageMime);
  const imageUrl = hasImage
    ? `/api/procurement/items/${item.id}/image?v=${encodeURIComponent(item.imageUpdatedAt ?? "")}`
    : null;

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Нужен файл изображения");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch(`/api/procurement/items/${item.id}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Не удалось загрузить фото", { description: data.error });
        return;
      }
      onUpdated(data.item);
      toast.success("Фото загружено");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    const res = await apiFetch(`/api/procurement/items/${item.id}/image`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Не удалось удалить фото");
      return;
    }
    onUpdated(data.item);
  }

  function onDropFile(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div
      className={cn(
        "group relative flex size-11 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30 transition-colors",
        dragOver && "border-primary bg-primary/10",
        hasImage && "border-solid border-border bg-background",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={onDropFile}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : hasImage && imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <button
          type="button"
          className="flex size-full flex-col items-center justify-center text-muted-foreground hover:text-foreground"
          title="Перетащите фото или нажмите"
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon className="size-4" />
        </button>
      )}
      {!uploading && hasImage && (
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20"
            title="Заменить"
            onClick={() => inputRef.current?.click()}
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20"
            title="Удалить"
            onClick={() => void removeImage()}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function LinkCell({
  link,
  linkLabel,
  onSave,
}: {
  link: string | null;
  linkLabel: string | null;
  onSave: (link: string | null, linkLabel: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(link ?? "");
  const [label, setLabel] = useState(linkLabel ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(link ?? "");
    setLabel(linkLabel ?? "");
  }, [link, linkLabel]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const href = link?.trim() ?? "";
  const valid = Boolean(href && /^https?:\/\//i.test(href));
  const display = linkLabel?.trim() || (valid ? "ссылка" : "");

  async function save() {
    const u = url.trim();
    const l = label.trim();
    if (u && !/^https?:\/\//i.test(u)) {
      toast.error("URL должен начинаться с http:// или https://");
      return;
    }
    await onSave(u || null, l || null);
    setOpen(false);
  }

  async function clear() {
    await onSave(null, null);
    setUrl("");
    setLabel("");
    setOpen(false);
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <div className="flex min-w-0 items-center gap-0.5">
        {valid && display ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate text-xs text-primary underline-offset-2 hover:underline"
            title={href}
          >
            {display}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="truncate text-xs text-muted-foreground hover:text-foreground"
          >
            + ссылка
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Изменить ссылку"
        >
          <Pencil className="size-3" />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border bg-card p-2.5 shadow-lg ring-1 ring-foreground/10">
          <div className="space-y-2">
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                autoFocus
                className="h-8 text-xs"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Текст ссылки</Label>
              <Input
                className="h-8 text-xs"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Купить"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" className="h-7 text-xs" onClick={() => void save()}>
                OK
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              {valid && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive"
                  onClick={() => void clear()}
                >
                  Удалить
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
