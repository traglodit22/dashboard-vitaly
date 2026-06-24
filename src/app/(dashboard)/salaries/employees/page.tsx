import { EmployeesClient } from "@/components/salaries/EmployeesClient";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function EmployeesPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Сотрудники</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Справочник SmmLaba: ставка ₽/час и email из тайм-трекера для расчёта зарплат.
        </p>
      </header>
      <EmployeesClient />
    </div>
  );
}
