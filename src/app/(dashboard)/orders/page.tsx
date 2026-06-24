import { OrdersClient } from "@/components/orders/OrdersClient";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function OrdersPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Отправки</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Товары и их статусы. Без трек-кода — ждут; с треком — уходят в ДоброПост.
        </p>
      </header>
      <OrdersClient />
    </div>
  );
}
