import { CreateShipmentForm } from "@/components/orders/CreateShipmentForm";

export default function NewOrderPage() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Создать отправку</h1>
        <p className="text-sm text-muted-foreground">
          Товар из Китая → ДоброПост. Получатель назначается по очереди.
        </p>
      </header>
      <CreateShipmentForm />
    </div>
  );
}
