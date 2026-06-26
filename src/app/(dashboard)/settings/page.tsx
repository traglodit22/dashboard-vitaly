import { SettingsClient } from "@/components/settings/SettingsClient";
import { SETTINGS_PAGE_CLASS } from "@/lib/dashboard/pageLayout";

export default function SettingsPage() {
  return (
    <div className={SETTINGS_PAGE_CLASS}>
      <SettingsClient />
    </div>
  );
}
