import { OrdersClient } from "@/components/orders/OrdersClient";

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Отправки</h1>
        <p className="text-sm text-muted-foreground">
          Товары и их статусы. Без трек-кода — ждут; с треком — уходят в ДоброПост.
        </p>
      </header>
      <OrdersClient />
    </div>
  );
}
