"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

/** Настройки и выход на телефоне (десктоп — в Sidebar). */
export function MobileHeaderActions() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const settingsActive = pathname === "/settings";

  return (
    <div className="flex shrink-0 items-center gap-0.5 md:hidden">
      <Link
        href="/settings"
        aria-label="Настройки"
        title="Настройки"
        className={cn(
          "flex size-10 touch-manipulation items-center justify-center rounded-lg transition-colors",
          settingsActive
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Settings className="size-5" />
      </Link>
      <button
        type="button"
        aria-label="Выйти"
        title="Выйти"
        onClick={() => logout()}
        className="flex size-10 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <LogOut className="size-5" />
      </button>
    </div>
  );
}
