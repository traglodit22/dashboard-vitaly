import { RecipientsClient } from "@/components/recipients/RecipientsClient";
import { DASHBOARD_PAGE_CLASS, DASHBOARD_PAGE_TITLE_CLASS } from "@/lib/dashboard/pageLayout";

export default function RecipientsPage() {
  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <header className="mb-4 sm:mb-6">
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Получатели</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Справочник для подстановки в отправки по очереди.
        </p>
      </header>
      <RecipientsClient />
    </div>
  );
}
