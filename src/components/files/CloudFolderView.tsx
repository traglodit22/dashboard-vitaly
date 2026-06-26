"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import {
  isInternalFileDrag,
  preventExternalFileDrag,
  type FileFolder,
} from "@/lib/files/types";
import { CloudImageLightbox } from "@/components/files/CloudImageLightbox";
import { FILE_GRID_CLASS } from "@/lib/files/fileCardLayout";

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
  updatedAt: string;
}

interface CloudFolderViewProps {
  folderId: string;
  folder: FileFolder;
  listItems: CloudFileItem[];
  filesToolbar?: React.ReactNode;
  manualSort: boolean;
  extFilter: string;
  allItemsCount: number;
  dragItemId: string | null;
  onFolderChange: (folder: FileFolder) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onListReorder: (ordered: CloudFileItem[]) => void;
  uploadSlot?: React.ReactNode;
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
  listItems,
  filesToolbar,
  manualSort,
  extFilter,
  allItemsCount,
  dragItemId,
  onFolderChange,
  onDragStart,
  onDragEnd,
  onListReorder,
  uploadSlot,
  renderFileCard,
}: CloudFolderViewProps) {
  const [textDraft, setTextDraft] = useState(folder.folderText);
  const [savingText, setSavingText] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const imageItems = useMemo(
    () => listItems.filter((i) => i.mimeType.startsWith("image/")),
    [listItems],
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs text-muted-foreground">Модули папки:</span>
        <Button
          type="button"
          size="sm"
          variant={folder.moduleTextEnabled ? "default" : "outline"}
          className="h-9 gap-1.5 text-xs sm:h-8"
          onClick={() => void patchFolder({ moduleTextEnabled: !folder.moduleTextEnabled })}
        >
          <Type className="size-3.5" />
          Текст
        </Button>
      </div>

      {filesToolbar && (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2 sm:px-3 sm:py-2.5">
          {filesToolbar}
        </div>
      )}

      {folder.moduleTextEnabled && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Текст</h2>
          <FolderTextArea
            value={textDraft}
            saving={savingText}
            onChange={(value) => {
              setTextDraft(value);
              scheduleTextSave(value);
            }}
          />
        </section>
      )}

      {uploadSlot}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Файлы</h2>
        {listItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {extFilter !== "all" && allItemsCount > 0
              ? "Нет файлов с выбранным типом"
              : "В этой папке пока нет файлов"}
          </p>
        ) : (
          <div className={FILE_GRID_CLASS}>
            {listItems.map((item) =>
              renderFileCard(item, {
                draggable: manualSort && listItems.length > 1,
                dragging: dragItemId === item.id,
                onDragStart: () => onDragStart(item.id),
                onDragEnd,
                onDragOver: (e) => {
                  if (!dragItemId || dragItemId === item.id) return;
                  if (!isInternalFileDrag(e.dataTransfer)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                },
                onDrop: (e) => {
                  if (!isInternalFileDrag(e.dataTransfer)) return;
                  e.preventDefault();
                  if (!manualSort || !dragItemId || dragItemId === item.id) return;
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

function FolderTextArea({
  value,
  saving,
  onChange,
}: {
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full">
      <textarea
        className={cn(
          "min-h-[6rem] max-h-[min(40vh,20rem)] w-full resize-none overflow-y-auto rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm outline-none ring-primary/20 transition-shadow focus:ring-2",
        )}
        placeholder="Текст для этой папки"
        value={value}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
      />
      {saving && (
        <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
