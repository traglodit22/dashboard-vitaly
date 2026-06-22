import { EmployeesClient } from "@/components/salaries/EmployeesClient";

export default function EmployeesPage() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Сотрудники</h1>
        <p className="text-sm text-muted-foreground">
          Справочник SmmLaba: ставка ₽/час и email из тайм-трекера для расчёта зарплат.
        </p>
      </header>
      <EmployeesClient />
    </div>
  );
}
