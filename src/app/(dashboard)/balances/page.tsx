import { BalancesClient } from "@/components/balances/BalancesClient";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function BalancesPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Балансы</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Мониторинг балансов внешних сервисов и уведомления при достижении порога.
        </p>
      </header>
      <BalancesClient />
    </div>
  );
}
