/** Файлы и пустые папки из drag-and-drop (сохраняется относительная структура). */
export interface ParsedFolderDrop {
  files: { file: File; relativePath: string }[];
  /** Относительные пути папок, например «Project/docs». */
  directoryPaths: string[];
}

const SKIP_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (cb: (f: File) => void, err?: (e: DOMException) => void) => void;
  createReader: () => {
    readEntries: (
      cb: (entries: FsEntry[]) => void,
      err?: (e: DOMException) => void,
    ) => void;
  };
};

function asEntry(item: DataTransferItem): FsEntry | null {
  const fn = (
    item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }
  ).webkitGetAsEntry;
  return (fn?.() as FsEntry | null | undefined) ?? null;
}

async function readAllDirectoryEntries(reader: {
  readEntries: (
    cb: (entries: FsEntry[]) => void,
    err?: (e: DOMException) => void,
  ) => void;
}): Promise<FsEntry[]> {
  const all: FsEntry[] = [];
  for (;;) {
    const batch = await new Promise<FsEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    all.push(...batch);
  }
  return all;
}

async function walkEntry(
  entry: FsEntry,
  pathPrefix: string,
  files: ParsedFolderDrop["files"],
  directoryPaths: Set<string>,
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject);
    });
    if (SKIP_FILE_NAMES.has(file.name)) return;
    const relativePath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
    files.push({ file, relativePath });
    return;
  }

  if (!entry.isDirectory) return;

  const dirPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
  directoryPaths.add(dirPath);

  const children = await readAllDirectoryEntries(entry.createReader());
  for (const child of children) {
    await walkEntry(child, dirPath, files, directoryPaths);
  }
}

function parseFromFileList(fileList: FileList | File[]): ParsedFolderDrop {
  const files: ParsedFolderDrop["files"] = [];
  const directoryPaths = new Set<string>();

  for (const file of Array.from(fileList)) {
    if (SKIP_FILE_NAMES.has(file.name)) continue;
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath?.replace(/\\/g, "/") ||
      file.name;
    files.push({ file, relativePath: rel });
    const parts = rel.split("/");
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        directoryPaths.add(parts.slice(0, i).join("/"));
      }
    }
  }

  return { files, directoryPaths: [...directoryPaths].sort(byPathDepth) };
}

function byPathDepth(a: string, b: string): number {
  const da = a.split("/").length;
  const db = b.split("/").length;
  return da !== db ? da - db : a.localeCompare(b, "ru");
}

/** Разбирает drop: папки через webkitGetAsEntry, иначе — files / webkitRelativePath. */
export async function parseDroppedItems(
  dataTransfer: DataTransfer,
): Promise<ParsedFolderDrop> {
  const items = Array.from(dataTransfer.items).filter((i) => i.kind === "file");
  const hasEntries = items.some((item) => {
    const entry = asEntry(item);
    return entry?.isDirectory || entry?.isFile;
  });

  if (!hasEntries) {
    if (dataTransfer.files.length) {
      return parseFromFileList(dataTransfer.files);
    }
    return { files: [], directoryPaths: [] };
  }

  const files: ParsedFolderDrop["files"] = [];
  const directoryPaths = new Set<string>();

  for (const item of items) {
    const entry = asEntry(item);
    if (!entry) {
      const file = item.getAsFile();
      if (file && !SKIP_FILE_NAMES.has(file.name)) {
        files.push({ file, relativePath: file.name });
      }
      continue;
    }
    await walkEntry(entry, "", files, directoryPaths);
  }

  return {
    files,
    directoryPaths: [...directoryPaths].sort(byPathDepth),
  };
}

export function splitRelativePath(relativePath: string): {
  folderSegments: string[];
  fileName: string;
} {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) {
    return { folderSegments: [], fileName: "" };
  }
  return {
    folderSegments: parts.slice(0, -1),
    fileName: parts[parts.length - 1]!,
  };
}

/** Для input[type=file] с webkitRelativePath. */
export function parseFileListWithPaths(fileList: FileList | File[]): ParsedFolderDrop {
  return parseFromFileList(fileList);
}
