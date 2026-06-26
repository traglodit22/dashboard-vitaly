/** Файлы и пустые папки из drag-and-drop (сохраняется относительная структура). */
import { normalizeDroppedRelativePath } from '@/lib/files/uploadNames';

export interface ParsedFolderDrop {
  files: { file: File; relativePath: string }[];
  /** Относительные пути папок, например «Project/docs». */
  directoryPaths: string[];
}

const SKIP_FILE_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

function droppedRelativePath(file: File): string {
  const raw =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath?.replace(/\\/g, "/") ||
    file.name;
  return normalizeDroppedRelativePath(raw);
}

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
    const rel = droppedRelativePath(file);
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

/** Синхронный снимок drop — Safari очищает DataTransfer сразу после обработчика. */
export interface DropSnapshot {
  flatFiles: File[];
  directoryEntries: FsEntry[];
}

export function captureDropSnapshot(dataTransfer: DataTransfer | null): DropSnapshot {
  const flatFiles: File[] = [];
  const directoryEntries: FsEntry[] = [];
  const seen = new Set<File>();

  if (!dataTransfer) return { flatFiles, directoryEntries };

  const items = dataTransfer.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || item.kind !== "file") continue;

    const entry = asEntry(item);
    if (entry?.isDirectory) {
      directoryEntries.push(entry);
      continue;
    }

    const file = item.getAsFile();
    if (file && !SKIP_FILE_NAMES.has(file.name) && !seen.has(file)) {
      seen.add(file);
      flatFiles.push(file);
      continue;
    }

    if (entry?.isFile) {
      directoryEntries.push(entry);
    }
  }

  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    if (!file || SKIP_FILE_NAMES.has(file.name) || seen.has(file)) continue;
    seen.add(file);
    flatFiles.push(file);
  }

  return { flatFiles, directoryEntries };
}

export async function parseDropSnapshot(snapshot: DropSnapshot): Promise<ParsedFolderDrop> {
  const files: ParsedFolderDrop["files"] = [];
  const directoryPaths = new Set<string>();

  for (const entry of snapshot.directoryEntries) {
    try {
      await walkEntry(entry, "", files, directoryPaths);
    } catch {
      // Safari иногда отдаёт битую entry — пробуем остальные.
    }
  }

  if (files.length || directoryPaths.size) {
    return {
      files,
      directoryPaths: [...directoryPaths].sort(byPathDepth),
    };
  }

  if (snapshot.flatFiles.length) {
    return parseFromFileList(snapshot.flatFiles);
  }

  return { files: [], directoryPaths: [] };
}

/** Разбирает drop: папки через webkitGetAsEntry, иначе — files / webkitRelativePath. */
export async function parseDroppedItems(
  dataTransfer: DataTransfer,
): Promise<ParsedFolderDrop> {
  return parseDropSnapshot(captureDropSnapshot(dataTransfer));
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
