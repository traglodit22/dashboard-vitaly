import { ProcurementClient } from "@/components/procurement/ProcurementClient";

export default function ProcurementPage() {
  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Закупки</h1>
        <p className="text-sm text-muted-foreground">
          Учёт закупок для Китая: сколько нужно, есть на складе и в пути.
        </p>
      </header>
      <ProcurementClient />
    </div>
  );
}
