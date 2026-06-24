import { DashboardHome } from "@/components/DashboardHome";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function HomePage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Обзор</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Сводная статистика по всем заказам.
        </p>
      </header>
      <DashboardHome />
    </div>
  );
}
