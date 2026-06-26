"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { activeItem, sectionForPath } from "@/components/navigation";
import { useNavSections } from "@/components/navigation/NavOrderProvider";
import { SettingsSidebarNav } from "@/components/settings/SettingsSidebarNav";

/** Горизонтальная навигация по пунктам раздела на телефоне (вместо бокового сайдбара). */
export function MobileSubNav() {
  const pathname = usePathname();
  const sections = useNavSections();
  const isSettingsPage = pathname === "/settings";
  const section = sectionForPath(pathname, sections);
  const current = activeItem(section.items, pathname);

  if (!isSettingsPage && section.items.length <= 1) return null;

  return (
    <nav
      aria-label={isSettingsPage ? "Настройки" : section.label}
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-sidebar/80 px-2 py-2 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
    >
      {isSettingsPage ? (
        <SettingsSidebarNav variant="mobile" />
      ) : (
        section.items.map(({ href, label, icon: Icon }) => {
          const active = current?.href === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </Link>
          );
        })
      )}
    </nav>
  );
}
