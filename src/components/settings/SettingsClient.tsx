"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FolderArchive,
  Globe,
  ImagePlus,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Plus,
  Save,
  Sun,
  Truck,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { useSettingsSection } from "@/components/settings/settingsNav";
import {
  ConfiguredBadge,
  SettingsActions,
  SettingsDivider,
  SettingsField,
  SettingsSection,
  SettingsSubBlock,
  Toggle,
} from "@/components/settings/shared";
import { EMPTY_SETTINGS, formatBytes, formatMsk, type SettingsData } from "@/components/settings/types";
import type { VpsBackupRun, VpsBackupSettings } from "@/lib/backup/types";
import { SECTIONS } from "@/components/navigation";
import { notifyNavOrderChanged } from "@/components/navigation/NavOrderProvider";
import { orderNavSections } from "@/lib/navigation/orderSections";

export function SettingsClient() {
  const [settings, setSettings] = useState<SettingsData>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const activeSection = useSettingsSection();

  const reload = useCallback(async () => {
    const res = await apiFetch("/api/settings", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(String(data.error ?? "Не удалось загрузить настройки"));
    setSettings({
      dobropostEmail: data.dobropostEmail ?? "",
      dobropostConfigured: Boolean(data.dobropostConfigured),
      autoCheckEnabled: Boolean(data.autoCheckEnabled),
      autoCheckIntervalHours: data.autoCheckIntervalHours ?? 12,
      autoCheckLastRunAt: data.autoCheckLastRunAt ?? null,
      telegramNotifyEnabled: Boolean(data.telegramNotifyEnabled),
      telegramNotifyChatIds: Array.isArray(data.telegramNotifyChatIds)
        ? data.telegramNotifyChatIds
        : [],
      telegramBotConfigured: Boolean(data.telegramBotConfigured),
      deepseekConfigured: Boolean(data.deepseekConfigured),
      siteTitle: data.siteTitle ?? "",
      hasFavicon: Boolean(data.hasFavicon),
      navSectionOrder: Array.isArray(data.navSectionOrder) ? data.navSectionOrder : [],
    });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      {activeSection === "appearance" && (
        <AppearanceSection settings={settings} onSaved={reload} />
      )}
      {activeSection === "account" && <AccountSection />}
      {activeSection === "shipping" && (
        <ShippingSection settings={settings} onSaved={reload} />
      )}
      {activeSection === "automation" && (
        <AutomationSection settings={settings} onSaved={reload} />
      )}
      {activeSection === "integrations" && (
        <IntegrationsSection settings={settings} onSaved={reload} />
      )}
      {activeSection === "backup" && <BackupSection />}
    </div>
  );
}

// ─── Оформление ─────────────────────────────────────────────────────────────

function AppearanceSection({
  settings,
  onSaved,
}: {
  settings: SettingsData;
  onSaved: () => Promise<void>;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(settings.siteTitle);
  const [faviconBase64, setFaviconBase64] = useState("");
  const [hasFavicon, setHasFavicon] = useState(settings.hasFavicon);
  const [saving, setSaving] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>([]);
  const [savingNavOrder, setSavingNavOrder] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setTitle(settings.siteTitle);
    setHasFavicon(settings.hasFavicon);
    setNavOrder(
      settings.navSectionOrder.length > 0
        ? settings.navSectionOrder
        : SECTIONS.map((s) => s.key),
    );
  }, [settings.siteTitle, settings.hasFavicon, settings.navSectionOrder]);

  const orderedNavSections = useMemo(
    () => orderNavSections(SECTIONS, navOrder),
    [navOrder],
  );

  function moveNavSection(index: number, direction: -1 | 1) {
    setNavOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveNavOrder() {
    setSavingNavOrder(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ navSectionOrder: navOrder }),
      });
      if (!res.ok) {
        toast.error("Не удалось сохранить порядок меню");
        return;
      }
      toast.success("Порядок вкладок сохранён");
      notifyNavOrderChanged();
      await onSaved();
    } finally {
      setSavingNavOrder(false);
    }
  }

  const themeOptions = [
    { value: "light", label: "Светлая", icon: Sun },
    { value: "dark", label: "Тёмная", icon: Moon },
    { value: "system", label: "Система", icon: Monitor },
  ] as const;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFaviconBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function saveBranding() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { siteTitle: title };
      if (faviconBase64) body.faviconBase64 = faviconBase64;
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Не удалось сохранить");
        return;
      }
      if (faviconBase64) setHasFavicon(true);
      setFaviconBase64("");
      toast.success("Сохранено — перезагрузите страницу для обновления иконки");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function removeFavicon() {
    const res = await apiFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeFavicon: true }),
    });
    if (res.ok) {
      setHasFavicon(false);
      toast.success("Фавиконка удалена");
      await onSaved();
    }
  }

  return (
    <SettingsSection
      id="appearance"
      title="Оформление"
      description="Тема интерфейса, заголовок вкладки и иконка дашборда."
      icon={Globe}
    >
      <SettingsField label="Тема интерфейса">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {themeOptions.map(({ value, label, icon: Icon }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors sm:p-4",
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
      </SettingsField>

      <SettingsDivider />

      <SettingsField label="Порядок вкладок в верхнем меню">
        <p className="mb-3 text-xs text-muted-foreground">
          Первая вкладка станет разделом по умолчанию при открытии логотипа Dashboard.
        </p>
        <div className="space-y-1">
          {orderedNavSections.map((section, index) => (
            <div
              key={section.key}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="flex-1 text-sm font-medium">{section.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                disabled={index === 0}
                onClick={() => moveNavSection(index, -1)}
                aria-label={`Поднять «${section.label}»`}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                disabled={index === navOrder.length - 1}
                onClick={() => moveNavSection(index, 1)}
                aria-label={`Опустить «${section.label}»`}
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => void saveNavOrder()}
          disabled={savingNavOrder}
        >
          {savingNavOrder ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Сохранить порядок
        </Button>
      </SettingsField>

      <SettingsDivider />

      <SettingsField label="Заголовок дашборда">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dashboard"
        />
      </SettingsField>

      <SettingsField
        label={
          <span className="flex flex-wrap items-center gap-2">
            <ImagePlus className="size-4" />
            Фавиконка
            <ConfiguredBadge ok={hasFavicon} label="загружена" />
            {!hasFavicon && (
              <span className="text-xs font-normal text-muted-foreground">не задана</span>
            )}
          </span>
        }
      >
        <Input type="file" accept="image/*" onChange={onFileChange} className="cursor-pointer" />
        {hasFavicon && (
          <button
            type="button"
            onClick={() => void removeFavicon()}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="size-3" />
            Удалить фавиконку
          </button>
        )}
      </SettingsField>

      <SettingsActions>
        <Button onClick={() => void saveBranding()} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Сохранить
        </Button>
      </SettingsActions>
    </SettingsSection>
  );
}

// ─── Аккаунт ────────────────────────────────────────────────────────────────

function AccountSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (next !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    if (next.length < 8) {
      toast.error("Минимум 8 символов");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Не удалось сменить пароль");
        return;
      }
      toast.success("Пароль изменён");
      setCurrent("");
      setNext("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="account"
      title="Аккаунт"
      description="Пароль для входа в дашборд."
      icon={KeyRound}
    >
      <div className="grid gap-4 sm:max-w-md">
        <SettingsField label="Текущий пароль">
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </SettingsField>
        <SettingsField label="Новый пароль" hint="Минимум 8 символов">
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </SettingsField>
        <SettingsField label="Повторите новый пароль">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </SettingsField>
      </div>
      <SettingsActions>
        <Button onClick={() => void save()} disabled={saving || !current || !next || !confirm}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Сменить пароль
        </Button>
      </SettingsActions>
    </SettingsSection>
  );
}

// ─── Доставка ───────────────────────────────────────────────────────────────

function ShippingSection({
  settings,
  onSaved,
}: {
  settings: SettingsData;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState(settings.dobropostEmail);
  const [password, setPassword] = useState("");
  const [configured, setConfigured] = useState(settings.dobropostConfigured);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(settings.dobropostEmail);
    setConfigured(settings.dobropostConfigured);
  }, [settings.dobropostEmail, settings.dobropostConfigured]);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dobropostEmail: email, dobropostPassword: password }),
      });
      if (!res.ok) {
        toast.error("Не удалось сохранить");
        return;
      }
      if (password.trim()) setConfigured(true);
      setPassword("");
      toast.success("Креды ДоброПост сохранены");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="shipping"
      title="Доставка"
      description="Email и пароль аккаунта ДоброПост для отправки посылок по API."
      icon={Truck}
      badge={<ConfiguredBadge ok={configured} />}
    >
      <div className="grid gap-4 sm:max-w-lg">
        <SettingsField label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="account@dobropost.com"
          />
        </SettingsField>
        <SettingsField label="Пароль">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={configured ? "••••••••  (сохранён)" : "пароль ДоброПост"}
          />
        </SettingsField>
      </div>
      <SettingsActions>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Сохранить
        </Button>
      </SettingsActions>
    </SettingsSection>
  );
}

// ─── Автопроверка ───────────────────────────────────────────────────────────

function AutomationSection({
  settings,
  onSaved,
}: {
  settings: SettingsData;
  onSaved: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(settings.autoCheckEnabled);
  const [intervalHours, setIntervalHours] = useState(settings.autoCheckIntervalHours);
  const [lastRunAt, setLastRunAt] = useState(settings.autoCheckLastRunAt);
  const [tgEnabled, setTgEnabled] = useState(settings.telegramNotifyEnabled);
  const [chatIds, setChatIds] = useState<string[]>(settings.telegramNotifyChatIds);
  const [newChatId, setNewChatId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(settings.autoCheckEnabled);
    setIntervalHours(settings.autoCheckIntervalHours);
    setLastRunAt(settings.autoCheckLastRunAt);
    setTgEnabled(settings.telegramNotifyEnabled);
    setChatIds(settings.telegramNotifyChatIds);
  }, [settings]);

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
      if (!res.ok) {
        toast.error("Не удалось сохранить");
        return;
      }
      toast.success("Настройки сохранены");
      await onSaved();
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

  const intervalOptions = [
    { value: 6, label: "6 ч" },
    { value: 12, label: "12 ч" },
    { value: 24, label: "24 ч" },
  ];

  return (
    <SettingsSection
      id="automation"
      title="Автопроверка"
      description="Периодическая проверка заказов «Ожидается на складе» и уведомления в Telegram."
      icon={Bell}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Включить автопроверку</p>
          <p className="text-xs text-muted-foreground">
            Последний запуск: {lastRunAt ? formatMsk(lastRunAt) : "ещё не запускалась"}
          </p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      <SettingsDivider />

      <SettingsField label="Интервал проверки">
        <div className="flex flex-wrap gap-2">
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
      </SettingsField>

      <SettingsDivider />

      <SettingsSubBlock
        title="Уведомления в Telegram"
        description="Напишите боту /myid — он пришлёт chat ID для уведомлений."
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">Отправлять уведомления</span>
          <Toggle checked={tgEnabled} onChange={setTgEnabled} />
        </div>

        {chatIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chatIds.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-mono text-xs"
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
            placeholder="Chat ID"
            className="font-mono text-sm"
          />
          <Button type="button" variant="outline" size="icon" onClick={addChatId} disabled={!newChatId.trim()}>
            <Plus className="size-4" />
          </Button>
        </div>
      </SettingsSubBlock>

      <SettingsActions>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Сохранить
        </Button>
      </SettingsActions>
    </SettingsSection>
  );
}

// ─── Интеграции ─────────────────────────────────────────────────────────────

function IntegrationsSection({
  settings,
  onSaved,
}: {
  settings: SettingsData;
  onSaved: () => Promise<void>;
}) {
  const [botToken, setBotToken] = useState("");
  const [botConfigured, setBotConfigured] = useState(settings.telegramBotConfigured);
  const [deepseekKey, setDeepseekKey] = useState("");
  const [deepseekConfigured, setDeepseekConfigured] = useState(settings.deepseekConfigured);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBotConfigured(settings.telegramBotConfigured);
    setDeepseekConfigured(settings.deepseekConfigured);
  }, [settings.telegramBotConfigured, settings.deepseekConfigured]);

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
      if (!res.ok) {
        toast.error("Не удалось сохранить");
        return;
      }
      if (botToken.trim()) {
        setBotConfigured(true);
        setBotToken("");
      }
      if (deepseekKey.trim()) {
        setDeepseekConfigured(true);
        setDeepseekKey("");
      }
      toast.success("Ключи сохранены");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      id="integrations"
      title="API и боты"
      description="Токены Telegram-бота и DeepSeek. Хранятся в базе — менять без доступа к серверу."
      icon={Bot}
    >
      <div className="grid gap-4 sm:max-w-lg">
        <SettingsField
          label={
            <span className="flex flex-wrap items-center gap-2">
              Telegram Bot Token
              <ConfiguredBadge ok={botConfigured} label="сохранён" />
            </span>
          }
        >
          <Input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={botConfigured ? "••••••••  (оставьте пустым, чтобы не менять)" : "123456789:AAH..."}
            className="font-mono text-sm"
          />
        </SettingsField>
        <SettingsField
          label={
            <span className="flex flex-wrap items-center gap-2">
              DeepSeek API Key
              <ConfiguredBadge ok={deepseekConfigured} label="сохранён" />
            </span>
          }
        >
          <Input
            type="password"
            value={deepseekKey}
            onChange={(e) => setDeepseekKey(e.target.value)}
            placeholder={deepseekConfigured ? "••••••••  (оставьте пустым, чтобы не менять)" : "sk-..."}
            className="font-mono text-sm"
          />
        </SettingsField>
      </div>
      <SettingsActions>
        <Button onClick={() => void save()} disabled={saving || (!botToken.trim() && !deepseekKey.trim())}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Сохранить
        </Button>
      </SettingsActions>
    </SettingsSection>
  );
}

// ─── Бэкап VPS ──────────────────────────────────────────────────────────────

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Воскресенье" },
  { value: 1, label: "Понедельник" },
  { value: 2, label: "Вторник" },
  { value: 3, label: "Среда" },
  { value: 4, label: "Четверг" },
  { value: 5, label: "Пятница" },
  { value: 6, label: "Суббота" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: `${String(hour).padStart(2, "0")}:00`,
}));

function backupKindLabel(kind: VpsBackupRun["kind"]): string {
  if (kind === "daily") return "Ежедневный · БД";
  if (kind === "weekly") return "Еженедельный · БД + файлы";
  return "Ручной";
}

function BackupSection() {
  const [gcsConfigured, setGcsConfigured] = useState(false);
  const [runs, setRuns] = useState<VpsBackupRun[]>([]);
  const [settings, setSettings] = useState<VpsBackupSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingCron, setSavingCron] = useState(false);
  const [includeDatabase, setIncludeDatabase] = useState(true);
  const [includeFiles, setIncludeFiles] = useState(true);

  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [retentionCount, setRetentionCount] = useState(30);
  const [dailyHour, setDailyHour] = useState(3);
  const [weeklyDay, setWeeklyDay] = useState(0);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/settings/backup", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(String(data.error ?? "Не удалось загрузить историю бэкапов"));
    setGcsConfigured(Boolean(data.gcsConfigured));
    setRuns(Array.isArray(data.runs) ? data.runs : []);
    if (data.settings) {
      const s = data.settings as VpsBackupSettings;
      setSettings(s);
      setDailyEnabled(s.dailyEnabled);
      setWeeklyEnabled(s.weeklyEnabled);
      setRetentionCount(s.retentionCount);
      setDailyHour(s.dailyHour);
      setWeeklyDay(s.weeklyDay);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function saveCronSettings() {
    setSavingCron(true);
    try {
      const res = await apiFetch("/api/settings/backup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyEnabled,
          weeklyEnabled,
          retentionCount,
          dailyHour,
          weeklyDay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Не удалось сохранить"));
      setSettings(data.settings as VpsBackupSettings);
      toast.success("Настройки автобэкапа сохранены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingCron(false);
    }
  }

  async function runBackup() {
    if (!includeDatabase && !includeFiles) {
      toast.error("Выберите хотя бы один тип бэкапа");
      return;
    }
    setRunning(true);
    try {
      const res = await apiFetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database: includeDatabase, files: includeFiles }),
      }, 600_000);
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Ошибка бэкапа"));
      toast.success("Бэкап загружен в Google Cloud");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка бэкапа");
    } finally {
      setRunning(false);
    }
  }

  return (
    <SettingsSection
      id="backup"
      title="Бэкап VPS"
      description="Резервные копии базы и локальных файлов в Google Cloud. Автоматически: БД каждый день, БД + файлы раз в неделю."
      icon={Database}
      badge={
        gcsConfigured ? (
          <ConfiguredBadge ok label="GCS подключён" />
        ) : (
          <Badge variant="secondary">GCS не настроен</Badge>
        )
      }
    >
      {!gcsConfigured && (
        <p className="mb-4 text-sm text-muted-foreground">
          Укажите на сервере переменные GCS_BUCKET и ключи сервисного аккаунта (GCS_CREDENTIALS_PATH
          или GCS_PROJECT_ID / GCS_CLIENT_EMAIL / GCS_PRIVATE_KEY).
        </p>
      )}

      <SettingsSubBlock title="Автоматическое резервное копирование">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Ежедневный бэкап БД</p>
              <p className="text-xs text-muted-foreground">
                pg_dump каждый день в выбранный час (Europe/Minsk)
              </p>
            </div>
            <Toggle checked={dailyEnabled} onChange={setDailyEnabled} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Еженедельный бэкап БД + файлы</p>
              <p className="text-xs text-muted-foreground">
                Полный архив uploads в выбранный день недели
              </p>
            </div>
            <Toggle checked={weeklyEnabled} onChange={setWeeklyEnabled} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SettingsField label="Время запуска (Минск)" hint="Cron проверяет каждый час">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={dailyHour}
                onChange={(e) => setDailyHour(Number(e.target.value))}
              >
                {HOUR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </SettingsField>

            <SettingsField label="День недели (полный бэкап)">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={weeklyDay}
                onChange={(e) => setWeeklyDay(Number(e.target.value))}
              >
                {WEEKDAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </SettingsField>

            <SettingsField label="Хранить последних" hint="Старые удаляются из GCS">
              <Input
                type="number"
                min={1}
                max={100}
                value={retentionCount}
                onChange={(e) => setRetentionCount(Number(e.target.value))}
              />
            </SettingsField>
          </div>

          {settings && (
            <p className="text-xs text-muted-foreground">
              Последний ежедневный:{" "}
              {settings.lastDailyAt ? formatMsk(settings.lastDailyAt) : "ещё не было"}
              {" · "}
              Последний еженедельный:{" "}
              {settings.lastWeeklyAt ? formatMsk(settings.lastWeeklyAt) : "ещё не было"}
            </p>
          )}

          <SettingsActions>
            <Button onClick={() => void saveCronSettings()} disabled={savingCron || !gcsConfigured}>
              {savingCron ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Сохранить расписание
            </Button>
          </SettingsActions>
        </div>
      </SettingsSubBlock>

      <SettingsDivider />

      <SettingsSubBlock title="Ручной бэкап">
        <div className="grid gap-3 sm:grid-cols-2">
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
            includeDatabase && "border-primary bg-primary/5",
          )}
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={includeDatabase}
            onChange={(e) => setIncludeDatabase(e.target.checked)}
            disabled={running}
          />
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Database className="size-4 text-primary" />
              База данных
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PostgreSQL dump (pg_dump), сжатый .sql.gz
            </p>
          </div>
        </label>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
            includeFiles && "border-primary bg-primary/5",
          )}
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={includeFiles}
            onChange={(e) => setIncludeFiles(e.target.checked)}
            disabled={running}
          />
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <FolderArchive className="size-4 text-primary" />
              Локальные файлы
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Папка uploads: закупки, локальное облако (не GCS)
            </p>
          </div>
        </label>
        </div>

      <SettingsActions>
        <Button
          onClick={() => void runBackup()}
          disabled={running || !gcsConfigured || (!includeDatabase && !includeFiles)}
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
          {running ? "Создаём бэкап…" : "Создать бэкап"}
        </Button>
      </SettingsActions>
      </SettingsSubBlock>

      <SettingsDivider />

      <SettingsField
        label="История бэкапов"
        hint={`До ${retentionCount} последних записей в GCS: backups/vps/…`}
      >
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Загрузка…
          </div>
        ) : runs.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Бэкапов пока нет</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{formatMsk(run.createdAt)}</p>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {backupKindLabel(run.kind)}
                      {run.source === "cron" ? " · cron" : ""}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {run.databaseKey ? `БД ${formatBytes(run.databaseBytes)}` : null}
                    {run.databaseKey && run.filesKey ? " · " : null}
                    {run.filesKey ? `Файлы ${formatBytes(run.filesBytes)}` : null}
                    {run.status === "error" ? (
                      <span className="text-destructive"> · ошибка</span>
                    ) : null}
                  </p>
                  {run.errorMessage ? (
                    <p className="mt-1 text-xs text-destructive">{run.errorMessage}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {run.databaseUrl ? (
                    <a
                      href={run.databaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium",
                        "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Download className="size-3.5" />
                      БД
                    </a>
                  ) : null}
                  {run.filesUrl ? (
                    <a
                      href={run.filesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium",
                        "hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Download className="size-3.5" />
                      Файлы
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsField>
    </SettingsSection>
  );
}
