"use client";

import { DashboardHome } from "@/components/DashboardHome";
import { OVERVIEW_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export function OverviewPage() {
  return (
    <div className={OVERVIEW_PAGE_CLASS}>
      <header className="mb-6 sm:mb-8">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Обзор</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сводная статистика по заказам, балансам и Las Legas.
        </p>
      </header>
      <DashboardHome />
    </div>
  );
}
