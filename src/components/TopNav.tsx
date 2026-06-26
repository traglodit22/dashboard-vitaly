"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionForPath } from "@/components/navigation";
import { useNavSections } from "@/components/navigation/NavOrderProvider";
import { MobileHeaderActions } from "@/components/MobileHeaderActions";

const MOBILE_SECTION_LABEL: Record<string, string> = {
  smmlaba: "Smm",
};

export function TopNav() {
  const pathname = usePathname();
  const sections = useNavSections();
  const active = sectionForPath(pathname, sections);
  const home = sections[0];

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-sidebar px-2 sm:gap-3 sm:px-5">
      <Link
        href={home?.basePath ?? "/"}
        className="flex shrink-0 touch-manipulation items-center gap-2 rounded-lg p-1"
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md shadow-primary/25 sm:size-7">
          <Truck className="size-4" />
        </div>
        <span className="hidden font-semibold tracking-tight sm:inline">Dashboard</span>
      </Link>

      <nav
        aria-label="Разделы"
        className={cn(
          "flex h-full min-w-0 flex-1 items-stretch overflow-x-auto scroll-smooth",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]",
        )}
      >
        {sections.map((section) => {
          const isActive = section.key === active.key;
          const label = MOBILE_SECTION_LABEL[section.key] ?? section.label;
          return (
            <Link
              key={section.key}
              href={section.basePath}
              className={cn(
                "relative flex min-h-10 shrink-0 touch-manipulation items-center px-2.5 text-xs font-medium transition-colors sm:min-h-0 sm:px-4 sm:text-sm",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="sm:hidden">{label}</span>
              <span className="hidden sm:inline">{section.label}</span>
              {isActive && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary sm:inset-x-3" />
              )}
            </Link>
          );
        })}
      </nav>

      <MobileHeaderActions />
    </header>
  );
}
