"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cloud,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { IMPORTANT_DOCS_SLUG } from "@/lib/files/types";

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
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  hasPreview: boolean;
  createdAt: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesClient() {
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [items, setItems] = useState<FileItem[]>([]);
  const [activeSlug, setActiveSlug] = useState(IMPORTANT_DOCS_SLUG);
  const [gcsConfigured, setGcsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCategory = categories.find((c) => c.slug === activeSlug);

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/files/categories", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Не удалось загрузить категории", { description: data.error });
      return;
    }
    setCategories(data.categories ?? []);
    setGcsConfigured(Boolean(data.gcsConfigured));
    setActiveSlug((prev) => {
      if (prev && (data.categories ?? []).some((c: FileCategory) => c.slug === prev)) {
        return prev;
      }
      return data.categories?.[0]?.slug ?? IMPORTANT_DOCS_SLUG;
    });
  }, []);

  const loadItems = useCallback(async (slug: string) => {
    if (!slug) {
      setItems([]);
      return;
    }
    const res = await apiFetch(`/api/files?categorySlug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    loadCategories().finally(() => setLoading(false));
  }, [loadCategories]);

  useEffect(() => {
    if (activeSlug) loadItems(activeSlug);
  }, [activeSlug, loadItems]);

  async function uploadFiles(fileList: FileList | File[]) {
    if (!activeSlug || !activeCategory) return;
    if (activeCategory.storageType === "gcs" && !gcsConfigured) {
      toast.error("Google Cloud Storage не настроен", {
        description: "Добавьте GCS_* переменные в .env на сервере",
      });
      return;
    }

    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    let ok = 0;
    for (const file of files) {
      const fd = new FormData();
      fd.append("categorySlug", activeSlug);
      fd.append("file", file);
      const res = await apiFetch("/api/files", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        ok += 1;
        setItems((prev) => [data.item, ...prev]);
      } else {
        toast.error(`«${file.name}»`, { description: data.error });
      }
    }
    setUploading(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "Файл загружен" : `Загружено файлов: ${ok}`);
    }
  }

  async function removeItem(item: FileItem) {
    if (!confirm(`Удалить «${item.title}»?`)) return;
    const res = await apiFetch(`/api/files/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-56 shrink-0">
        <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveSlug(cat.slug)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
                activeSlug === cat.slug
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-transparent hover:bg-muted/60",
              )}
            >
              {cat.storageType === "gcs" ? (
                <Cloud className="size-4 shrink-0 text-sky-500" />
              ) : (
                <FolderOpen className="size-4 shrink-0" />
              )}
              {cat.name}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {activeCategory?.storageType === "gcs" && !gcsConfigured && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="py-3 text-sm text-muted-foreground">
              Google Cloud Storage не подключён. Укажите на сервере переменные{" "}
              <code className="text-xs">GCS_PROJECT_ID</code>,{" "}
              <code className="text-xs">GCS_CLIENT_EMAIL</code>,{" "}
              <code className="text-xs">GCS_PRIVATE_KEY</code>,{" "}
              <code className="text-xs">GCS_BUCKET</code>.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{activeCategory?.name ?? "Файлы"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
                uploading ? "opacity-60" : "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
              )}
              onClick={() => !uploading && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!uploading && e.dataTransfer.files.length) {
                  void uploadFiles(e.dataTransfer.files);
                }
              }}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                multiple
                accept={
                  activeCategory?.slug === IMPORTANT_DOCS_SLUG
                    ? "application/pdf,image/*"
                    : undefined
                }
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
                {uploading ? "Загрузка…" : "Перетащите файлы или нажмите для выбора"}
              </p>
              {activeCategory?.slug === IMPORTANT_DOCS_SLUG && (
                <p className="text-xs text-muted-foreground">PDF и фото, до 20 МБ</p>
              )}
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Пока нет файлов</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <FileCard
                key={item.id}
                item={item}
                onRemove={() => void removeItem(item)}
                onRename={(t) => void renameItem(item, t)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FileCard({
  item,
  onRemove,
  onRename,
}: {
  item: FileItem;
  onRemove: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const isPdf = item.mimeType === "application/pdf";
  const previewUrl = `/api/files/${item.id}/preview?v=${encodeURIComponent(item.createdAt)}`;

  useEffect(() => {
    setDraft(item.title);
  }, [item.title]);

  return (
    <Card className="overflow-hidden">
      <a
        href={`/api/files/${item.id}/content`}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-[4/3] bg-muted/40"
      >
        {item.hasPreview || item.mimeType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="size-full object-cover object-top"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FileText className="size-12 text-muted-foreground/50" />
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
                {isPdf ? "PDF" : "Фото"} · {formatBytes(item.sizeBytes)}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5">
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
