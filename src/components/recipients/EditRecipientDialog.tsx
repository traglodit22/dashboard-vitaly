"use client";

import { useEffect, useState } from "react";
import { UserCog, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validateRecipient } from "@/lib/delivery/validation";
import { apiFetch } from "@/lib/apiFetch";
import type { Recipient } from "@/types";
import { RecipientFields, type RecipientDraft } from "./RecipientFields";

function toDraft(r: Recipient): RecipientDraft {
  return {
    familyName: r.familyName,
    name: r.name,
    middleName: r.middleName ?? "",
    passportSerial: r.passportSerial,
    passportNumber: r.passportNumber,
    passportIssueDate: r.passportIssueDate,
    birthDate: r.birthDate ?? "",
    inn: r.inn,
    fullAddress: r.fullAddress,
    city: r.city,
    state: r.state,
    zipCode: r.zipCode,
    phoneNumber: r.phoneNumber,
    email: r.email,
  };
}

export function EditRecipientDialog({
  recipient,
  onClose,
}: {
  recipient: Recipient;
  onClose: (updated?: boolean) => void;
}) {
  const [form, setForm] = useState<RecipientDraft>(toDraft(recipient));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key: keyof RecipientDraft) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateRecipient({ id: recipient.id, createdAt: "", ...form });
    setErrors(errs);
    if (errs.length) {
      toast.error("Проверьте поля", { description: errs[0] });
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/recipients/${recipient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Не удалось сохранить"]);
        toast.error("Ошибка", { description: (data.errors ?? [])[0] });
        return;
      }
      toast.success("Получатель обновлён", {
        description: `${form.familyName} ${form.name}`,
      });
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
        className="w-full max-w-2xl rounded-xl bg-card p-6 text-sm ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserCog className="size-5 text-primary" />
            Редактировать получателя
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
          <RecipientFields form={form} set={set} />

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
