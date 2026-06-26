"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import type { ProcurementItem } from "@/lib/procurement/mapRow";
import { STORES, type StoreType } from "@/types";
import { detectStoreFromUrl } from "@/lib/stores/detectStoreFromUrl";

const QTY_CLASS = {
  compact:
    "h-8 w-[4.5rem] min-w-[4.5rem] shrink-0 px-1.5 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
  comfortable:
    "h-10 min-w-0 flex-1 px-2 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
};

export function QtyStepper({
  value,
  onChange,
  onBlur,
  onBump,
  size = "compact",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onBump: (delta: number) => void;
  size?: "compact" | "comfortable";
}) {
  const bumpClass =
    size === "comfortable"
      ? "flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      : "flex size-3.5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className={cn("flex items-center", size === "comfortable" ? "gap-1" : "gap-0.5")}>
      <Input
        type="number"
        min={0}
        className={QTY_CLASS[size]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <div className="flex shrink-0 flex-col gap-px">
        <button type="button" aria-label="Увеличить на 1" onClick={() => onBump(1)} className={bumpClass}>
          <ChevronUp className={size === "comfortable" ? "size-3.5" : "size-3"} />
        </button>
        <button type="button" aria-label="Уменьшить на 1" onClick={() => onBump(-1)} className={bumpClass}>
          <ChevronDown className={size === "comfortable" ? "size-3.5" : "size-3"} />
        </button>
      </div>
    </div>
  );
}

export function ItemImageCell({
  item,
  onUpdated,
  className,
}: {
  item: ProcurementItem;
  onUpdated: (item: ProcurementItem) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const hasImage = Boolean(item.imageMime);
  const imageUrl = hasImage
    ? `/api/procurement/items/${item.id}/image?v=${encodeURIComponent(item.imageUpdatedAt ?? "")}`
    : null;

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Нужен файл изображения");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch(`/api/procurement/items/${item.id}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Не удалось загрузить фото", { description: data.error });
        return;
      }
      onUpdated(data.item);
      toast.success("Фото загружено");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    const res = await apiFetch(`/api/procurement/items/${item.id}/image`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Не удалось удалить фото");
      return;
    }
    onUpdated(data.item);
  }

  function onDropFile(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div
      className={cn(
        "group relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30 transition-colors",
        dragOver && "border-primary bg-primary/10",
        hasImage && "border-solid border-border bg-background",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={onDropFile}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : hasImage && imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <button
          type="button"
          className="flex size-full flex-col items-center justify-center text-muted-foreground hover:text-foreground"
          title="Перетащите фото или нажмите"
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon className="size-4" />
        </button>
      )}
      {!uploading && hasImage && (
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20"
            title="Заменить"
            onClick={() => inputRef.current?.click()}
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20"
            title="Удалить"
            onClick={() => void removeImage()}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function LinkCell({
  link,
  store,
  onSave,
}: {
  link: string | null;
  store: StoreType | null;
  onSave: (link: string | null, store: StoreType | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(link ?? "");
  const [shop, setShop] = useState(store ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUrl(link ?? "");
    setShop(store ?? "");
  }, [link, store]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const href = link?.trim() ?? "";
  const valid = Boolean(href && /^https?:\/\//i.test(href));
  const display = store || (valid ? "ссылка" : "");

  function onUrlChange(next: string) {
    setUrl(next);
    const detected = detectStoreFromUrl(next);
    if (detected) setShop(detected);
  }

  async function save() {
    const u = url.trim();
    const s = shop.trim();
    if (u && !/^https?:\/\//i.test(u)) {
      toast.error("URL должен начинаться с http:// или https://");
      return;
    }
    const storeValue =
      s && (STORES as readonly string[]).includes(s) ? (s as StoreType) : null;
    await onSave(u || null, storeValue);
    setOpen(false);
  }

  async function clear() {
    await onSave(null, null);
    setUrl("");
    setShop("");
    setOpen(false);
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <div className="flex min-w-0 items-center gap-0.5">
        {valid && display ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate text-xs text-primary underline-offset-2 hover:underline sm:text-sm"
            title={href}
          >
            {display}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="truncate text-xs text-muted-foreground hover:text-foreground sm:text-sm"
          >
            + ссылка
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex size-8 shrink-0 touch-manipulation items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Изменить ссылку"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(100vw-2rem,14rem)] rounded-lg border bg-card p-2.5 shadow-lg ring-1 ring-foreground/10 sm:w-56">
          <div className="space-y-2">
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                autoFocus
                className="h-9 text-sm"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Магазин</Label>
              <Select value={shop} onValueChange={(v) => setShop(v ?? "")}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="Выберите магазин" />
                </SelectTrigger>
                <SelectContent>
                  {STORES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" className="h-9 text-sm" onClick={() => void save()}>
                OK
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 text-sm"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              {valid && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 text-sm text-destructive"
                  onClick={() => void clear()}
                >
                  Удалить
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
