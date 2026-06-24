export type FileSortKey =
  | "manual"
  | "name-asc"
  | "name-desc"
  | "date-desc"
  | "date-asc"
  | "size-desc"
  | "size-asc"
  | "type-asc";

export const FILE_SORT_OPTIONS: { value: FileSortKey; label: string }[] = [
  { value: "manual", label: "Вручную (перетаскивание)" },
  { value: "name-asc", label: "Имя А → Я" },
  { value: "name-desc", label: "Имя Я → А" },
  { value: "date-desc", label: "Сначала новые" },
  { value: "date-asc", label: "Сначала старые" },
  { value: "size-desc", label: "Сначала крупные" },
  { value: "size-asc", label: "Сначала мелкие" },
  { value: "type-asc", label: "По типу файла" },
];

export interface FileListRow {
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  gallerySortOrder: number;
  createdAt: string;
}

export interface ExtensionOption {
  ext: string;
  label: string;
  count: number;
}

const EXT_LABELS: Record<string, string> = {
  pdf: "PDF",
  jpg: "JPEG",
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  doc: "DOC",
  docx: "DOCX",
  xls: "XLS",
  xlsx: "XLSX",
  txt: "TXT",
  zip: "ZIP",
  dwg: "DWG",
  other: "Другое",
};

export function fileExtension(item: Pick<FileListRow, "originalName" | "mimeType">): string {
  const fromName = item.originalName.split(".").pop()?.toLowerCase();
  if (fromName && fromName !== item.originalName.toLowerCase() && fromName.length <= 8) {
    return fromName;
  }
  if (item.mimeType === "application/pdf") return "pdf";
  if (item.mimeType === "application/msword") return "doc";
  if (
    item.mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (item.mimeType === "application/vnd.ms-excel") return "xls";
  if (
    item.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (item.mimeType === "text/plain") return "txt";
  if (item.mimeType === "application/zip") return "zip";
  if (item.mimeType === "image/vnd.dwg") return "dwg";
  if (item.mimeType === "image/jpeg") return "jpg";
  if (item.mimeType === "image/png") return "png";
  if (item.mimeType === "image/webp") return "webp";
  if (item.mimeType === "image/gif") return "gif";
  return "other";
}

export function extensionLabel(ext: string): string {
  return EXT_LABELS[ext] ?? ext.toUpperCase();
}

export function collectExtensionOptions(items: FileListRow[]): ExtensionOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const ext = fileExtension(item);
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([ext, count]) => ({ ext, label: extensionLabel(ext), count }));
}

export function filterByExtension<T extends FileListRow>(
  items: T[],
  extFilter: string,
): T[] {
  if (extFilter === "all") return items;
  return items.filter((item) => fileExtension(item) === extFilter);
}

function typeSortKey(item: FileListRow): string {
  return `${extensionLabel(fileExtension(item))}:${item.title.toLocaleLowerCase("ru")}`;
}

export function sortFileList<T extends FileListRow>(
  items: T[],
  sortKey: FileSortKey,
  scope: "files" | "gallery",
): T[] {
  const arr = [...items];
  const manualOrder = scope === "gallery" ? "gallerySortOrder" : "sortOrder";

  if (sortKey === "manual") {
    return arr.sort(
      (a, b) =>
        a[manualOrder] - b[manualOrder] ||
        a.title.localeCompare(b.title, "ru"),
    );
  }

  return arr.sort((a, b) => {
    switch (sortKey) {
      case "name-asc":
        return a.title.localeCompare(b.title, "ru");
      case "name-desc":
        return b.title.localeCompare(a.title, "ru");
      case "date-desc":
        return b.createdAt.localeCompare(a.createdAt);
      case "date-asc":
        return a.createdAt.localeCompare(b.createdAt);
      case "size-desc":
        return b.sizeBytes - a.sizeBytes;
      case "size-asc":
        return a.sizeBytes - b.sizeBytes;
      case "type-asc":
        return typeSortKey(a).localeCompare(typeSortKey(b), "ru");
      default:
        return 0;
    }
  });
}
