"use client";

import { DashboardHome } from "@/components/DashboardHome";
import { OVERVIEW_PAGE_CLASS } from "@/lib/dashboard/pageLayout";

export function OverviewPage() {
  return (
    <div className={OVERVIEW_PAGE_CLASS}>
      <DashboardHome />
    </div>
  );
}
