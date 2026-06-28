"use client";

import { useEffect, useState } from "react";
import { Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATUS_ROW_CLASS, STATUS_SWATCH_CLASS } from "@/lib/procurement/statusColors";
import {
  normalizedQtyStrings,
  qtyPatchForField,
  type QtyField,
} from "@/lib/procurement/qtySave";
import type { ProcurementItem, ProcurementStatus } from "@/lib/procurement/mapRow";
import { ItemImageCell, LinkCell, QtyStepper } from "@/components/procurement/ProcurementCells";

export function ProcurementMobileTypeCard({
  item,
  showCategoryName,
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
  showCategoryName?: boolean;
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
    <Card
      size="sm"
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
      className={cn(
        "gap-0 border-primary/20 bg-primary/[0.06] py-0",
        dragging && "opacity-50",
      )}
    >
      <CardContent className="flex items-center gap-2 p-3">
        {draggable && (
          <GripVertical className="size-5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
        )}
        <div className="h-6 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          {showCategoryName && item.categoryName ? (
            <span className="inline-block max-w-full truncate rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {item.categoryName}
            </span>
          ) : null}
          {editing ? (
            <Input
              autoFocus
              className="h-9 font-semibold"
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
            <p className="truncate text-sm font-semibold">{item.name}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {editing ? (
            <Button type="button" size="sm" className="h-9" onClick={() => void saveName()}>
              OK
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                title="Редактировать"
                onClick={() => {
                  setDraftName(item.name);
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                title="Копировать"
                onClick={() => void onDuplicate(item)}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-muted-foreground hover:text-destructive"
                title="Удалить"
                onClick={() => onRemove(item.id, item.name)}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProcurementMobileItemCard({
  item,
  statuses,
  typeName,
  showCategoryName,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onPatch,
  onRemove,
  onDuplicate,
  onItemReplace,
}: {
  item: ProcurementItem;
  statuses: ProcurementStatus[];
  typeName: string | null;
  showCategoryName?: boolean;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onPatch: (id: string, patch: Partial<ProcurementItem>) => Promise<boolean>;
  onRemove: (id: string, name: string) => void;
  onDuplicate: (item: ProcurementItem) => void;
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
  }, [item.id, item.needQty, item.haveQty, item.inTransitQty]);

  useEffect(() => {
    setNotes(item.notes ?? "");
    setDraftName(item.name);
  }, [item.id, item.notes, item.name]);

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

  async function saveQtyField(field: QtyField) {
    const patch = qtyPatchForField(field, { need, have, transit }, item);
    if (Object.keys(patch).length === 0) {
      const normalized = normalizedQtyStrings({ need, have, transit }, item);
      setNeed(normalized.need);
      setHave(normalized.have);
      setTransit(normalized.transit);
      return;
    }
    const ok = await onPatch(item.id, patch);
    if (ok) {
      const normalized = normalizedQtyStrings({ need, have, transit }, {
        ...item,
        needQty: patch.needQty ?? item.needQty,
        haveQty: patch.haveQty ?? item.haveQty,
        inTransitQty: patch.inTransitQty ?? item.inTransitQty,
      });
      setNeed(normalized.need);
      setHave(normalized.have);
      setTransit(normalized.transit);
    }
  }

  async function bumpQty(field: "need" | "have" | "transit", delta: number) {
    const values = {
      need: Number(need) || 0,
      have: Number(have) || 0,
      transit: Number(transit) || 0,
    };
    const next = Math.max(0, values[field] + delta);
    if (next === values[field]) return;
    values[field] = next;
    setNeed(String(values.need));
    setHave(String(values.have));
    setTransit(String(values.transit));
    await onPatch(item.id, {
      needQty: values.need,
      haveQty: values.have,
      inTransitQty: values.transit,
    });
  }

  async function saveNotes() {
    if (notes === (item.notes ?? "")) return;
    await onPatch(item.id, { notes: notes || null });
  }

  async function saveLink(link: string | null, store: Parameters<typeof LinkCell>[0]["store"]) {
    await onPatch(item.id, { link, store });
  }

  async function saveStatus(value: string | null) {
    const statusId = value && value !== "__none__" ? value : null;
    if (statusId === item.statusId) return;
    await onPatch(item.id, { statusId });
  }

  const rowStatusColor = item.status?.colorKey;

  return (
    <Card
      size="sm"
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
      className={cn("gap-0 py-0", dragging && "opacity-50", rowStatusColor && STATUS_ROW_CLASS[rowStatusColor])}
    >
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start gap-2">
          {draggable && (
            <GripVertical className="mt-1 size-5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
          )}
          <ItemImageCell
            item={item}
            onUpdated={onItemReplace}
            className="size-16 sm:size-11"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            {editingName ? (
              <Input
                autoFocus
                className="h-9 font-medium"
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
                className="line-clamp-3 w-full text-left text-sm font-medium leading-snug hover:text-primary"
              >
                {item.name}
              </button>
            )}
            {showCategoryName && item.categoryName ? (
              <span className="inline-block max-w-full truncate rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {item.categoryName}
              </span>
            ) : null}
            {typeName ? (
              <span className="inline-block max-w-full truncate rounded-md bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground">
                {typeName}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground hover:text-foreground"
              onClick={() => void onDuplicate(item)}
              title="Копировать"
            >
              <Copy className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(item.id, item.name)}
              title="Удалить"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <Select value={item.statusId ?? "__none__"} onValueChange={(v) => void saveStatus(v)}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="Статус">
              {item.status ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full border",
                      STATUS_SWATCH_CLASS[item.status.colorKey],
                    )}
                  />
                  <span className="truncate">{item.status.name}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Статус не выбран</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className={cn("size-2 rounded-full border", STATUS_SWATCH_CLASS[s.colorKey])} />
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              { key: "need" as const, label: "Надо", value: need, set: setNeed },
              { key: "have" as const, label: "Есть", value: have, set: setHave },
              { key: "transit" as const, label: "Едут", value: transit, set: setTransit },
            ] as const
          ).map(({ key, label, value, set }) => (
            <div key={key} className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <QtyStepper
                size="comfortable"
                value={value}
                onChange={set}
                onBlur={() => void saveQtyField(key)}
                onBump={(d) => void bumpQty(key, d)}
              />
            </div>
          ))}
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Осталось
            </p>
            <div
              className={cn(
                "flex h-10 items-center justify-center rounded-md border bg-muted/30 font-mono text-sm tabular-nums",
                remaining > 0 ? "font-semibold text-destructive" : "text-emerald-600",
              )}
            >
              {remaining}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Ссылка
          </p>
          <LinkCell link={item.link} store={item.store} onSave={saveLink} />
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Заметка
          </p>
          <Input
            className="h-10 w-full text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="—"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProcurementMobileList({
  items,
  typeByItemId,
  statuses,
  showCategoryName,
  draggable,
  dragItemId,
  onDragStart,
  onDragEnd,
  onItemDrop,
  onPatch,
  onRemove,
  onDuplicate,
  onItemReplace,
}: {
  items: ProcurementItem[];
  typeByItemId: Map<string, string | null>;
  statuses: ProcurementStatus[];
  showCategoryName?: boolean;
  draggable: boolean;
  dragItemId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onItemDrop: (targetId: string) => void;
  onPatch: (id: string, patch: Partial<ProcurementItem>) => Promise<boolean>;
  onRemove: (id: string, name: string) => void;
  onDuplicate: (item: ProcurementItem) => void;
  onItemReplace: (item: ProcurementItem) => void;
}) {
  return (
    <div className="space-y-2 p-3 md:hidden">
      {items.map((item) =>
        item.rowType === "type" ? (
          <ProcurementMobileTypeCard
            key={item.id}
            item={item}
            showCategoryName={showCategoryName}
            draggable={draggable}
            dragging={dragItemId === item.id}
            onDragStart={() => onDragStart(item.id)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              onItemDrop(item.id);
            }}
            onPatch={onPatch}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
          />
        ) : (
          <ProcurementMobileItemCard
            key={item.id}
            item={item}
            statuses={statuses}
            typeName={typeByItemId.get(item.id) ?? null}
            showCategoryName={showCategoryName}
            draggable={draggable}
            dragging={dragItemId === item.id}
            onDragStart={() => onDragStart(item.id)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              onItemDrop(item.id);
            }}
            onPatch={onPatch}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
            onItemReplace={onItemReplace}
          />
        ),
      )}
    </div>
  );
}
