import { SettingsClient } from "@/components/settings/SettingsClient";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function SettingsPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Настройки</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Интеграция ДоброПост и оформление.</p>
      </header>
      <SettingsClient />
    </div>
  );
}
