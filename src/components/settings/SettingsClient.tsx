"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Truck, Loader2, Save, Check, Bell, X, Plus, KeyRound, Bot, Globe, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";

export function SettingsClient() {
  return (
    <div className="space-y-6">
      <DobropostSettings />
      <BrandingSettings />
      <AutoCheckSettings />
      <IntegrationsSettings />
      <PasswordSettings />
      <ThemeSettings />
    </div>
  );
}

// ─── Reusable toggle ────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

// ─── DobroPost ──────────────────────────────────────────────────────────────

function DobropostSettings() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setEmail(d.dobropostEmail ?? "");
          setConfigured(Boolean(d.dobropostConfigured));
        }
      });
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dobropostEmail: email, dobropostPassword: password }),
      });
      if (!res.ok) { toast.error("Не удалось сохранить"); return; }
      if (password.trim()) setConfigured(true);
      setPassword("");
      toast.success("Креды ДоброПост сохранены");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="size-5 text-primary" />
          ДоброПост
          {configured && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-400">
              <Check className="size-3" /> настроено
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Email и пароль аккаунта ДоброПост для отправки посылок по API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="dp-email">Email</Label>
          <Input
            id="dp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="account@dobropost.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dp-pass">Пароль</Label>
          <Input
            id="dp-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={configured ? "••••••••  (сохранён)" : "пароль ДоброПост"}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Branding ───────────────────────────────────────────────────────────────

function BrandingSettings() {
  const [title, setTitle] = useState('');
  const [hasFavicon, setHasFavicon] = useState(false);
  const [faviconBase64, setFaviconBase64] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (!active) return;
      setTitle(d.siteTitle ?? '');
      setHasFavicon(Boolean(d.hasFavicon));
    });
    return () => { active = false; };
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFaviconBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { siteTitle: title };
      if (faviconBase64) body.faviconBase64 = faviconBase64;
      const res = await apiFetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { toast.error('Не удалось сохранить'); return; }
      if (faviconBase64) setHasFavicon(true);
      setFaviconBase64('');
      toast.success('Сохранено — перезагрузите страницу для обновления иконки');
    } finally {
      setSaving(false);
    }
  }

  async function removeFavicon() {
    const res = await apiFetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeFavicon: true }) });
    if (res.ok) { setHasFavicon(false); toast.success('Фавиконка удалена'); }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="size-5 text-primary" />
          Оформление
        </CardTitle>
        <CardDescription>
          Заголовок вкладки браузера и иконка дашборда.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="brand-title">Заголовок дашборда</Label>
          <Input
            id="brand-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dashboard"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <ImagePlus className="size-4" />
            Фавиконка
            {hasFavicon
              ? <span className="text-xs font-normal text-emerald-400 flex items-center gap-1"><Check className="size-3" />загружена</span>
              : <span className="text-xs font-normal text-muted-foreground">не задана</span>
            }
          </Label>
          <Input
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="cursor-pointer"
          />
          {hasFavicon && (
            <button
              type="button"
              onClick={removeFavicon}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="size-3" />
              Удалить фавиконку
            </button>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Auto-check ─────────────────────────────────────────────────────────────

function AutoCheckSettings() {
  const [enabled, setEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(12);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [tgEnabled, setTgEnabled] = useState(false);
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [newChatId, setNewChatId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setEnabled(Boolean(d.autoCheckEnabled));
        setIntervalHours(d.autoCheckIntervalHours ?? 12);
        setLastRunAt(d.autoCheckLastRunAt ?? null);
        setTgEnabled(Boolean(d.telegramNotifyEnabled));
        setChatIds(Array.isArray(d.telegramNotifyChatIds) ? d.telegramNotifyChatIds : []);
      });
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoCheckEnabled: enabled,
          autoCheckIntervalHours: intervalHours,
          telegramNotifyEnabled: tgEnabled,
          telegramNotifyChatIds: chatIds,
        }),
      });
      if (!res.ok) { toast.error("Не удалось сохранить"); return; }
      toast.success("Настройки сохранены");
    } finally {
      setSaving(false);
    }
  }

  function addChatId() {
    const id = newChatId.trim();
    if (!id || chatIds.includes(id)) return;
    setChatIds((prev) => [...prev, id]);
    setNewChatId("");
  }

  const lastRunLabel = lastRunAt
    ? new Date(lastRunAt).toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " МСК"
    : "ещё не запускалась";

  const intervalOptions = [
    { value: 6, label: "6 часов" },
    { value: 12, label: "12 часов" },
    { value: 24, label: "24 часа" },
  ];

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="size-5 text-primary" />
          Автопроверка складских статусов
        </CardTitle>
        <CardDescription>
          Раз в заданный интервал проверяет заказы «Ожидается на складе»
          и уведомляет в Телеграм при изменениях.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Включить автопроверку</p>
            <p className="text-xs text-muted-foreground">Последний запуск: {lastRunLabel}</p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>

        {/* Interval */}
        <div className="space-y-2">
          <Label>Интервал проверки</Label>
          <div className="flex gap-2">
            {intervalOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntervalHours(opt.value)}
                className={cn(
                  "rounded-md border px-4 py-1.5 text-sm font-medium transition-colors",
                  intervalHours === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Telegram */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Уведомления в Телеграм</p>
              <p className="text-xs text-muted-foreground">
                Напиши боту <code className="rounded bg-muted px-1 py-0.5 text-xs">/myid</code> — он пришлёт твой chat ID
              </p>
            </div>
            <Toggle checked={tgEnabled} onChange={setTgEnabled} />
          </div>

          {chatIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chatIds.map((id) => (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-mono"
                >
                  {id}
                  <button
                    type="button"
                    onClick={() => setChatIds((prev) => prev.filter((c) => c !== id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addChatId()}
              placeholder="Chat ID (например: 123456789)"
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" size="icon" onClick={addChatId} disabled={!newChatId.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Integrations (bot token + Anthropic key) ────────────────────────────────

function IntegrationsSettings() {
  const [botToken, setBotToken] = useState("");
  const [botConfigured, setBotConfigured] = useState(false);
  const [deepseekKey, setAnthropicKey] = useState("");
  const [deepseekConfigured, setAnthropicConfigured] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setBotConfigured(Boolean(d.telegramBotConfigured));
        setAnthropicConfigured(Boolean(d.deepseekConfigured));
      });
    return () => { active = false; };
  }, []);

  async function save() {
    if (!botToken.trim() && !deepseekKey.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(botToken.trim() ? { telegramBotToken: botToken.trim() } : {}),
          ...(deepseekKey.trim() ? { deepseekApiKey: deepseekKey.trim() } : {}),
        }),
      });
      if (!res.ok) { toast.error("Не удалось сохранить"); return; }
      if (botToken.trim()) { setBotConfigured(true); setBotToken(""); }
      if (deepseekKey.trim()) { setAnthropicConfigured(true); setAnthropicKey(""); }
      toast.success("Ключи сохранены");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="size-5 text-primary" />
          Интеграции
        </CardTitle>
        <CardDescription>
          Токены для Telegram-бота и Claude AI. Хранятся в базе данных — менять без доступа к серверу.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bot-token" className="flex items-center gap-2">
            Telegram Bot Token
            {botConfigured && <span className="text-xs font-normal text-emerald-400 flex items-center gap-1"><Check className="size-3" />сохранён</span>}
          </Label>
          <Input
            id="bot-token"
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={botConfigured ? "••••••••  (оставьте пустым, чтобы не менять)" : "123456789:AAH..."}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="anthropic-key" className="flex items-center gap-2">
            DeepSeek API Key
            {deepseekConfigured && <span className="text-xs font-normal text-emerald-400 flex items-center gap-1"><Check className="size-3" />сохранён</span>}
          </Label>
          <Input
            id="anthropic-key"
            type="password"
            value={deepseekKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder={deepseekConfigured ? "••••••••  (оставьте пустым, чтобы не менять)" : "sk-..."}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || (!botToken.trim() && !deepseekKey.trim())}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сохранить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Password change ─────────────────────────────────────────────────────────

function PasswordSettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (next !== confirm) { toast.error("Пароли не совпадают"); return; }
    if (next.length < 8) { toast.error("Минимум 8 символов"); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Не удалось сменить пароль"); return; }
      toast.success("Пароль изменён");
      setCurrent(""); setNext(""); setConfirm("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="size-5 text-primary" />
          Смена пароля
        </CardTitle>
        <CardDescription>Пароль для входа в дашборд.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Текущий пароль</Label>
          <Input
            id="pw-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">Новый пароль</Label>
          <Input
            id="pw-new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder="минимум 8 символов"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Повторите новый пароль</Label>
          <Input
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !current || !next || !confirm}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Сменить пароль
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: "Светлая", icon: Sun },
    { value: "dark", label: "Тёмная", icon: Moon },
    { value: "system", label: "Система", icon: Monitor },
  ];

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Тема оформления</CardTitle>
        <CardDescription>Светлая, тёмная или по настройкам системы.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {options.map(({ value, label, icon: Icon }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
