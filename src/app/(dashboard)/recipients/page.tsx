import { RecipientsClient } from "@/components/recipients/RecipientsClient";

export default function RecipientsPage() {
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Получатели</h1>
        <p className="text-sm text-muted-foreground">
          Справочник для подстановки в отправки по очереди.
        </p>
      </header>
      <RecipientsClient />
    </div>
  );
}
