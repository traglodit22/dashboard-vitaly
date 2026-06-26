"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  settingsHref,
  useSettingsSection,
} from "@/components/settings/settingsNav";

type Variant = "sidebar" | "mobile";

const linkClass: Record<Variant, (active: boolean) => string> = {
  sidebar: (active) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    ),
  mobile: (active) =>
    cn(
      "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    ),
};

export function SettingsSidebarNav({ variant }: { variant: Variant }) {
  const active = useSettingsSection();

  return (
    <>
      {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <Link
            key={id}
            href={settingsHref(id)}
            className={linkClass[variant](isActive)}
          >
            <Icon className={cn("shrink-0", variant === "sidebar" ? "size-4" : "size-3.5")} />
            <span className={variant === "sidebar" ? "truncate" : undefined}>{label}</span>
          </Link>
        );
      })}
    </>
  );
}
