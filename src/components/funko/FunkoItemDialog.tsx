"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FunkoImagePicker } from "@/components/funko/FunkoImagePicker";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import type { FunkoItem, FunkoTitleSuggestion } from "@/lib/funko/types";
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

function parsePopInput(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const [currentItem, setCurrentItem] = useState<FunkoItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [titlePanelOpen, setTitlePanelOpen] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<FunkoTitleSuggestion[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [applyingTitle, setApplyingTitle] = useState<string | null>(null);

  const slug = item?.categorySlug ?? categorySlug;

  const pickerQuery = useMemo(
    () => ({
      popNumber: parsePopInput(form.popNumber),
      subseries: form.subseries.trim(),
      title: form.title.trim(),
    }),
    [form.popNumber, form.subseries, form.title],
  );

  useEffect(() => {
    if (!open) return;
    setForm(item ? fromItem(item) : emptyForm());
    setCurrentItem(item);
    setTitlePanelOpen(false);
    setTitleSuggestions([]);
  }, [open, item]);

  if (!open) return null;

  async function save() {
    if (!form.title.trim()) {
      toast.error("Укажите название");
      return;
    }
    setSaving(true);
    try {
      const popNumber = parsePopInput(form.popNumber);
      const payload = {
        title: form.title.trim(),
        popNumber,
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
            isNew ? { ...payload, categorySlug: slug } : payload,
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

  async function loadTitleSuggestions() {
    const popNumber = parsePopInput(form.popNumber);
    if (popNumber == null) {
      toast.error("Укажите № Pop для подбора названия");
      return;
    }
    setTitlePanelOpen(true);
    setLoadingTitles(true);
    try {
      const params = new URLSearchParams({
        categorySlug: slug,
        popNumber: String(popNumber),
        title: form.title.trim(),
        subseries: form.subseries.trim(),
      });
      const res = await apiFetch(`/api/funko/title-suggestions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка подбора"));
      setTitleSuggestions((data.suggestions as FunkoTitleSuggestion[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
      setTitleSuggestions([]);
    } finally {
      setLoadingTitles(false);
    }
  }

  async function applyTitleSuggestion(suggestion: FunkoTitleSuggestion) {
    setApplyingTitle(suggestion.title);
    setForm((f) => ({
      ...f,
      title: suggestion.title,
      popNumber:
        suggestion.popNumber != null ? String(suggestion.popNumber) : f.popNumber,
    }));

    if (item) {
      try {
        const res = await apiFetch(`/api/funko/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: suggestion.title,
            popNumber: suggestion.popNumber,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(String(data.error ?? "Ошибка сохранения"));
        const updated = data.item as FunkoItem;
        setCurrentItem(updated);
        onSaved(updated);
        toast.success("Название обновлено");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка");
      }
    } else {
      toast.success("Название выбрано");
    }
    setApplyingTitle(null);
    setTitlePanelOpen(false);
  }

  return (
    <>
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
            {!isNew && currentItem && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted/40">
                  {currentItem.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentItem.imageUrl}
                      alt={currentItem.title}
                      className="size-full object-contain p-1"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-5 opacity-50" />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setPickerOpen(true)}
                >
                  <ImageIcon className="size-4" />
                  Подобрать фото
                </Button>
              </div>
            )}

            <Field label="Название">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <button
                type="button"
                className="mt-1.5 text-xs text-primary hover:underline"
                onClick={() => void loadTitleSuggestions()}
              >
                Неверное название?
              </button>
            </Field>

            {titlePanelOpen && (
              <div className="rounded-lg border bg-muted/10 p-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Варианты по № и серии
                </p>
                {loadingTitles ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : titleSuggestions.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    Не найдено — проверьте № Pop
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {titleSuggestions.map((s) => (
                      <button
                        key={s.title}
                        type="button"
                        disabled={Boolean(applyingTitle)}
                        onClick={() => void applyTitleSuggestion(s)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                          applyingTitle === s.title && "bg-primary/10",
                        )}
                      >
                        <span className="line-clamp-2 min-w-0 font-medium">{s.title}</span>
                        {s.popNumber != null && (
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            №{s.popNumber}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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

      {!isNew && currentItem && (
        <FunkoImagePicker
          open={pickerOpen}
          item={currentItem}
          query={pickerQuery}
          onClose={() => setPickerOpen(false)}
          onSaved={(updated) => {
            setCurrentItem(updated);
            onSaved(updated);
          }}
        />
      )}
    </>
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
