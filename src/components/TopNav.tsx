"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionForPath } from "@/components/navigation";
import { useNavSections } from "@/components/navigation/NavOrderProvider";

export function TopNav() {
  const pathname = usePathname();
  const sections = useNavSections();
  const active = sectionForPath(pathname, sections);
  const home = sections[0];

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-sidebar px-3 sm:gap-6 sm:px-5">
      <Link href={home?.basePath ?? "/"} className="flex shrink-0 items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Truck className="size-4" />
        </div>
        <span className="hidden font-semibold tracking-tight sm:inline">Dashboard</span>
      </Link>

      <nav className="flex h-full min-w-0 flex-1 items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const isActive = section.key === active.key;
          return (
            <Link
              key={section.key}
              href={section.basePath}
              className={cn(
                "relative flex h-full shrink-0 items-center px-3 text-sm font-medium transition-colors sm:px-4",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {section.label}
              {isActive && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
