"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SECTIONS, type NavSection } from "@/components/navigation";
import { apiFetch } from "@/lib/apiFetch";
import { orderNavSections } from "@/lib/navigation/orderSections";

export const NAV_ORDER_CHANGED_EVENT = "nav:order-changed";

export function notifyNavOrderChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NAV_ORDER_CHANGED_EVENT));
  }
}

const NavOrderContext = createContext<NavSection[]>(SECTIONS);

export function NavOrderProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrder] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/nav/sections", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.order)) {
        setOrder(data.order as string[]);
      }
    } catch {
      /* остаёмся на дефолте */
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(NAV_ORDER_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(NAV_ORDER_CHANGED_EVENT, onChange);
  }, [load]);

  const sections = useMemo(
    () => orderNavSections(SECTIONS, order),
    [order],
  );

  return (
    <NavOrderContext.Provider value={sections}>{children}</NavOrderContext.Provider>
  );
}

export function useNavSections(): NavSection[] {
  return useContext(NavOrderContext);
}
