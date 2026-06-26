"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  Package,
  PieChart,
  Star,
  Wallet,
} from "lucide-react";

export const OVERVIEW_SECTIONS = [
  { id: "orders", label: "Заказы", icon: Package },
  { id: "favorites", label: "Быстрый доступ", icon: Star },
  { id: "balances", label: "Балансы", icon: Wallet },
  { id: "laslegas", label: "Las Legas", icon: Building2 },
  { id: "statuses", label: "Статусы", icon: PieChart },
] as const;

export type OverviewSectionId = (typeof OVERVIEW_SECTIONS)[number]["id"];

export function overviewHref(id: OverviewSectionId): string {
  return `/#${id}`;
}

export function parseOverviewSection(hash: string): OverviewSectionId {
  const id = hash.replace("#", "") as OverviewSectionId;
  return OVERVIEW_SECTIONS.some((s) => s.id === id) ? id : "orders";
}

export function useOverviewSection(): OverviewSectionId {
  const pathname = usePathname();
  const [active, setActive] = useState<OverviewSectionId>("orders");

  useEffect(() => {
    if (pathname !== "/") return;
    const sync = () => setActive(parseOverviewSection(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  return active;
}
