"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Database,
  Globe,
  KeyRound,
  Truck,
} from "lucide-react";

export const SETTINGS_SECTIONS = [
  { id: "appearance", label: "Оформление", icon: Globe },
  { id: "account", label: "Аккаунт", icon: KeyRound },
  { id: "shipping", label: "Доставка", icon: Truck },
  { id: "automation", label: "Автопроверка", icon: Bell },
  { id: "integrations", label: "API и боты", icon: Bot },
  { id: "backup", label: "Бэкап VPS", icon: Database },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export function settingsHref(id: SettingsSectionId): string {
  return `/settings#${id}`;
}

export function parseSettingsSection(hash: string): SettingsSectionId {
  const id = hash.replace("#", "") as SettingsSectionId;
  return SETTINGS_SECTIONS.some((s) => s.id === id) ? id : "appearance";
}

export function useSettingsSection(): SettingsSectionId {
  const pathname = usePathname();
  const [active, setActive] = useState<SettingsSectionId>("appearance");

  useEffect(() => {
    if (pathname !== "/settings") return;
    const sync = () => setActive(parseSettingsSection(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  return active;
}
