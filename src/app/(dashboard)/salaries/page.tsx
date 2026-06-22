import { SalariesClient } from "@/components/salaries/SalariesClient";

export default function SalariesPage() {
  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Зарплаты</h1>
        <p className="text-sm text-muted-foreground">
          Загрузите отчёт тайм-трекера — часы подставятся каждому сотруднику и
          умножатся на его ставку.
        </p>
      </header>
      <SalariesClient />
    </div>
  );
}
