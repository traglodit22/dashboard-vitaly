"use client";

import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { validateRecipient } from "@/lib/delivery/validation";
import { apiFetch } from "@/lib/apiFetch";
import {
  RecipientFields,
  EMPTY_RECIPIENT,
  type RecipientDraft,
} from "./RecipientFields";

export function RecipientForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<RecipientDraft>(EMPTY_RECIPIENT);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof RecipientDraft) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateRecipient({ id: "new", createdAt: "", ...form });
    setErrors(errs);
    if (errs.length) {
      toast.error("Проверьте поля", { description: errs[0] });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Не удалось сохранить"]);
        toast.error("Ошибка", { description: (data.errors ?? [])[0] });
        return;
      }
      toast.success("Получатель добавлен", {
        description: `${form.familyName} ${form.name}`,
      });
      setForm(EMPTY_RECIPIENT);
      setErrors([]);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="size-5 text-primary" />
          Новый получатель
        </CardTitle>
        <CardDescription>
          Данные для таможни. Получатели подставляются в отправки по очереди.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <RecipientFields form={form} set={set} />

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

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} className="min-w-48">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Сохраняем…
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Добавить получателя
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
