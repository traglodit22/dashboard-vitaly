"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import {
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  ExternalLink,
  Search,
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
import type { ProcurementCategory, ProcurementItem } from "@/lib/procurement/mapRow";

function groupItems(items: ProcurementItem[]): Map<string, ProcurementItem[]> {
  const map = new Map<string, ProcurementItem[]>();
  for (const item of items) {
    const key = item.groupName?.trim() || "Без группы";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
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
  const [newCategoryName, setNewCategoryName] = useState("");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.groupName?.toLowerCase().includes(q) ?? false) ||
        (i.notes?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  const grouped = useMemo(() => groupItems(filtered), [filtered]);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Категория</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.length === 0 && <option value="">Нет категорий</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Новая категория"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="w-40"
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
            placeholder="Поиск по названию, группе, заметке…"
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
              <div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="size-5 text-primary" />
            {categories.find((c) => c.id === categoryId)?.name ?? "Закупки"}
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {filtered.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "Нет позиций в этой категории."
                : "Ничего не найдено по запросу."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Название</TableHead>
                  <TableHead className="w-20 text-right">Надо</TableHead>
                  <TableHead className="w-20 text-right">Есть</TableHead>
                  <TableHead className="w-20 text-right">Едут</TableHead>
                  <TableHead className="w-20 text-right">Осталось</TableHead>
                  <TableHead className="min-w-[160px]">Заметка</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...grouped.entries()].map(([group, groupItemsList]) => (
                  <Fragment key={`g-${group}`}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={7} className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group}
                      </TableCell>
                    </TableRow>
                    {groupItemsList.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onPatch={patchItem}
                        onRemove={removeItem}
                      />
                    ))}
                  </Fragment>
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
  onPatch,
  onRemove,
}: {
  item: ProcurementItem;
  onPatch: (id: string, patch: Partial<ProcurementItem>) => Promise<boolean>;
  onRemove: (id: string, name: string) => void;
}) {
  const [need, setNeed] = useState(String(item.needQty));
  const [have, setHave] = useState(String(item.haveQty));
  const [transit, setTransit] = useState(String(item.inTransitQty));
  const [notes, setNotes] = useState(item.notes ?? "");

  useEffect(() => {
    setNeed(String(item.needQty));
    setHave(String(item.haveQty));
    setTransit(String(item.inTransitQty));
    setNotes(item.notes ?? "");
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

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{item.name}</div>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ссылка
            <ExternalLink className="size-3" />
          </a>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          className="h-8 w-16 text-right tabular-nums"
          value={need}
          onChange={(e) => setNeed(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          className="h-8 w-16 text-right tabular-nums"
          value={have}
          onChange={(e) => setHave(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          className="h-8 w-16 text-right tabular-nums"
          value={transit}
          onChange={(e) => setTransit(e.target.value)}
          onBlur={saveQty}
        />
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono tabular-nums",
          remaining > 0 ? "text-destructive font-semibold" : "text-emerald-600",
        )}
      >
        {remaining}
      </TableCell>
      <TableCell>
        <Input
          className="h-8 min-w-[140px] text-xs"
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
