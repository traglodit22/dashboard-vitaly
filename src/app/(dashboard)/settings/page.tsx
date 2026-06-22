import { SettingsClient } from "@/components/settings/SettingsClient";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground">Интеграция ДоброПост и оформление.</p>
      </header>
      <SettingsClient />
    </div>
  );
}
