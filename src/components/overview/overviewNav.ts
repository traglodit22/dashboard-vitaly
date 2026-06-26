"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  Package,
  Star,
  Wallet,
} from "lucide-react";
import { useOverviewNav } from "@/components/overview/OverviewNavContext";

export const OVERVIEW_SECTIONS = [
  { id: "orders", label: "Заказы", icon: Package },
  { id: "favorites", label: "Быстрый доступ", icon: Star },
  { id: "balances", label: "Балансы", icon: Wallet },
  { id: "laslegas", label: "Las Legas", icon: Building2 },
] as const;

export type OverviewSectionId = (typeof OVERVIEW_SECTIONS)[number]["id"];

export function scrollToOverviewSection(id: OverviewSectionId) {
  const el = document.getElementById(id);
  if (!el) return false;
  window.history.replaceState(null, "", `/#${id}`);
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

export function scrollToOverviewTop() {
  window.history.replaceState(null, "", "/");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function parseOverviewSection(hash: string): OverviewSectionId | null {
  const id = hash.replace("#", "") as OverviewSectionId;
  return OVERVIEW_SECTIONS.some((s) => s.id === id) ? id : null;
}

/** Подсветка пункта при прокрутке или якоре в URL. */
export function useOverviewSection(): OverviewSectionId | null {
  const pathname = usePathname();
  const nav = useOverviewNav();
  const [active, setActive] = useState<OverviewSectionId | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;

    const syncFromHash = () => {
      const fromHash = parseOverviewSection(window.location.hash);
      if (fromHash) setActive(fromHash);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    const observe = () => {
      const sectionEls = OVERVIEW_SECTIONS.map((s) => document.getElementById(s.id)).filter(
        Boolean,
      ) as HTMLElement[];

      if (!sectionEls.length) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible[0]?.target.id) {
            setActive(visible[0].target.id as OverviewSectionId);
          }
        },
        { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
      );

      for (const el of sectionEls) observer.observe(el);
      return observer;
    };

    let observer = observe();
    const retry = window.setTimeout(() => {
      observer?.disconnect();
      observer = observe();
    }, 300);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.clearTimeout(retry);
      observer?.disconnect();
    };
  }, [pathname, nav?.visibleIds]);

  return active;
}
