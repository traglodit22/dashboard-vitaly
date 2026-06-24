import { ProcurementClient } from "@/components/procurement/ProcurementClient";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function ProcurementPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Закупки</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Учёт закупок для Китая: сколько нужно, есть на складе и в пути.
        </p>
      </header>
      <ProcurementClient />
    </div>
  );
}
