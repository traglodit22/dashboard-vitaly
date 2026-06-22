"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS, sectionForPath } from "@/components/navigation";

export function TopNav() {
  const pathname = usePathname();
  const active = sectionForPath(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border bg-sidebar px-5">
      <Link
        href={SECTIONS[0].basePath}
        className="flex items-center gap-2 shrink-0"
      >
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Truck className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Dashboard</span>
      </Link>

      <nav className="flex h-full items-center">
        {SECTIONS.map((section) => {
          const isActive = section.key === active.key;
          return (
            <Link
              key={section.key}
              href={section.basePath}
              className={cn(
                "relative flex h-full items-center px-4 text-sm font-medium transition-colors",
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
