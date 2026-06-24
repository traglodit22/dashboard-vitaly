"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Images, Calendar, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CloudImageLightbox } from "@/components/files/CloudImageLightbox";
import { FilePreviewImage } from "@/components/files/FilePreviewImage";
import { FILE_GRID_CLASS } from "@/lib/files/fileCardLayout";
import { uploadFileToGcsWithFallback } from "@/lib/files/gcsDirectUpload";
import type { FileItem } from "@/lib/files/types";
import { GALLERY_SLUG } from "@/lib/files/types";
import { apiFetch } from "@/lib/apiFetch";
import {
  extractCapturedAtBrowser,
  sha256HexBrowser,
} from "@/lib/gallery/clientImageMeta";
import type { GalleryYearGroup } from "@/lib/gallery/groupByDate";
import {
  galleryDayAnchor,
  galleryMonthAnchor,
  parseGalleryHash,
  scrollToGalleryAnchor,
} from "@/lib/gallery/groupByDate";
import { notifyGalleryChanged } from "@/lib/gallery/galleryRoutes";
import { GallerySidebarCalendar } from "@/components/gallery/GallerySidebarCalendar";
import { GalleryDateEditor } from "@/components/gallery/GalleryDateEditor";
import { gallerySortDate } from "@/lib/gallery/capturedAt";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_PAGE_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from "@/lib/dashboard/pageLayout";

interface PendingUpload {
  file: File;
  contentHash: string;
  capturedAt: string | null;
}

export function GalleryClient() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [grouped, setGrouped] = useState<GalleryYearGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/gallery");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(String(data.error ?? "Не удалось загрузить галерею"));
    }
    setItems(data.items as FileItem[]);
    setGrouped(data.grouped as GalleryYearGroup[]);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    if (loading || !grouped.length) return;
    const parsed = parseGalleryHash(window.location.hash);
    if (!parsed) return;
    const t = window.setTimeout(() => {
      scrollToGalleryAnchor(parsed.year, parsed.month, parsed.day, "auto");
    }, 80);
    return () => window.clearTimeout(t);
  }, [loading, grouped]);

  const flatImages = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.title,
        createdAt: gallerySortDate(item),
      })),
    [items],
  );

  const lightboxIndex = lightboxId
    ? flatImages.findIndex((i) => i.id === lightboxId)
    : -1;

  const lightboxItem = lightboxId
    ? items.find((i) => i.id === lightboxId) ?? null
    : null;

  const handleDateSaved = useCallback(
    async (updated: FileItem) => {
      await load();
      notifyGalleryChanged();
      setLightboxId(updated.id);
    },
    [load],
  );

  async function prepareUploads(files: File[]): Promise<PendingUpload[]> {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      toast.error("Выберите файлы изображений");
      return [];
    }
    if (images.length < files.length) {
      toast.message("Пропущены не-изображения", {
        description: `Загружаем ${images.length} из ${files.length}`,
      });
    }

    const pending: PendingUpload[] = [];
    for (const file of images) {
      const [contentHash, capturedAt] = await Promise.all([
        sha256HexBrowser(file),
        extractCapturedAtBrowser(file),
      ]);
      pending.push({ file, contentHash, capturedAt });
    }

    const res = await apiFetch("/api/gallery/check-hashes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashes: pending.map((p) => p.contentHash) }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(String(data.error ?? "Проверка дублей не удалась"));
    }
    const existing = data.existing as Record<string, FileItem>;

    const unique: PendingUpload[] = [];
    let skipped = 0;
    for (const p of pending) {
      if (existing[p.contentHash]) {
        skipped += 1;
        continue;
      }
      unique.push(p);
    }
    if (skipped) {
      toast.message(
        skipped === 1 ? "1 дубликат пропущен" : `${skipped} дубликатов пропущено`,
      );
    }
    return unique;
  }

  async function uploadOne(pending: PendingUpload): Promise<FileItem | null> {
    const { file, contentHash, capturedAt } = pending;
    const initRes = await apiFetch(
      "/api/files/gcs-upload-url",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug: GALLERY_SLUG,
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

    await uploadFileToGcsWithFallback({
      uploadUrl: init.uploadUrl as string,
      file,
      mime: init.mime as string,
      fileName: file.name,
    });

    const doneRes = await apiFetch(
      "/api/files/gcs-complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: init.fileId,
          categorySlug: GALLERY_SLUG,
          fileName: file.name,
          size: file.size,
          mime: init.mime,
          contentHash,
          capturedAt,
        }),
      },
      20_000,
    );
    const done = await doneRes.json();
    if (!doneRes.ok) {
      throw new Error(String(done.error ?? "Не удалось сохранить фото"));
    }
    if (done.duplicate) {
      return null;
    }
    return done.item as FileItem;
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;

    setUploading(true);
    let ok = 0;
    try {
      const queue = await prepareUploads(files);
      if (!queue.length) return;

      for (const pending of queue) {
        setUploadLabel(pending.file.name);
        try {
          const item = await uploadOne(pending);
          if (item) {
            ok += 1;
            setItems((prev) => [item, ...prev]);
          }
        } catch (err) {
          toast.error(`«${pending.file.name}»`, {
            description: err instanceof Error ? err.message : "Ошибка",
          });
        }
      }
      if (ok) {
        toast.success(ok === 1 ? "Фото загружено" : `Загружено фото: ${ok}`);
        await load();
        notifyGalleryChanged();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      setUploadLabel(null);
    }
  }

  const uploadZone = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-4 text-center transition-colors sm:gap-2 sm:py-6",
        uploading
          ? "opacity-60"
          : "cursor-pointer hover:border-primary/50 hover:bg-muted/30 active:bg-muted/40",
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
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      ) : (
        <Upload className="size-7 text-muted-foreground" />
      )}
      <p className="text-sm text-muted-foreground">
        {uploading
          ? uploadLabel
            ? `Загрузка «${uploadLabel}»…`
            : "Загрузка…"
          : "Перетащите фото или нажмите для выбора"}
      </p>
      <p className="text-[11px] text-muted-foreground/80">
        Дата съёмки из EXIF · дубликаты пропускаются
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className={cn(DASHBOARD_PAGE_CLASS, "flex items-center justify-center py-20")}>
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn(DASHBOARD_PAGE_CLASS, "max-w-none lg:pr-4")}>
      <div className="mb-4 flex items-center gap-2">
        <Images className="size-6 text-primary" />
        <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>Галерея</h1>
        <span className="text-sm text-muted-foreground">{items.length} фото</span>
      </div>

      {uploadZone}

      <details className="mb-4 rounded-lg border border-border/60 md:hidden">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">
          Календарь по датам
        </summary>
        <div className="max-h-72 overflow-y-auto border-t border-border/60 p-2">
          <GallerySidebarCalendar />
        </div>
      </details>

      {!grouped.length ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Пока нет фотографий. Загрузите первые — они появятся по дате съёмки.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map((yearGroup) => (
            <section key={yearGroup.year} id={`year-${yearGroup.year}`}>
              <h2 className="sticky top-0 z-10 -mx-1 mb-3 border-b border-border/60 bg-background/95 px-1 py-2 text-lg font-semibold backdrop-blur-sm">
                {yearGroup.year}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {yearGroup.total}
                </span>
              </h2>
              <div className="space-y-6">
                {yearGroup.months.map((month) => (
                  <div
                    key={`${yearGroup.year}-${month.month}`}
                    id={galleryMonthAnchor(yearGroup.year, month.month)}
                    className="scroll-mt-16"
                  >
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                      {month.label}
                      <span className="ml-1.5 text-xs">({month.items.length})</span>
                    </h3>
                    <div className="space-y-4">
                      {month.days.map((day) => (
                        <div
                          key={`${day.year}-${day.month}-${day.day}`}
                          id={galleryDayAnchor(day.year, day.month, day.day)}
                          className="scroll-mt-16"
                        >
                          {month.days.length > 1 && (
                            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground/80">
                              {day.label}
                            </p>
                          )}
                          <div className={FILE_GRID_CLASS}>
                            {day.items.map((item) => (
                              <GalleryThumb
                                key={item.id}
                                item={item}
                                onOpen={() => setLightboxId(item.id)}
                                onDateSaved={handleDateSaved}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {lightboxIndex >= 0 && lightboxItem && (
        <CloudImageLightbox
          images={flatImages}
          index={lightboxIndex}
          onIndexChange={(i) => setLightboxId(flatImages[i]?.id ?? null)}
          onClose={() => setLightboxId(null)}
          footer={
            <GalleryDateEditor
              key={lightboxItem.id}
              item={lightboxItem}
              variant="dark"
              onSaved={handleDateSaved}
            />
          }
        />
      )}
    </div>
  );
}

function GalleryThumb({
  item,
  onOpen,
  onDateSaved,
}: {
  item: FileItem;
  onOpen: () => void;
  onDateSaved: (item: FileItem) => void | Promise<void>;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const previewUrl = `/api/files/${item.id}/preview?v=${
    item.hasPreview ? encodeURIComponent(item.updatedAt) : "src"
  }`;
  const dateLabel = formatPhotoDate(gallerySortDate(item));

  return (
    <div className="group relative aspect-square">
      <button
        type="button"
        className="size-full overflow-hidden rounded-lg border border-border/60 bg-muted/30 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => {
          if (!editingDate) onOpen();
        }}
        title={item.title}
      >
        <FilePreviewImage
          src={previewUrl}
          alt={item.title}
          className="size-full"
          imgClassName="size-full object-cover object-center transition-transform group-hover:scale-[1.02]"
        />
        {!editingDate && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white/90 opacity-0 transition-opacity group-hover:opacity-100 sm:text-[11px]">
            {dateLabel}
          </span>
        )}
      </button>
      <button
        type="button"
        title="Изменить дату съёмки"
        className={cn(
          "absolute right-1 top-1 z-10 flex size-7 items-center justify-center rounded-md bg-black/50 text-white backdrop-blur-sm transition-opacity",
          editingDate ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          setEditingDate((v) => !v);
        }}
      >
        <Calendar className="size-3.5" />
      </button>
      {editingDate && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 rounded-b-lg border-t border-border bg-background/95 p-2 shadow-lg backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <GalleryDateEditor
            item={item}
            onSaved={async (updated) => {
              await onDateSaved(updated);
              setEditingDate(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function formatPhotoDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
