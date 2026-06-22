"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Link2,
  Hash,
  Coins,
  Truck,
  Store,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIMITS } from "@/lib/delivery/constants";
import { computeTotalAmount } from "@/lib/delivery/buildPayload";
import { validateOrderDraft } from "@/lib/delivery/validation";
import { STORES, type StoreType, type ProductOrder } from "@/types";
import { apiFetch } from "@/lib/apiFetch";

const yuan = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface FormState {
  itemDescription: string;
  numberOfItemPieces: string;
  itemPrice: string;
  itemStoreLink: string;
  store: string;
  incomingDeclaration: string;
}

export function EditOrderDialog({
  order,
  onClose,
}: {
  order: ProductOrder;
  onClose: (updated?: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>({
    itemDescription: order.itemDescription,
    numberOfItemPieces: String(order.numberOfItemPieces),
    itemPrice: String(order.itemPrice),
    itemStoreLink: order.itemStoreLink,
    store: order.store,
    incomingDeclaration: order.incomingDeclaration ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Закрытие по Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pieces = Number(form.numberOfItemPieces) || 0;
  const price = Number(form.itemPrice) || 0;
  const total = useMemo(() => computeTotalAmount(pieces, price), [pieces, price]);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const draft = {
      itemDescription: form.itemDescription.trim(),
      numberOfItemPieces: pieces,
      itemPrice: price,
      itemStoreLink: form.itemStoreLink.trim(),
      store: form.store as StoreType,
      incomingDeclaration: form.incomingDeclaration.trim(),
    };
    const errs = validateOrderDraft(draft);
    setErrors(errs);
    if (errs.length > 0) {
      toast.error("Проверьте поля", { description: errs[0] });
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Не удалось сохранить"]);
        toast.error("Ошибка", { description: (data.errors ?? [])[0] });
        return;
      }
      toast.success("Сохранено");
      onClose(true);
    } catch {
      toast.error("Сеть недоступна", { description: "Повторите попытку" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 py-10 backdrop-blur-sm"
      onClick={() => onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-card p-6 text-sm ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Package className="size-5 text-primary" />
            Редактировать отправку
          </h2>
          <button
            onClick={() => onClose()}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Field
            id="itemDescription"
            label="Описание товара"
            icon={<Package className="size-4" />}
            hint={`${form.itemDescription.length}/${LIMITS.itemDescriptionMax - 1}`}
            overLimit={form.itemDescription.length >= LIMITS.itemDescriptionMax}
          >
            <Input
              id="itemDescription"
              value={form.itemDescription}
              maxLength={LIMITS.itemDescriptionMax - 1}
              onChange={(e) => set("itemDescription")(e.target.value)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="numberOfItemPieces"
              label="Количество, шт"
              icon={<Hash className="size-4" />}
            >
              <Input
                id="numberOfItemPieces"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.numberOfItemPieces}
                className="font-mono"
                onChange={(e) => set("numberOfItemPieces")(e.target.value)}
              />
            </Field>
            <Field
              id="itemPrice"
              label="Цена за штуку, ¥"
              icon={<Coins className="size-4" />}
            >
              <Input
                id="itemPrice"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.itemPrice}
                className="font-mono"
                onChange={(e) => set("itemPrice")(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="itemStoreLink"
              label="Ссылка на товар"
              icon={<Link2 className="size-4" />}
            >
              <Input
                id="itemStoreLink"
                type="url"
                inputMode="url"
                value={form.itemStoreLink}
                onChange={(e) => set("itemStoreLink")(e.target.value)}
              />
            </Field>
            <Field id="store" label="Магазин" icon={<Store className="size-4" />}>
              <Select
                value={form.store}
                onValueChange={(v) => set("store")(v ?? "")}
              >
                <SelectTrigger id="store" className="w-full">
                  <SelectValue placeholder="Выберите магазин" />
                </SelectTrigger>
                <SelectContent>
                  {STORES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            id="incomingDeclaration"
            label="Трек-номер по Китаю"
            icon={<Truck className="size-4" />}
            optional
            hint={`${form.incomingDeclaration.length}/${LIMITS.incomingDeclarationMax - 1}`}
            overLimit={
              form.incomingDeclaration.length >= LIMITS.incomingDeclarationMax
            }
          >
            <Input
              id="incomingDeclaration"
              value={form.incomingDeclaration}
              maxLength={LIMITS.incomingDeclarationMax - 1}
              placeholder="Пусто — статус «Ожидает трек-код»"
              className="font-mono"
              onChange={(e) => set("incomingDeclaration")(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <span className="text-muted-foreground">Ценность</span>
            <span className="font-mono text-xl font-semibold tabular-nums text-amber-500">
              ¥{yuan.format(total)}
            </span>
          </div>

          {errors.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive"
            >
              {errors.map((err) => (
                <li key={err}>• {err}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onClose()}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving} className="min-w-36">
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Сохраняем…
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  hint,
  overLimit,
  optional,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  hint?: string;
  overLimit?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className="flex items-center gap-1.5 text-muted-foreground"
        >
          {icon}
          {label}
          {optional && (
            <span className="text-xs font-normal text-muted-foreground/60">
              — необязательно
            </span>
          )}
        </Label>
        {hint && (
          <span
            className={`font-mono text-xs ${overLimit ? "text-destructive" : "text-muted-foreground/60"}`}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
