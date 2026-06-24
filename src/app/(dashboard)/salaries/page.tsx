import { SalariesClient } from "@/components/salaries/SalariesClient";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function SalariesPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Зарплаты</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Загрузите отчёт тайм-трекера — часы подставятся каждому сотруднику и
          умножатся на его ставку.
        </p>
      </header>
      <SalariesClient />
    </div>
  );
}
