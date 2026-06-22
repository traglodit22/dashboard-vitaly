import { DashboardHome } from "@/components/DashboardHome";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Обзор</h1>
        <p className="text-sm text-muted-foreground">
          Сводная статистика по всем заказам.
        </p>
      </header>
      <DashboardHome />
    </div>
  );
}
