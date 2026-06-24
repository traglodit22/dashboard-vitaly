import { CreateShipmentForm } from "@/components/orders/CreateShipmentForm";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function NewOrderPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Создать отправку</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Товар из Китая → ДоброПост. Получатель назначается по очереди.
        </p>
      </header>
      <CreateShipmentForm />
    </div>
  );
}
