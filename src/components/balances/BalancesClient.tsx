"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  AlertCircle,
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

interface BalanceProvider {
  id: string;
  name: string;
  apiUrl: string;
  panelUrl: string;
  apiKey: string;
  apiHeaderName: string;
  currency: string;
  threshold: number;
  lastBalance: number | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  active: boolean;
  extraParams: string;
  responseType: string;
  responsePath: string;
  requestMethod: string;
  keyParamName: string;
  createdAt: string;
}

interface ProviderDraft {
  name: string;
  apiUrl: string;
  panelUrl: string;
  apiKey: string;
  currency: string;
  threshold: string;
  active: boolean;
  extraParams: string;
  responseType: string;
  responsePath: string;
  requestMethod: string;
  keyParamName: string;
}

const EMPTY_DRAFT: ProviderDraft = {
  name: "",
  apiUrl: "",
  panelUrl: "",
  apiKey: "",
  currency: "USD",
  threshold: "10",
  active: true,
  extraParams: "action=balance",
  responseType: "json",
  responsePath: "balance",
  requestMethod: "POST",
  keyParamName: "key",
};

const dt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const numFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function BalancesClient() {
  const [providers, setProviders] = useState<BalanceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BalanceProvider | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/balances", { cache: "no-store" });
    const data = await res.json();
    setProviders(data.providers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function checkAll() {
    setChecking(true);
    try {
      const res = await apiFetch("/api/balances/check", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Ошибка при проверке", { description: data.error });
        return;
      }
      await load();
      const failed = (data.results ?? []).filter((r: { error?: string }) => r.error).length;
      if (data.low?.length > 0) {
        toast.warning(
          `Проверено: ${data.checked}. Низкий баланс у ${data.low.length} сервисов${failed ? `, ошибок: ${failed}` : ""}.`,
        );
      } else if (failed > 0) {
        toast.warning(`Проверено: ${data.checked}. Ошибок: ${failed} (баланс сохранён с прошлой проверки).`);
      } else {
        toast.success(`Проверено: ${data.checked}. Всё в норме.`);
      }
    } finally {
      setChecking(false);
    }
  }

  async function remove(id: string) {
    const res = await apiFetch(`/api/balances/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Удалено");
      await load();
    } else {
      toast.error("Не удалось удалить");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="size-5 text-primary" />
            Провайдеры балансов
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {providers.length}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={checkAll}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Проверить все
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Добавить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка…
            </div>
          ) : providers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Нет добавленных провайдеров. Нажмите «Добавить», чтобы настроить первый.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right">Баланс</TableHead>
                  <TableHead className="text-right">Порог</TableHead>
                  <TableHead>Валюта</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Проверен</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => {
                  const isLow =
                    p.lastBalance !== null && p.lastBalance < p.threshold;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {effectivePanelUrl(p) ? (
                          <a
                            href={effectivePanelUrl(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary hover:underline"
                          >
                            {p.name}
                          </a>
                        ) : p.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        <div className="flex flex-col items-end gap-0.5">
                          {p.lastBalance !== null ? (
                            <span className={cn(isLow && "font-semibold text-red-500")}>
                              {numFmt.format(p.lastBalance)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {p.lastError && (
                            <span
                              className="flex max-w-[180px] items-center justify-end gap-1 text-xs text-destructive"
                              title={p.lastError}
                            >
                              <AlertCircle className="size-3 shrink-0" />
                              <span className="truncate">{p.lastError}</span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                        {numFmt.format(p.threshold)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.currency}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            p.active
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-muted/50 text-muted-foreground",
                          )}
                        >
                          {p.active ? "Активен" : "Отключён"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {p.lastCheckedAt
                          ? dt.format(new Date(p.lastCheckedAt))
                          : "Никогда"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditing(p);
                              setDialogOpen(true);
                            }}
                            title="Редактировать"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => remove(p.id)}
                            title="Удалить"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <ProviderDialog
          provider={editing}
          onClose={(saved) => {
            setDialogOpen(false);
            setEditing(null);
            if (saved) load();
          }}
        />
      )}
    </>
  );
}

// ─── Add / Edit dialog ──────────────────────────────────────────────────────

function providerToDraft(p: BalanceProvider): ProviderDraft {
  return {
    name: p.name,
    apiUrl: p.apiUrl,
    panelUrl: p.panelUrl,
    apiKey: "",
    currency: p.currency,
    threshold: String(p.threshold),
    active: p.active,
    extraParams: p.extraParams,
    responseType: p.responseType,
    responsePath: p.responsePath,
    requestMethod: p.requestMethod,
    keyParamName: p.keyParamName,
  };
}

function effectivePanelUrl(p: BalanceProvider): string {
  if (p.panelUrl) return p.panelUrl;
  try { return new URL(p.apiUrl).origin; } catch { return ""; }
}

function ProviderDialog({
  provider,
  onClose,
}: {
  provider: BalanceProvider | null;
  onClose: (saved?: boolean) => void;
}) {
  const isEdit = provider !== null;
  const [form, setForm] = useState<ProviderDraft>(
    isEdit ? providerToDraft(provider) : { ...EMPTY_DRAFT },
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set =
    (key: keyof ProviderDraft) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!form.name.trim()) errs.push("Укажите название");
    if (!form.apiUrl.trim()) errs.push("Укажите API URL");
    if (!isEdit && !form.apiKey.trim()) errs.push("Укажите API Key");
    if (!form.threshold || isNaN(Number(form.threshold)))
      errs.push("Порог должен быть числом");
    setErrors(errs);
    if (errs.length) {
      toast.error("Проверьте поля", { description: errs[0] });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        apiUrl: form.apiUrl.trim(),
        panelUrl: form.panelUrl.trim(),
        currency: form.currency.trim(),
        threshold: Number(form.threshold),
        active: form.active,
        extraParams: form.extraParams,
        responseType: form.responseType,
        responsePath: form.responsePath,
        requestMethod: form.requestMethod,
        keyParamName: form.keyParamName,
      };
      if (form.apiKey.trim()) {
        payload.apiKey = form.apiKey.trim();
      }

      const res = await apiFetch(
        isEdit ? `/api/balances/${provider.id}` : "/api/balances",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "Не удалось сохранить";
        setErrors([msg]);
        toast.error("Ошибка", { description: msg });
        return;
      }
      toast.success(isEdit ? "Провайдер обновлён" : "Провайдер добавлен", {
        description: form.name.trim(),
      });
      onClose(true);
    } catch {
      toast.error("Сеть недоступна");
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
            <Wallet className="size-5 text-primary" />
            {isEdit ? "Редактировать провайдера" : "Новый провайдер"}
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
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bp-name">Название</Label>
            <Input
              id="bp-name"
              value={form.name}
              onChange={set("name")}
              placeholder="DobroPost баланс"
            />
          </div>

          {/* API URL */}
          <div className="space-y-1.5">
            <Label htmlFor="bp-url">API URL</Label>
            <Input
              id="bp-url"
              value={form.apiUrl}
              onChange={set("apiUrl")}
              placeholder="https://smmturk.org/api/v2"
            />
            <p className="text-xs text-muted-foreground">
              Стандартный SMM-формат: POST key+action=balance
            </p>
          </div>

          {/* Panel URL */}
          <div className="space-y-1.5">
            <Label htmlFor="bp-panel-url">Ссылка на панель</Label>
            <Input
              id="bp-panel-url"
              value={form.panelUrl}
              onChange={set("panelUrl")}
              placeholder="https://palladium-smm.com"
            />
            <p className="text-xs text-muted-foreground">
              Если не указано — используется домен из API URL
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label htmlFor="bp-key">
              API Key{isEdit && " (оставьте пустым, чтобы не менять)"}
            </Label>
            <Input
              id="bp-key"
              type="password"
              value={form.apiKey}
              onChange={set("apiKey")}
              placeholder={isEdit ? "••••••••" : "ваш ключ из панели"}
              autoComplete="new-password"
            />
          </div>

          {/* Extra params */}
          <div className="space-y-1.5">
            <Label htmlFor="bp-extra">Дополнительные параметры</Label>
            <Input id="bp-extra" value={form.extraParams} onChange={set("extraParams")} placeholder="action=balance" className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">POST-параметры сверх ключа. Для стандартных SMM-панелей: <code>action=balance</code>. Для кастомных (напр. soc-service.com): оставь пустым.</p>
          </div>

          {/* Response type */}
          <div className="space-y-1.5">
            <Label>Формат ответа</Label>
            <div className="flex gap-2">
              {[{value:'json',label:'JSON ({"balance":"..."})'},{value:'text',label:'Число (855.63)'}].map(opt => (
                <button key={opt.value} type="button" onClick={() => setForm(f=>({...f,responseType:opt.value}))}
                  className={cn("rounded-md border px-3 py-1.5 text-sm transition-colors",
                    form.responseType===opt.value?"border-primary bg-primary/10 text-primary":"border-border text-muted-foreground hover:text-foreground")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced: method, key param, response path — shown as collapsible section */}
          <details className="space-y-3 rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground select-none">Расширенные настройки (GET-запросы, вложенный JSON)</summary>
            <div className="mt-3 space-y-3">
              {/* Request method */}
              <div className="space-y-1.5">
                <Label>Метод запроса</Label>
                <div className="flex gap-2">
                  {["POST", "GET"].map(m => (
                    <button key={m} type="button" onClick={() => setForm(f => ({ ...f, requestMethod: m }))}
                      className={cn("rounded-md border px-4 py-1.5 text-sm font-mono transition-colors",
                        form.requestMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {/* Key param name */}
              <div className="space-y-1.5">
                <Label htmlFor="bp-keyparam">Имя параметра ключа</Label>
                <Input id="bp-keyparam" value={form.keyParamName} onChange={set("keyParamName")} placeholder="key" className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">Для TmSMM: <code>token</code>. Стандарт: <code>key</code>.</p>
              </div>
              {/* Response path */}
              <div className="space-y-1.5">
                <Label htmlFor="bp-path">Путь к балансу в ответе</Label>
                <Input id="bp-path" value={form.responsePath} onChange={set("responsePath")} placeholder="balance" className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">Dot-notation. Стандарт: <code>balance</code>. TmSMM: <code>response.success.data.balance.amount</code></p>
              </div>
            </div>
          </details>

          {/* Currency + threshold */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bp-currency">Валюта</Label>
              <Input
                id="bp-currency"
                value={form.currency}
                onChange={set("currency")}
                placeholder="RUB"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bp-threshold">Порог уведомления</Label>
              <Input
                id="bp-threshold"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="font-mono"
                value={form.threshold}
                onChange={set("threshold")}
                placeholder="1000"
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm">Активен</span>
            <Toggle
              checked={form.active}
              onChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
          </div>

          {/* Errors */}
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

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
