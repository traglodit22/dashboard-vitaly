"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { sectionForPath, activeItem } from "@/components/navigation";
import { FilesSidebarTree } from "@/components/files/FilesSidebarTree";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const section = sectionForPath(pathname);
  const current = activeItem(section.items, pathname);
  const settingsActive = pathname === "/settings";

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          {section.label}
        </div>
        {section.items.map(({ href, label, icon: Icon }) => {
          const active = current?.href === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        {section.key === "files" && (
          <Suspense fallback={null}>
            <FilesSidebarTree />
          </Suspense>
        )}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            settingsActive
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Settings className="size-4 shrink-0" />
          Настройки
        </Link>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4 shrink-0" />
          Выйти
        </button>
        <div className="px-3 text-xs text-muted-foreground/60">ДоброПост · v0.1</div>
      </div>
    </aside>
  );
}
