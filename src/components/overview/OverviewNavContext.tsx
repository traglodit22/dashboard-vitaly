"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { OverviewSectionId } from "@/components/overview/overviewNav";

const DEFAULT_VISIBLE = new Set<OverviewSectionId>([
  "orders",
  "laslegas",
  "statuses",
]);

type OverviewNavContextValue = {
  visibleIds: Set<OverviewSectionId>;
  setVisibleIds: (ids: Set<OverviewSectionId>) => void;
};

const OverviewNavContext = createContext<OverviewNavContextValue | null>(null);

export function OverviewNavProvider({ children }: { children: React.ReactNode }) {
  const [visibleIds, setVisibleIdsState] = useState<Set<OverviewSectionId>>(
    () => new Set(DEFAULT_VISIBLE),
  );

  const setVisibleIds = useCallback((ids: Set<OverviewSectionId>) => {
    setVisibleIdsState(ids);
  }, []);

  const value = useMemo(
    () => ({ visibleIds, setVisibleIds }),
    [visibleIds, setVisibleIds],
  );

  return (
    <OverviewNavContext.Provider value={value}>{children}</OverviewNavContext.Provider>
  );
}

export function useOverviewNav() {
  return useContext(OverviewNavContext);
}
