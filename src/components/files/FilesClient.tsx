"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, FileText, GripVertical, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { IMPORTANT_DOCS_SLUG, CLOUD_SLUG, type FileFolder } from "@/lib/files/types";
import { FILES_CHANGED_EVENT, filesCategoryPath, notifyFilesChanged } from "@/lib/files/routes";
import { reorderById } from "@/lib/files/reorderList";
import { CloudFolderView } from "@/components/files/CloudFolderView";

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
}

interface BreadcrumbItem {
  id: string;
  name: string;
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
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [folder, setFolder] = useState<FileFolder | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCloudFolder = categorySlug === CLOUD_SLUG && Boolean(currentFolderId);

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

  const refresh = useCallback(async () => {
    await Promise.all([loadItems(), loadBreadcrumb(), loadFolder()]);
  }, [loadItems, loadBreadcrumb, loadFolder]);

  const galleryItems = useMemo(
    () =>
      [...items]
        .filter((i) => i.inGallery)
        .sort(
          (a, b) =>
            a.gallerySortOrder - b.gallerySortOrder ||
            a.title.localeCompare(b.title, "ru"),
        ),
    [items],
  );

  const listItems = useMemo(
    () =>
      [...items]
        .filter((i) => !i.inGallery)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ru")),
    [items],
  );

  useEffect(() => {
    setLoading(true);
    loadMeta()
      .then(() => Promise.all([loadItems(), loadBreadcrumb(), loadFolder()]))
      .finally(() => setLoading(false));
  }, [loadMeta, loadItems, loadBreadcrumb, loadFolder]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(FILES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, onChange);
  }, [refresh]);

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

  function onFileDrop(targetId: string) {
    if (!dragItemId || dragItemId === targetId) return;
    const pool = listItems.length ? listItems : items.filter((i) => !i.inGallery);
    if (pool.length < 2) return;
    const next = reorderById(pool, dragItemId, targetId);
    setDragItemId(null);
    setItems((prev) => {
      const orderMap = new Map(next.map((i) => [i.id, i]));
      return prev.map((i) => orderMap.get(i.id) ?? i);
    });
    void persistFileOrder(next, "files");
  }

  async function uploadGcsFile(file: File): Promise<FileItem> {
    const initRes = await apiFetch(
      "/api/files/gcs-upload-url",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug,
          folderId: currentFolderId,
          fileName: file.name,
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

    let putRes: Response;
    try {
      const fd = new FormData();
      fd.append("uploadUrl", init.uploadUrl as string);
      fd.append("mime", init.mime as string);
      fd.append("fileName", file.name);
      fd.append("file", file);
      putRes = await apiFetch("/api/files/gcs-proxy-put", { method: "POST", body: fd }, 120_000);
    } catch {
      throw new Error("Таймаут загрузки в Google Cloud");
    }

    if (!putRes.ok) {
      const putData = await putRes.json().catch(() => ({}));
      throw new Error(String(putData.error ?? "Google Cloud отклонил загрузку"));
    }

    const doneRes = await apiFetch(
      "/api/files/gcs-complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: init.fileId,
          categorySlug,
          folderId: currentFolderId,
          fileName: file.name,
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

  async function uploadLocalFile(file: File): Promise<FileItem> {
    const fd = new FormData();
    fd.append("categorySlug", categorySlug);
    if (currentFolderId) fd.append("folderId", currentFolderId);
    fd.append("file", file);
    const res = await apiFetch("/api/files", { method: "POST", body: fd }, 120_000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(String(data.error ?? "Ошибка загрузки"));
    }
    return data.item as FileItem;
  }

  async function uploadFiles(fileList: FileList | File[]) {
    if (!category) return;
    if (category.storageType === "gcs" && !gcsConfigured) {
      toast.error("Google Cloud Storage не настроен");
      return;
    }

    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    let ok = 0;
    try {
      for (const file of files) {
        setUploadLabel(file.name);
        try {
          const item =
            category.storageType === "gcs"
              ? await uploadGcsFile(file)
              : await uploadLocalFile(file);
          ok += 1;
          setItems((prev) => [...prev, item]);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Ошибка загрузки";
          toast.error(`«${file.name}»`, { description: message });
        }
      }
      if (ok > 0) {
        notifyFilesChanged();
        toast.success(ok === 1 ? "Файл загружен" : `Загружено файлов: ${ok}`);
      }
    } finally {
      setUploading(false);
      setUploadLabel(null);
    }
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
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      <header className="mb-6 space-y-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
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
                  "max-w-[180px] truncate rounded px-1 transition-colors hover:text-foreground",
                  index === breadcrumb.length - 1 && "font-medium text-foreground",
                )}
                title={crumb.name}
              >
                {crumb.name}
              </Link>
            </span>
          ))}
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{locationTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {category.storageType === "local"
                ? "PDF и фото на сервере · до 20 МБ"
                : "Файлы в Google Cloud Storage"}
              {currentFolderId && " · вложенная папка"}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Загрузить
          </Button>
        </div>
      </header>

      {category.storageType === "gcs" && !gcsConfigured && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-3 text-sm text-muted-foreground">
            Google Cloud Storage не подключён. Настройте GCS_* на сервере.
          </CardContent>
        </Card>
      )}

      <div
        className={cn(
          "mb-6 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors",
          uploading ? "opacity-60" : "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!uploading && e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
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
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="size-8 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {uploading
            ? uploadLabel
              ? `Загрузка «${uploadLabel}»…`
              : "Загрузка…"
            : "Перетащите файлы сюда или нажмите «Загрузить»"}
        </p>
        {!uploading && listItems.length > 1 && (
          <p className="text-xs text-muted-foreground">Порядок карточек — перетаскиванием</p>
        )}
      </div>

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
            }
          }
          galleryItems={galleryItems}
          listItems={listItems}
          dragItemId={dragItemId}
          onFolderChange={setFolder}
          onItemChange={(item) => {
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...item } : i)));
          }}
          onDragStart={setDragItemId}
          onDragEnd={() => setDragItemId(null)}
          onGalleryReorder={(ordered) => {
            const sortMap = new Map(ordered.map((item, i) => [item.id, (i + 1) * 10]));
            setItems((prev) =>
              prev.map((i) =>
                sortMap.has(i.id) ? { ...i, gallerySortOrder: sortMap.get(i.id)! } : i,
              ),
            );
            void persistFileOrder(ordered, "gallery");
          }}
          onListReorder={(ordered) => {
            const sortMap = new Map(ordered.map((item, i) => [item.id, (i + 1) * 10]));
            setItems((prev) =>
              prev.map((i) => (sortMap.has(i.id) ? { ...i, sortOrder: sortMap.get(i.id)! } : i)),
            );
            void persistFileOrder(ordered, "files");
          }}
          renderFileCard={(item, opts) => (
            <FileCard
              key={item.id}
              item={item}
              draggable={opts.draggable}
              dragging={opts.dragging}
              onDragStart={opts.onDragStart}
              onDragEnd={opts.onDragEnd}
              onDragOver={opts.onDragOver}
              onDrop={opts.onDrop}
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
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {currentFolderId ? "В этой папке пока нет файлов" : "Пока нет файлов"}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listItems.map((item) => (
            <FileCard
              key={item.id}
              item={item}
              draggable={listItems.length > 1}
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
                onFileDrop(item.id);
              }}
              onRemove={() => void removeItem(item)}
              onRename={(t) => void renameItem(item, t)}
            />
          ))}
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
}: {
  item: Pick<
    FileItem,
    "id" | "title" | "originalName" | "mimeType" | "sizeBytes" | "hasPreview" | "createdAt"
  >;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewRetryRef = useRef(0);
  const isPdf = item.mimeType === "application/pdf";
  const previewUrl = `/api/files/${item.id}/preview?v=${encodeURIComponent(item.createdAt)}&r=${previewRetry}`;
  const showPreview =
    !previewFailed && (item.hasPreview || item.mimeType.startsWith("image/") || isPdf);

  useEffect(() => {
    setDraft(item.title);
    setPreviewFailed(false);
    setPreviewLoading(true);
    setPreviewRetry(0);
    previewRetryRef.current = 0;
  }, [item.id, item.title, item.createdAt]);

  useEffect(() => {
    if (!showPreview) return;
    const waitMs = isPdf ? 60_000 : 30_000;
    const timer = window.setTimeout(() => {
      setPreviewLoading((loading) => {
        if (!loading) return loading;
        if (previewRetryRef.current < 2) {
          previewRetryRef.current += 1;
          setPreviewRetry(previewRetryRef.current);
          return true;
        }
        setPreviewFailed(true);
        return false;
      });
    }, waitMs);
    return () => window.clearTimeout(timer);
  }, [previewUrl, showPreview, isPdf]);

  return (
    <Card
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group overflow-hidden",
        dragging && "opacity-50 ring-2 ring-primary/40",
      )}
    >
      {draggable && (
        <div
          draggable
          title="Перетащить"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          className="flex cursor-grab items-center gap-1 border-b border-border/50 bg-muted/30 px-2 py-1 text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5 shrink-0" />
          <span className="text-[10px]">перетащить</span>
        </div>
      )}
      <a
        href={`/api/files/${item.id}/content`}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[4/3] bg-muted/40"
      >
        {showPreview ? (
          <>
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className={cn(
                "size-full object-cover object-top",
                previewLoading && "opacity-0",
              )}
              onLoad={() => setPreviewLoading(false)}
              onError={() => {
                if (
                  previewRetryRef.current < 2 &&
                  (isPdf || item.mimeType.startsWith("image/"))
                ) {
                  previewRetryRef.current += 1;
                  const attempt = previewRetryRef.current;
                  window.setTimeout(() => {
                    setPreviewRetry(attempt);
                    setPreviewLoading(true);
                  }, 1500 * attempt);
                  return;
                }
                setPreviewFailed(true);
                setPreviewLoading(false);
              }}
            />
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1">
            <FileText className="size-10 text-muted-foreground/50" />
            {isPdf && <span className="text-xs text-muted-foreground">PDF</span>}
          </div>
        )}
      </a>
      <CardContent className="space-y-2 p-3">
        {editing ? (
          <Input
            autoFocus
            className="h-8 text-sm"
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
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" title={item.title}>
                {item.title}
              </p>
              <p className="truncate text-xs text-muted-foreground" title={item.originalName}>
                {isPdf ? "PDF" : item.mimeType.startsWith("image/") ? "Фото" : "Файл"} ·{" "}
                {formatBytes(item.sizeBytes)}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
