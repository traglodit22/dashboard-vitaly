"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Images, Loader2, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import type { FileFolder } from "@/lib/files/types";
import { CloudImageLightbox, LightboxPreviewTrigger } from "@/components/files/CloudImageLightbox";

export interface CloudFileItem {
  id: string;
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

interface CloudFolderViewProps {
  folderId: string;
  folder: FileFolder;
  galleryItems: CloudFileItem[];
  listItems: CloudFileItem[];
  dragItemId: string | null;
  onFolderChange: (folder: FileFolder) => void;
  onItemChange: (item: CloudFileItem) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onGalleryReorder: (ordered: CloudFileItem[]) => void;
  onListReorder: (ordered: CloudFileItem[]) => void;
  renderFileCard: (
    item: CloudFileItem,
    opts: {
      draggable: boolean;
      dragging: boolean;
      onDragStart: () => void;
      onDragEnd: () => void;
      onDragOver: (e: React.DragEvent) => void;
      onDrop: (e: React.DragEvent) => void;
      onRemove: () => void;
      onRename: (title: string) => void;
      onImageClick?: () => void;
    },
  ) => React.ReactNode;
}

export function CloudFolderView({
  folderId,
  folder,
  galleryItems,
  listItems,
  dragItemId,
  onFolderChange,
  onItemChange,
  onDragStart,
  onDragEnd,
  onGalleryReorder,
  onListReorder,
  renderFileCard,
}: CloudFolderViewProps) {
  const [textDraft, setTextDraft] = useState(folder.folderText);
  const [savingText, setSavingText] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageItems = useMemo(
    () =>
      [...galleryItems, ...listItems].filter((i) => i.mimeType.startsWith("image/")),
    [galleryItems, listItems],
  );

  const lightboxIndex = lightboxId
    ? imageItems.findIndex((i) => i.id === lightboxId)
    : -1;

  const openLightbox = useCallback((id: string) => {
    if (imageItems.some((i) => i.id === id)) setLightboxId(id);
  }, [imageItems]);

  useEffect(() => {
    setTextDraft(folder.folderText);
  }, [folder.folderText, folderId]);

  const patchFolder = useCallback(
    async (patch: Partial<FileFolder>) => {
      const res = await apiFetch(`/api/files/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleTextEnabled: patch.moduleTextEnabled ?? folder.moduleTextEnabled,
          moduleGalleryEnabled: patch.moduleGalleryEnabled ?? folder.moduleGalleryEnabled,
          folderText: patch.folderText ?? folder.folderText,
        }),
      });
      const data = await res.json();
      if (res.ok && data.folder) {
        onFolderChange(data.folder);
      } else {
        toast.error("Не удалось сохранить", { description: data.error });
      }
    },
    [folder, folderId, onFolderChange],
  );

  function scheduleTextSave(value: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        setSavingText(true);
        try {
          const res = await apiFetch(`/api/files/folders/${folderId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderText: value }),
          });
          const data = await res.json();
          if (res.ok && data.folder) onFolderChange(data.folder);
        } finally {
          setSavingText(false);
        }
      })();
    }, 700);
  }

  async function setInGallery(item: CloudFileItem, inGallery: boolean) {
    const res = await apiFetch(`/api/files/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inGallery }),
    });
    const data = await res.json();
    if (res.ok && data.item) {
      onItemChange(data.item);
    } else {
      toast.error(inGallery ? "Не удалось добавить в галерею" : "Не удалось убрать из галереи", {
        description: data.error,
      });
    }
  }

  function onGalleryDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!dragItemId) return;
    const item = [...galleryItems, ...listItems].find((i) => i.id === dragItemId);
    if (!item || item.inGallery) return;
    if (!item.mimeType.startsWith("image/")) {
      toast.error("В галерею можно перетаскивать только фото");
      return;
    }
    void setInGallery(item, true);
    onDragEnd();
  }

  function onListDropToRemoveFromGallery(e: React.DragEvent) {
    e.preventDefault();
    if (!dragItemId) return;
    const item = galleryItems.find((i) => i.id === dragItemId);
    if (!item) return;
    void setInGallery(item, false);
    onDragEnd();
  }

  function onGalleryItemDrop(targetId: string) {
    if (!dragItemId || dragItemId === targetId || galleryItems.length < 2) return;
    const fromList = listItems.find((i) => i.id === dragItemId);
    if (fromList?.mimeType.startsWith("image/")) {
      void setInGallery(fromList, true).then(() => onDragEnd());
      return;
    }
    const ids = galleryItems.map((i) => i.id);
    const from = ids.indexOf(dragItemId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...galleryItems];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onGalleryReorder(next);
    onDragEnd();
  }

  return (
    <div className="space-y-6">
      {lightboxIndex >= 0 && (
        <CloudImageLightbox
          images={imageItems}
          index={lightboxIndex}
          onIndexChange={(i) => setLightboxId(imageItems[i]!.id)}
          onClose={() => setLightboxId(null)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Модули папки:</span>
        <Button
          type="button"
          size="sm"
          variant={folder.moduleTextEnabled ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={() => void patchFolder({ moduleTextEnabled: !folder.moduleTextEnabled })}
        >
          <Type className="size-3.5" />
          Текст
        </Button>
        <Button
          type="button"
          size="sm"
          variant={folder.moduleGalleryEnabled ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={() => void patchFolder({ moduleGalleryEnabled: !folder.moduleGalleryEnabled })}
        >
          <Images className="size-3.5" />
          Галерея
        </Button>
      </div>

      {folder.moduleTextEnabled && (
        <div className="flex justify-end">
          <div className="relative w-full max-w-2xl">
            <textarea
              className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed shadow-sm outline-none ring-primary/20 transition-shadow focus:ring-2"
              placeholder="Текст для этой папки — отображается сверху справа"
              value={textDraft}
              onChange={(e) => {
                setTextDraft(e.target.value);
                scheduleTextSave(e.target.value);
              }}
            />
            {savingText && (
              <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      )}

      {folder.moduleGalleryEnabled && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Галерея</h2>
            <p className="text-xs text-muted-foreground">Перетащите фото сюда</p>
          </div>
          <div
            className={cn(
              "min-h-[140px] rounded-xl border border-dashed p-3 transition-colors",
              dragItemId && "border-primary/40 bg-primary/5",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={onGalleryDrop}
          >
            {galleryItems.length === 0 ? (
              <p className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                Пока пусто — перетащите фото из списка ниже
              </p>
            ) : (
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
                {galleryItems.map((item) => (
                  <GalleryTile
                    key={item.id}
                    item={item}
                    dragging={dragItemId === item.id}
                    onDragStart={() => onDragStart(item.id)}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => {
                      if (!dragItemId || dragItemId === item.id) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      onGalleryItemDrop(item.id);
                    }}
                    onRemoveFromGallery={() => void setInGallery(item, false)}
                    onOpen={() => openLightbox(item.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section
        className="space-y-3"
        onDragOver={(e) => {
          if (!folder.moduleGalleryEnabled || !dragItemId) return;
          const inGallery = galleryItems.some((i) => i.id === dragItemId);
          if (!inGallery) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={folder.moduleGalleryEnabled ? onListDropToRemoveFromGallery : undefined}
      >
        <h2 className="text-sm font-medium">
          {folder.moduleGalleryEnabled ? "Остальные файлы" : "Файлы"}
        </h2>
        {listItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {folder.moduleGalleryEnabled ? "Нет файлов вне галереи" : "В этой папке пока нет файлов"}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listItems.map((item) =>
              renderFileCard(item, {
                draggable: listItems.length > 1,
                dragging: dragItemId === item.id,
                onDragStart: () => onDragStart(item.id),
                onDragEnd,
                onDragOver: (e) => {
                  if (!dragItemId || dragItemId === item.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                },
                onDrop: (e) => {
                  e.preventDefault();
                  if (!dragItemId || dragItemId === item.id) return;
                  const next = [...listItems];
                  const from = next.findIndex((i) => i.id === dragItemId);
                  const to = next.findIndex((i) => i.id === item.id);
                  if (from < 0 || to < 0) return;
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved!);
                  onListReorder(next);
                  onDragEnd();
                },
                onRemove: () => {},
                onRename: () => {},
                onImageClick: item.mimeType.startsWith("image/")
                  ? () => openLightbox(item.id)
                  : undefined,
              }),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function GalleryTile({
  item,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemoveFromGallery,
  onOpen,
}: {
  item: CloudFileItem;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemoveFromGallery: () => void;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const previewUrl = `/api/files/${item.id}/preview?v=${encodeURIComponent(item.createdAt)}`;

  return (
    <div
      className={cn(
        "group relative mb-3 break-inside-avoid overflow-hidden rounded-xl bg-muted/30 shadow-sm ring-1 ring-border/60 transition-opacity",
        dragging && "opacity-50",
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className="absolute left-2 top-2 z-10 flex size-7 cursor-grab items-center justify-center rounded-md bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="Перетащить"
      >
        <GripVertical className="size-4" />
      </div>
      <button
        type="button"
        title="Убрать из галереи"
        onClick={onRemoveFromGallery}
        className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-md bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/55 group-hover:opacity-100"
      >
        <X className="size-4" />
      </button>
      <LightboxPreviewTrigger onOpen={onOpen} className="block w-full">
        {!failed ? (
          <>
            {!loaded && (
              <div className="flex aspect-[4/3] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={item.title}
              className={cn("w-full object-cover", !loaded && "hidden")}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              draggable={false}
            />
          </>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-xs text-muted-foreground">
            {item.title}
          </div>
        )}
      </LightboxPreviewTrigger>
      <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{item.title}</p>
    </div>
  );
}
