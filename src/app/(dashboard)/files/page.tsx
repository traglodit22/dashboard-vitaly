import { FilesClient } from "@/components/files/FilesClient";

export default function FilesPage() {
  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Файлы</h1>
        <p className="text-sm text-muted-foreground">
          Важные документы на сервере; остальные категории — в Google Cloud Storage.
        </p>
      </header>
      <FilesClient />
    </div>
  );
}
