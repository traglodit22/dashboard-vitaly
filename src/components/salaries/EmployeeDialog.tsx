"use client";

import { useEffect, useState } from "react";
import { UserSquare, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { validateEmployee } from "@/lib/salaries/validation";
import type { Employee } from "@/types";

interface Draft {
  name: string;
  role: string;
  hourlyRate: string;
  trackerEmail: string;
  telegramId: string;
}

const EMPTY: Draft = {
  name: "",
  role: "",
  hourlyRate: "",
  trackerEmail: "",
  telegramId: "",
};

function toDraft(e: Employee): Draft {
  return {
    name: e.name,
    role: e.role ?? "",
    hourlyRate: String(e.hourlyRate ?? ""),
    trackerEmail: e.trackerEmail ?? "",
    telegramId: e.telegramId ?? "",
  };
}

export function EmployeeDialog({
  employee,
  onClose,
}: {
  employee?: Employee | null;
  onClose: (saved?: boolean) => void;
}) {
  const isEdit = Boolean(employee);
  const [form, setForm] = useState<Draft>(employee ? toDraft(employee) : EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      hourlyRate: Number(form.hourlyRate),
      trackerEmail: form.trackerEmail.trim().toLowerCase(),
      telegramId: form.telegramId.trim() || undefined,
    };
    const errs = validateEmployee(payload);
    setErrors(errs);
    if (errs.length) {
      toast.error("Проверьте поля", { description: errs[0] });
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(
        isEdit ? `/api/employees/${employee!.id}` : "/api/employees",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Не удалось сохранить"]);
        toast.error("Ошибка", { description: (data.errors ?? [])[0] });
        return;
      }
      toast.success(isEdit ? "Сотрудник обновлён" : "Сотрудник добавлен", {
        description: payload.name,
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
        className="w-full max-w-lg rounded-xl bg-card p-6 text-sm ring-1 ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserSquare className="size-5 text-primary" />
            {isEdit ? "Редактировать сотрудника" : "Новый сотрудник"}
          </h2>
          <button
            onClick={() => onClose()}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Имя</Label>
            <Input id="emp-name" value={form.name} onChange={set("name")} placeholder="Алексей" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="emp-role">Должность</Label>
              <Input id="emp-role" value={form.role} onChange={set("role")} placeholder="SMM-менеджер" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-rate">Ставка, ₽/час</Label>
              <Input
                id="emp-rate"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="font-mono"
                value={form.hourlyRate}
                onChange={set("hourlyRate")}
                placeholder="500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email из тайм-трекера</Label>
            <Input
              id="emp-email"
              type="email"
              value={form.trackerEmail}
              onChange={set("trackerEmail")}
              placeholder="name@example.com"
            />
            <p className="text-xs text-muted-foreground">
              По этому email отчёт сопоставляется с сотрудником. Должен совпадать с колонкой Email в выгрузке.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-tg">Telegram ID (необязательно)</Label>
            <Input id="emp-tg" value={form.telegramId} onChange={set("telegramId")} placeholder="@username или id" />
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

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => onClose()} disabled={saving}>
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
