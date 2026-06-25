"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import type { FunkoItem } from "@/lib/funko/types";
import { cn } from "@/lib/utils";

export interface FunkoItemFormValues {
  title: string;
  popNumber: string;
  subseries: string;
  notes: string;
  owned: boolean;
  inTransit: boolean;
  hasDuplicates: boolean;
  quantity: string;
}

function emptyForm(): FunkoItemFormValues {
  return {
    title: "",
    popNumber: "",
    subseries: "",
    notes: "",
    owned: false,
    inTransit: true,
    hasDuplicates: false,
    quantity: "0",
  };
}

function fromItem(item: FunkoItem): FunkoItemFormValues {
  return {
    title: item.title,
    popNumber: item.popNumber != null ? String(item.popNumber) : "",
    subseries: item.series.find((s) => s !== item.categoryName) ?? "",
    notes: item.notes ?? "",
    owned: item.owned,
    inTransit: item.inTransit,
    hasDuplicates: item.hasDuplicates,
    quantity: String(item.quantity ?? 0),
  };
}

export function FunkoItemDialog({
  open,
  item,
  categorySlug,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: FunkoItem | null;
  categorySlug: string;
  onClose: () => void;
  onSaved: (item: FunkoItem) => void;
}) {
  const isNew = !item;
  const [form, setForm] = useState<FunkoItemFormValues>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(item ? fromItem(item) : emptyForm());
  }, [open, item]);

  if (!open) return null;

  async function save() {
    if (!form.title.trim()) {
      toast.error("Укажите название");
      return;
    }
    setSaving(true);
    try {
      const popNumber = form.popNumber.trim() ? Number(form.popNumber) : null;
      const payload = {
        title: form.title.trim(),
        popNumber: Number.isFinite(popNumber) ? popNumber : null,
        subseries: form.subseries.trim() || null,
        notes: form.notes.trim() || null,
        owned: form.owned,
        inTransit: form.inTransit,
        hasDuplicates: form.hasDuplicates,
        quantity: Math.max(0, Number(form.quantity) || 0),
      };

      const res = await apiFetch(
        isNew ? "/api/funko" : `/api/funko/${item!.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isNew ? { ...payload, categorySlug } : payload,
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка сохранения"));
      toast.success(isNew ? "Позиция создана" : "Сохранено");
      onSaved(data.item as FunkoItem);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border bg-card p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="mb-4 text-lg font-semibold">
          {isNew ? "Новая фигурка" : "Редактирование"}
        </h2>

        <div className="space-y-3">
          <Field label="Название">
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="№ Pop (ID)">
              <Input
                type="number"
                value={form.popNumber}
                onChange={(e) => setForm((f) => ({ ...f, popNumber: e.target.value }))}
              />
            </Field>
            <Field label="Подсерия">
              <Input
                value={form.subseries}
                onChange={(e) => setForm((f) => ({ ...f, subseries: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Комментарий">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <ToggleChip
              label="Есть"
              active={form.owned}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  owned: !f.owned,
                  inTransit: !f.owned ? false : f.inTransit,
                }))
              }
            />
            <ToggleChip
              label="В пути"
              active={form.inTransit}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  inTransit: !f.inTransit,
                  owned: !f.inTransit ? false : f.owned,
                }))
              }
            />
            <ToggleChip
              label="Есть дубли"
              active={form.hasDuplicates}
              onClick={() =>
                setForm((f) => ({ ...f, hasDuplicates: !f.hasDuplicates }))
              }
            />
          </div>
          {form.hasDuplicates && (
            <Field label="Количество">
              <Input
                type="number"
                min={2}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </Field>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}
