"use client";

import { cn } from "@/lib/utils";
import {
  OVERVIEW_SECTIONS,
  scrollToOverviewSection,
  scrollToOverviewTop,
  useOverviewSection,
  type OverviewSectionId,
} from "@/components/overview/overviewNav";
import { useOverviewNav } from "@/components/overview/OverviewNavContext";
import { LayoutDashboard } from "lucide-react";

type Variant = "sidebar" | "mobile";

const linkClass: Record<Variant, (active: boolean) => string> = {
  sidebar: (active) =>
    cn(
      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
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

function NavButton({
  variant,
  active,
  onClick,
  icon: Icon,
  label,
}: {
  variant: Variant;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button type="button" onClick={onClick} className={linkClass[variant](active)}>
      <Icon className={cn("shrink-0", variant === "sidebar" ? "size-4" : "size-3.5")} />
      <span className={variant === "sidebar" ? "truncate" : undefined}>{label}</span>
    </button>
  );
}

export function OverviewSidebarNav({ variant }: { variant: Variant }) {
  const active = useOverviewSection();
  const nav = useOverviewNav();
  const visible = nav?.visibleIds;

  const items = OVERVIEW_SECTIONS.filter((s) => !visible || visible.has(s.id));

  return (
    <>
      <NavButton
        variant={variant}
        active={active === null}
        onClick={scrollToOverviewTop}
        icon={LayoutDashboard}
        label="Сводка"
      />
      {items.map(({ id, label, icon: Icon }) => (
        <NavButton
          key={id}
          variant={variant}
          active={active === id}
          onClick={() => scrollToOverviewSection(id as OverviewSectionId)}
          icon={Icon}
          label={label}
        />
      ))}
    </>
  );
}
