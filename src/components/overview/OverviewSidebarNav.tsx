"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  OVERVIEW_SECTIONS,
  overviewHref,
  useOverviewSection,
} from "@/components/overview/overviewNav";

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

export function OverviewSidebarNav({ variant }: { variant: Variant }) {
  const active = useOverviewSection();

  return (
    <>
      {OVERVIEW_SECTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <Link
            key={id}
            href={overviewHref(id)}
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
