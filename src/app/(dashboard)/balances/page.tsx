import { BalancesClient } from "@/components/balances/BalancesClient";

export default function BalancesPage() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Балансы</h1>
        <p className="text-sm text-muted-foreground">
          Мониторинг балансов внешних сервисов и уведомления при достижении порога.
        </p>
      </header>
      <BalancesClient />
    </div>
  );
}
