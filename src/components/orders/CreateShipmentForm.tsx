"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Link2, Hash, Coins, Truck, Loader2, Store } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LIMITS } from "@/lib/delivery/constants";
import { computeTotalAmount } from "@/lib/delivery/buildPayload";
import { validateOrderDraft } from "@/lib/delivery/validation";
import { STORES, type StoreType } from "@/types";
import { apiFetch } from "@/lib/apiFetch";

interface FormState {
  itemDescription: string;
  numberOfItemPieces: string;
  itemPrice: string;
  itemStoreLink: string;
  store: string;
  incomingDeclaration: string;
}

const EMPTY: FormState = {
  itemDescription: "",
  numberOfItemPieces: "1",
  itemPrice: "",
  itemStoreLink: "",
  store: "",
  incomingDeclaration: "",
};

const yuan = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function CreateShipmentForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
      toast.error("Проверьте поля формы", { description: errs[0] });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Не удалось создать заказ"]);
        toast.error("Ошибка", { description: (data.errors ?? [])[0] });
        return;
      }

      const hasTrack = Boolean(draft.incomingDeclaration);
      toast.success(hasTrack ? "Отправка создана" : "Товар добавлен", {
        description: hasTrack
          ? `Ценность ¥${yuan.format(total)} · отправляется в ДоброПост`
          : `Ценность ¥${yuan.format(total)} · статус «Ожидает трек-код»`,
      });
      setForm(EMPTY);
      setErrors([]);
      router.refresh();
    } catch {
      toast.error("Сеть недоступна", { description: "Повторите попытку" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Package className="size-5 text-primary" />
          Новый товар / отправка
        </CardTitle>
        <CardDescription>
          Получатель подставится по очереди, ценность посчитается сама. Трек-код
          можно добавить позже — тогда отправка в ДоброПост уйдёт автоматически.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
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
              placeholder="Например: Чехол для телефона силиконовый"
              onChange={(e) => set("itemDescription")(e.target.value)}
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="numberOfItemPieces" label="Количество, шт" icon={<Hash className="size-4" />}
              hint={pieces > LIMITS.recommendedMaxPieces ? `реком. ≤ ${LIMITS.recommendedMaxPieces}` : undefined}
            >
              <Input
                id="numberOfItemPieces"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.numberOfItemPieces}
                placeholder="0"
                className="font-mono"
                onChange={(e) => set("numberOfItemPieces")(e.target.value)}
              />
            </Field>

            <Field id="itemPrice" label="Цена за штуку, ¥" icon={<Coins className="size-4" />}>
              <Input
                id="itemPrice"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.itemPrice}
                placeholder="0.00"
                className="font-mono"
                onChange={(e) => set("itemPrice")(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="itemStoreLink" label="Ссылка на товар" icon={<Link2 className="size-4" />}>
              <Input
                id="itemStoreLink"
                type="url"
                inputMode="url"
                value={form.itemStoreLink}
                placeholder="https://..."
                onChange={(e) => set("itemStoreLink")(e.target.value)}
              />
            </Field>

            <Field id="store" label="Магазин" icon={<Store className="size-4" />}>
              <Select value={form.store} onValueChange={(v) => set("store")(v ?? "")}>
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
            overLimit={form.incomingDeclaration.length >= LIMITS.incomingDeclarationMax}
          >
            <Input
              id="incomingDeclaration"
              value={form.incomingDeclaration}
              maxLength={LIMITS.incomingDeclarationMax - 1}
              placeholder="Можно оставить пустым — добавите позже"
              className="font-mono"
              onChange={(e) => set("incomingDeclaration")(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <div>
              <div className="text-sm text-muted-foreground">Ценность (количество × цена)</div>
              <div className="text-xs text-muted-foreground/70">
                {pieces} шт × ¥{yuan.format(price)}
              </div>
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-amber-500">
              ¥{yuan.format(total)}
            </div>
          </div>

          {errors.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
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
              onClick={() => {
                setForm(EMPTY);
                setErrors([]);
              }}
              disabled={submitting}
            >
              Очистить
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-44">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Сохраняем…
                </>
              ) : (
                <>
                  <Package className="size-4" />
                  Добавить товар
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
        <Label htmlFor={id} className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
          {optional && (
            <span className="text-xs font-normal text-muted-foreground/60">— необязательно</span>
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
