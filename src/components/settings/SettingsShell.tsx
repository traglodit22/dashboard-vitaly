"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Bot,
  CloudUpload,
  KeyRound,
  Palette,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { id: "appearance", label: "Оформление", icon: Palette },
  { id: "account", label: "Аккаунт", icon: KeyRound },
  { id: "shipping", label: "Доставка", icon: Truck },
  { id: "automation", label: "Автопроверка", icon: Bell },
  { id: "integrations", label: "API и боты", icon: Bot },
  { id: "backup", label: "Бэкап VPS", icon: CloudUpload },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<SettingsSectionId>("appearance");

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.replace("#", "") as SettingsSectionId;
      if (SETTINGS_SECTIONS.some((s) => s.id === hash)) setActive(hash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const scrollTo = useCallback((id: SettingsSectionId) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <nav
        aria-label="Разделы настроек"
        className="lg:sticky lg:top-20 lg:w-52 lg:shrink-0"
      >
        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => scrollTo(id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active === id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-10">{children}</div>
    </div>
  );
}
