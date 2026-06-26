"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, FileText, FolderTree, GripVertical, Loader2, Pencil, StickyNote, Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { IMPORTANT_DOCS_SLUG, CLOUD_SLUG, MAX_FILE_MB, type FileFolder, FILE_REORDER_DRAG_TYPE } from "@/lib/files/types";
import { FILES_CHANGED_EVENT, filesCategoryPath, notifyFilesChanged, fileDownloadUrl } from "@/lib/files/routes";
import { reorderById } from "@/lib/files/reorderList";
import { uploadFileToGcsWithFallback } from "@/lib/files/gcsDirectUpload";
import {
  captureDropSnapshot,
  parseDropSnapshot,
  parseFileListWithPaths,
  splitRelativePath,
} from "@/lib/files/droppedFolderTree";
import { ensureFolderPath, type FolderPathCache } from "@/lib/files/ensureFolderPath";
import { uploadBaseName } from "@/lib/files/uploadNames";
import { CloudFolderView } from "@/components/files/CloudFolderView";
import { FilesListToolbar } from "@/components/files/FilesListToolbar";
import { FilesSubfolderGrid } from "@/components/files/FilesSubfolderGrid";
import { FilesMobileFolderDrawer } from "@/components/files/FilesMobileFolderDrawer";
import { FilePreviewImage } from "@/components/files/FilePreviewImage";
import { CloudPdfViewer } from "@/components/files/CloudPdfViewer";
import { TextNoteModal } from "@/components/files/TextNoteModal";
import { FILE_GRID_CLASS } from "@/lib/files/fileCardLayout";
import {
  collectExtensionOptions,
  filterByExtension,
  sortFileList,
  type FileSortKey,
} from "@/lib/files/fileListFilters";

interface FileCategory {
  id: string;
  slug: string;
  name: string;
  storageType: "local" | "gcs";
  sortOrder: number;
}

interface FileItem {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  folderId: string | null;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  hasPreview: boolean;
  sortOrder: number;
  inGallery: boolean;
  gallerySortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface ChildFolder {
  id: string;
  name: string;
  sortOrder: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesClient({ categorySlug }: { categorySlug: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <FilesClientInner categorySlug={categorySlug} />
    </Suspense>
  );
}

function FilesClientInner({ categorySlug }: { categorySlug: string }) {
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get("folder");

  const [category, setCategory] = useState<FileCategory | null>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [gcsConfigured, setGcsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [folder, setFolder] = useState<FileFolder | null>(null);
  const [childFolders, setChildFolders] = useState<ChildFolder[]>([]);
  const [sortBy, setSortBy] = useState<FileSortKey>("manual");
  const [extFilter, setExtFilter] = useState("all");
  const [foldersDrawerOpen, setFoldersDrawerOpen] = useState(false);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const noteDisabled =
    uploading || (category?.storageType === "gcs" && !gcsConfigured);
  const isCloudFolder = categorySlug === CLOUD_SLUG && Boolean(currentFolderId);
  const listPrefsKey = `files-list-prefs-${categorySlug}-${currentFolderId ?? "root"}`;

  const loadFolder = useCallback(async () => {
    if (!currentFolderId || categorySlug !== CLOUD_SLUG) {
      setFolder(null);
      return;
    }
    const res = await apiFetch(`/api/files/folders/${currentFolderId}`, { cache: "no-store" });
    const data = await res.json();
    setFolder(res.ok ? (data.folder ?? null) : null);
  }, [categorySlug, currentFolderId]);

  const loadMeta = useCallback(async () => {
    const res = await apiFetch("/api/files/categories", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return;
    setGcsConfigured(Boolean(data.gcsConfigured));
    const cat = (data.categories ?? []).find((c: FileCategory) => c.slug === categorySlug);
    setCategory(cat ?? null);
  }, [categorySlug]);

  const loadItems = useCallback(async () => {
    const params = new URLSearchParams({ categorySlug });
    if (currentFolderId) params.set("folderId", currentFolderId);
    const res = await apiFetch(`/api/files?${params}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
  }, [categorySlug, currentFolderId]);

  const loadBreadcrumb = useCallback(async () => {
    if (!currentFolderId) {
      setBreadcrumb([]);
      return;
    }
    const res = await apiFetch(
      `/api/files/folders?categorySlug=${encodeURIComponent(categorySlug)}&breadcrumbFor=${encodeURIComponent(currentFolderId)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    setBreadcrumb(data.breadcrumb ?? []);
  }, [categorySlug, currentFolderId]);

  const loadChildFolders = useCallback(async () => {
    const params = new URLSearchParams({ categorySlug });
    if (currentFolderId) params.set("parentId", currentFolderId);
    const res = await apiFetch(`/api/files/folders?${params}`, { cache: "no-store" });
    const data = await res.json();
    setChildFolders(
      (data.folders ?? []).map((f: ChildFolder) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder,
      })),
    );
  }, [categorySlug, currentFolderId]);

  const refresh = useCallback(async () => {
    await Promise.all([loadItems(), loadBreadcrumb(), loadFolder(), loadChildFolders()]);
  }, [loadItems, loadBreadcrumb, loadFolder, loadChildFolders]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(listPrefsKey);
      if (raw) {
        const prefs = JSON.parse(raw) as { sortBy?: FileSortKey; extFilter?: string };
        setSortBy(prefs.sortBy ?? "manual");
        setExtFilter(prefs.extFilter ?? "all");
      } else {
        setSortBy("manual");
        setExtFilter("all");
      }
    } catch {
      setSortBy("manual");
      setExtFilter("all");
    }
  }, [listPrefsKey]);

  useEffect(() => {
    localStorage.setItem(listPrefsKey, JSON.stringify({ sortBy, extFilter }));
  }, [listPrefsKey, sortBy, extFilter]);

  const extensionOptions = useMemo(() => collectExtensionOptions(items), [items]);

  useEffect(() => {
    if (extFilter !== "all" && !extensionOptions.some((o) => o.ext === extFilter)) {
      setExtFilter("all");
    }
  }, [extFilter, extensionOptions]);

  const manualSort = sortBy === "manual" && extFilter === "all";

  const listItems = useMemo(() => {
    return sortFileList(filterByExtension(items, extFilter), sortBy, "files");
  }, [items, extFilter, sortBy]);

  const filesToolbar =
    items.length > 0 ? (
      <FilesListToolbar
        sortBy={sortBy}
        onSortChange={setSortBy}
        extFilter={extFilter}
        onExtFilterChange={setExtFilter}
        extensions={extensionOptions}
        totalCount={items.length}
        visibleCount={listItems.length}
      />
    ) : null;

  useEffect(() => {
    setLoading(true);
    loadMeta()
      .then(() =>
        Promise.all([loadItems(), loadBreadcrumb(), loadFolder(), loadChildFolders()]),
      )
      .finally(() => setLoading(false));
  }, [loadMeta, loadItems, loadBreadcrumb, loadFolder, loadChildFolders]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(FILES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, onChange);
  }, [refresh]);

  const pendingPreviewCount = useMemo(
    () =>
      items.filter(
        (i) =>
          !i.hasPreview &&
          (i.mimeType.startsWith("image/") || i.mimeType === "application/pdf"),
      ).length,
    [items],
  );

  useEffect(() => {
    if (pendingPreviewCount === 0) return;
    const interval = window.setInterval(() => void loadItems(), 3000);
    const stop = window.setTimeout(() => window.clearInterval(interval), 120_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [pendingPreviewCount, loadItems, currentFolderId, categorySlug]);

  async function persistFileOrder(ordered: { id: string }[], scope: "files" | "gallery" = "files") {
    const res = await apiFetch("/api/files/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categorySlug,
        folderId: currentFolderId,
        ids: ordered.map((i) => i.id),
        scope,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error("Не удалось сохранить порядок", { description: data.error });
      void loadItems();
      return;
    }
    const sortMap = new Map(ordered.map((item, i) => [item.id, (i + 1) * 10]));
    setItems((prev) =>
      prev.map((item) => {
        if (!sortMap.has(item.id)) return item;
        const order = sortMap.get(item.id)!;
        return scope === "gallery"
          ? { ...item, gallerySortOrder: order }
          : { ...item, sortOrder: order };
      }),
    );
  }

  function handleNoteSaved(item: FileItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        return prev.map((i) => (i.id === item.id ? { ...i, ...item } : i));
      }
      if (item.folderId === currentFolderId) {
        return [...prev, item];
      }
      return prev;
    });
    notifyFilesChanged();
  }

  function onFileDrop(targetId: string) {
    if (!manualSort || !dragItemId || dragItemId === targetId) return;
    const pool = listItems.length ? listItems : items;
    if (pool.length < 2) return;
    const next = reorderById(pool, dragItemId, targetId);
    setDragItemId(null);
    setItems((prev) => {
      const orderMap = new Map(next.map((i) => [i.id, i]));
      return prev.map((i) => orderMap.get(i.id) ?? i);
    });
    void persistFileOrder(next, "files");
  }

  async function uploadGcsFile(file: File, targetFolderId: string | null): Promise<FileItem> {
    const fileName = uploadBaseName(file.name);
    const initRes = await apiFetch(
      "/api/files/gcs-upload-url",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug,
          folderId: targetFolderId,
          fileName,
          size: file.size,
          mime: file.type || "",
        }),
      },
      20_000,
    );
    const init = await initRes.json();
    if (!initRes.ok) {
      throw new Error(String(init.error ?? "Не удалось подготовить загрузку"));
    }

    await uploadFileToGcsWithFallback({
      fileId: init.fileId as string,
      categorySlug,
      folderId: targetFolderId,
      uploadUrl: init.uploadUrl as string,
      file,
      mime: init.mime as string,
      fileName,
    });

    const doneRes = await apiFetch(
      "/api/files/gcs-complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: init.fileId,
          categorySlug,
          folderId: targetFolderId,
          fileName,
          size: file.size,
          mime: init.mime,
        }),
      },
      20_000,
    );
    const done = await doneRes.json();
    if (!doneRes.ok) {
      throw new Error(String(done.error ?? "Не удалось сохранить файл"));
    }
    return done.item as FileItem;
  }

  async function uploadLocalFile(file: File, targetFolderId: string | null): Promise<FileItem> {
    const fd = new FormData();
    fd.append("categorySlug", categorySlug);
    if (targetFolderId) fd.append("folderId", targetFolderId);
    fd.append("file", file);
    const res = await apiFetch("/api/files", { method: "POST", body: fd }, 300_000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(String(data.error ?? "Ошибка загрузки"));
    }
    return data.item as FileItem;
  }

  async function uploadStructuredDrop(parsed: ReturnType<typeof parseFileListWithPaths>) {
    if (!category) return;
    if (category.storageType === "gcs" && !gcsConfigured) {
      toast.error("Google Cloud Storage не настроен");
      return;
    }

    const { files, directoryPaths } = parsed;
    if (!files.length && !directoryPaths.length) return;

    setUploading(true);
    setUploadProgress(null);
    const folderCache: FolderPathCache = new Map();
    let ok = 0;

    try {
      for (const dirPath of directoryPaths) {
        setUploadLabel(dirPath);
        const segments = dirPath.split("/").filter(Boolean);
        await ensureFolderPath(categorySlug, currentFolderId, segments, folderCache);
      }

      const total = files.length;
      if (total > 0) setUploadProgress({ done: 0, total });

      for (const { file, relativePath } of files) {
        setUploadLabel(relativePath);
        const { folderSegments } = splitRelativePath(relativePath);
        let targetFolderId = currentFolderId;
        try {
          if (folderSegments.length) {
            targetFolderId = await ensureFolderPath(
              categorySlug,
              currentFolderId,
              folderSegments,
              folderCache,
            );
          }
          const item =
            category.storageType === "gcs"
              ? await uploadGcsFile(file, targetFolderId)
              : await uploadLocalFile(file, targetFolderId);
          ok += 1;
          if (targetFolderId === currentFolderId) {
            setItems((prev) => [...prev, item]);
          }
          if (total > 0) {
            setUploadProgress((prev) =>
              prev ? { done: prev.done + 1, total: prev.total } : { done: 1, total },
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Ошибка загрузки";
          toast.error(`«${relativePath}»`, { description: message });
        }
      }

      if (ok > 0 || directoryPaths.length > 0) {
        notifyFilesChanged();
        await refresh();
        if (ok > 0) {
          const extra = directoryPaths.length ? " · структура папок сохранена" : "";
          toast.success(
            (ok === 1 ? "Файл загружен" : `Загружено файлов: ${ok}`) + extra,
          );
        } else {
          toast.success("Папки созданы");
        }
      }
    } finally {
      setUploading(false);
      setUploadLabel(null);
      setUploadProgress(null);
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    await uploadStructuredDrop(parseFileListWithPaths(fileList));
  }

  async function handleUploadDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;

    const dt = e.nativeEvent.dataTransfer ?? e.dataTransfer;

    if (dt.files.length > 0) {
      await uploadStructuredDrop(parseFileListWithPaths(dt.files));
      return;
    }

    const snapshot = captureDropSnapshot(dt);
    if (!snapshot.flatFiles.length && !snapshot.directoryEntries.length) {
      toast.error("Не удалось прочитать файлы для загрузки");
      return;
    }

    try {
      const parsed = await parseDropSnapshot(snapshot);
      if (parsed.files.length || parsed.directoryPaths.length) {
        await uploadStructuredDrop(parsed);
        return;
      }
    } catch {
      if (snapshot.flatFiles.length) {
        await uploadStructuredDrop(parseFileListWithPaths(snapshot.flatFiles));
        return;
      }
    }

    toast.error("Не удалось прочитать файлы для загрузки");
  }

  async function removeItem(item: FileItem) {
    if (!confirm(`Удалить «${item.title}»?`)) return;
    const res = await apiFetch(`/api/files/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      notifyFilesChanged();
      toast.success("Удалено");
    } else {
      toast.error("Не удалось удалить");
    }
  }

  async function renameItem(item: FileItem, title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) return;
    const res = await apiFetch(`/api/files/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    const data = await res.json();
    if (res.ok && data.item) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
    }
  }

  const locationTitle =
    breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1]!.name : (category?.name ?? "Файлы");

  const uploadZone = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-3 text-center transition-colors sm:gap-2 sm:py-5",
        uploading ? "opacity-60" : "cursor-pointer hover:border-primary/50 hover:bg-muted/30 active:bg-muted/40",
      )}
      onClick={() => !uploading && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        void handleUploadDrop(e);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept={categorySlug === IMPORTANT_DOCS_SLUG ? "application/pdf,image/*,.pdf" : undefined}
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="size-6 animate-spin text-muted-foreground sm:size-7" />
      ) : (
        <Upload className="size-6 text-muted-foreground sm:size-7" />
      )}
      <p className="text-xs font-medium sm:text-sm">
        {uploading
          ? uploadLabel
            ? uploadProgress
              ? `Загрузка «${uploadLabel}» (${uploadProgress.done}/${uploadProgress.total})…`
              : `Подготовка «${uploadLabel}»…`
            : "Загрузка…"
          : (
            <>
              <span className="sm:hidden">Нажмите, чтобы загрузить</span>
              <span className="hidden sm:inline">
                Перетащите файлы или папки сюда или нажмите «Загрузить»
              </span>
            </>
          )}
      </p>
      {!uploading && manualSort && listItems.length > 1 && !isCloudFolder && (
        <p className="hidden text-[10px] text-muted-foreground sm:block">Порядок карточек — перетаскиванием</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!category) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Категория не найдена</p>;
  }

  return (
    <div className="w-full min-w-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
      <FilesMobileFolderDrawer
        open={foldersDrawerOpen}
        onClose={() => setFoldersDrawerOpen(false)}
      />

      <header className="mb-4 space-y-3 sm:mb-6">
        <div className="flex items-center gap-2 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5"
            onClick={() => setFoldersDrawerOpen(true)}
          >
            <FolderTree className="size-4 shrink-0" />
            <span className="truncate">Папки</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            disabled={noteDisabled}
            onClick={() => setNoteCreateOpen(true)}
          >
            <StickyNote className="size-4" />
            <span className="sr-only">Заметка</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            <span className="sr-only">Загрузить</span>
          </Button>
        </div>

        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 text-sm text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={filesCategoryPath(categorySlug)}
            className={cn(
              "rounded px-1 transition-colors hover:text-foreground",
              !currentFolderId && "font-medium text-foreground",
            )}
          >
            {category.name}
          </Link>
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0" />
              <Link
                href={filesCategoryPath(categorySlug, crumb.id)}
                className={cn(
                  "max-w-[42vw] shrink-0 truncate rounded px-1 transition-colors hover:text-foreground sm:max-w-[180px]",
                  index === breadcrumb.length - 1 && "font-medium text-foreground",
                )}
                title={crumb.name}
              >
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{locationTitle}</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {category.storageType === "local"
                ? `PDF и фото на сервере · до ${MAX_FILE_MB} МБ`
                : `Файлы в Google Cloud · до ${MAX_FILE_MB} МБ через сервер, крупные — напрямую`}
              {currentFolderId && " · вложенная папка"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={noteDisabled}
              onClick={() => setNoteCreateOpen(true)}
            >
              <StickyNote className="size-4" />
              Заметка
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden gap-1.5 sm:inline-flex"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Загрузить
            </Button>
          </div>
        </div>
      </header>

      {noteCreateOpen && category && (
        <TextNoteModal
          mode="create"
          categorySlug={categorySlug}
          folderId={currentFolderId}
          onClose={() => setNoteCreateOpen(false)}
          onSaved={(item) => handleNoteSaved(item as FileItem)}
        />
      )}

      {category.storageType === "gcs" && !gcsConfigured && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-muted-foreground">
            Google Cloud Storage не подключён. Настройте GCS_* на сервере.
          </CardContent>
        </Card>
      )}

      <FilesSubfolderGrid
        folders={childFolders}
        categorySlug={categorySlug}
        currentFolderId={currentFolderId}
      />

      {!isCloudFolder && uploadZone}

      {isCloudFolder ? (
        <CloudFolderView
          folderId={currentFolderId!}
          folder={
            folder ?? {
              id: currentFolderId!,
              categoryId: category.id,
              parentId: null,
              name: locationTitle,
              sortOrder: 0,
              createdAt: "",
              moduleTextEnabled: false,
              moduleGalleryEnabled: false,
              folderText: "",
              isFavorite: false,
            }
          }
          listItems={listItems}
          filesToolbar={filesToolbar}
          manualSort={manualSort}
          extFilter={extFilter}
          allItemsCount={items.length}
          dragItemId={dragItemId}
          onFolderChange={setFolder}
          onDragStart={setDragItemId}
          onDragEnd={() => setDragItemId(null)}
          onListReorder={(ordered) => {
            const sortMap = new Map(ordered.map((item, i) => [item.id, (i + 1) * 10]));
            setItems((prev) =>
              prev.map((i) => (sortMap.has(i.id) ? { ...i, sortOrder: sortMap.get(i.id)! } : i)),
            );
            void persistFileOrder(ordered, "files");
          }}
          uploadSlot={uploadZone}
          renderFileCard={(item, opts) => (
            <FileCard
              key={item.id}
              item={item}
              categorySlug={categorySlug}
              folderId={currentFolderId}
              onNoteSaved={(saved) => {
                const full = items.find((i) => i.id === saved.id);
                if (full) handleNoteSaved({ ...full, ...saved });
              }}
              draggable={opts.draggable}
              dragging={opts.dragging}
              onDragStart={opts.onDragStart}
              onDragEnd={opts.onDragEnd}
              onDragOver={opts.onDragOver}
              onDrop={opts.onDrop}
              onImageClick={opts.onImageClick}
              onRemove={() => {
                const full = items.find((i) => i.id === item.id);
                if (full) void removeItem(full);
              }}
              onRename={(t) => {
                const full = items.find((i) => i.id === item.id);
                if (full) void renameItem(full, t);
              }}
            />
          )}
        />
      ) : items.length === 0 && childFolders.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {currentFolderId ? "В этой папке пока нет файлов" : "Пока нет файлов"}
        </p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {currentFolderId ? "В этой папке пока нет файлов" : "Пока нет файлов"}
        </p>
      ) : (
        <div className="space-y-4">
          {filesToolbar}
          {listItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Нет файлов с выбранным типом
            </p>
          ) : (
        <div className={FILE_GRID_CLASS}>
          {listItems.map((item) => (
            <FileCard
              key={item.id}
              item={item}
              categorySlug={categorySlug}
              folderId={currentFolderId}
              onNoteSaved={(saved) => handleNoteSaved({ ...item, ...saved })}
              draggable={manualSort && listItems.length > 1}
              dragging={dragItemId === item.id}
              onDragStart={() => setDragItemId(item.id)}
              onDragEnd={() => setDragItemId(null)}
              onDragOver={(e) => {
                if (!dragItemId || dragItemId === item.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFileDrop(item.id);
              }}
              onRemove={() => void removeItem(item)}
              onRename={(t) => void renameItem(item, t)}
            />
          ))}
        </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileCard({
  item,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
  onRename,
  onImageClick,
  onNoteSaved,
  categorySlug,
  folderId,
}: {
  item: Pick<
    FileItem,
    | "id"
    | "title"
    | "originalName"
    | "mimeType"
    | "sizeBytes"
    | "hasPreview"
    | "createdAt"
    | "updatedAt"
  >;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  onRename: (title: string) => void;
  onImageClick?: () => void;
  onNoteSaved?: (item: Pick<FileItem, "id" | "title" | "mimeType" | "sizeBytes" | "updatedAt">) => void;
  categorySlug?: string;
  folderId?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const isPdf = item.mimeType === "application/pdf";
  const isImage = item.mimeType.startsWith("image/");
  const isText = item.mimeType === "text/plain";
  const previewUrl =
    isImage || isPdf || item.hasPreview
      ? `/api/files/${item.id}/preview?v=${
          item.hasPreview ? encodeURIComponent(item.updatedAt) : "src"
        }`
      : null;
  const showPreview = Boolean(previewUrl) && !previewFailed;
  const showPending = isPdf && !item.hasPreview && !previewFailed;

  useEffect(() => {
    setDraft(item.title);
    setPreviewFailed(false);
    setPdfOpen(false);
    setTextOpen(false);
  }, [item.id, item.title, item.hasPreview, item.updatedAt]);

  const useLightbox = Boolean(onImageClick && isImage);
  const usePdfViewer = isPdf;
  const useTextEditor = isText;

  function renderPreviewBody() {
    if (showPreview && previewUrl) {
      return (
        <FilePreviewImage
          src={previewUrl}
          className="size-full"
          imgClassName="size-full object-cover object-top"
          onFailed={() => setPreviewFailed(true)}
        />
      );
    }
    if (showPending) {
      return (
        <div className="flex size-full flex-col items-center justify-center gap-0.5">
          <Loader2 className="size-4 animate-spin text-muted-foreground/70" />
          <span className="text-[9px] text-muted-foreground">превью…</span>
        </div>
      );
    }
    return (
      <div className="flex size-full flex-col items-center justify-center gap-0.5">
        <FileText className="size-7 text-muted-foreground/50" />
        {isPdf && <span className="text-[9px] text-muted-foreground">PDF</span>}
        {isText && <span className="text-[9px] text-muted-foreground">TXT</span>}
      </div>
    );
  }

  return (
    <Card
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
      size="sm"
      className={cn(
        "gap-0 py-0 [--card-spacing:0]",
        dragging && "opacity-50 ring-2 ring-primary/40",
      )}
    >
      {pdfOpen && (
        <CloudPdfViewer
          fileId={item.id}
          title={item.title}
          onClose={() => setPdfOpen(false)}
        />
      )}
      {textOpen && categorySlug && onNoteSaved && (
        <TextNoteModal
          mode="edit"
          fileId={item.id}
          initialTitle={item.title}
          categorySlug={categorySlug}
          folderId={folderId ?? null}
          onClose={() => setTextOpen(false)}
          onSaved={onNoteSaved}
        />
      )}
      <div className="flex items-center gap-0.5 border-b border-border/50 bg-muted/25 px-1 py-0.5">
        {draggable ? (
          <div
            draggable
            title="Перетащить"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(FILE_REORDER_DRAG_TYPE, item.id);
              onDragStart();
            }}
            onDragEnd={onDragEnd}
            className="flex size-6 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" />
          </div>
        ) : null}
        {editing ? (
          <Input
            autoFocus
            className="h-6 min-w-0 flex-1 px-1.5 text-[11px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              onRename(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(item.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <>
            <p
              className="min-w-0 flex-1 truncate text-[10px] leading-tight sm:text-[11px]"
              title={`${item.title} · ${formatBytes(item.sizeBytes)}`}
            >
              <span className="font-medium text-foreground">{item.title}</span>
              <span className="text-muted-foreground"> · {formatBytes(item.sizeBytes)}</span>
            </p>
            <div className="flex shrink-0">
              <a
                href={fileDownloadUrl(item.id)}
                download
                title="Скачать оригинал"
                className="flex size-6 touch-manipulation items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Download className="size-3" />
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 touch-manipulation"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 touch-manipulation text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </>
        )}
      </div>
      {useLightbox ? (
        <button
          type="button"
          onClick={onImageClick}
          className="relative block aspect-square w-full cursor-zoom-in bg-muted/40"
        >
          {renderPreviewBody()}
        </button>
      ) : usePdfViewer ? (
        <button
          type="button"
          onClick={() => setPdfOpen(true)}
          className="relative block aspect-square w-full cursor-pointer bg-muted/40"
          title="Открыть PDF"
        >
          {renderPreviewBody()}
        </button>
      ) : useTextEditor ? (
        <button
          type="button"
          onClick={() => setTextOpen(true)}
          className="relative block aspect-square w-full cursor-pointer bg-muted/40"
          title="Открыть заметку"
        >
          {renderPreviewBody()}
        </button>
      ) : (
        <div className="relative block aspect-square bg-muted/40">
          {renderPreviewBody()}
        </div>
      )}
    </Card>
  );
}
