"use client";

import { useEffect, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import {
  gallerySortDate,
  toDateInputValue,
} from "@/lib/gallery/capturedAt";
import type { FileItem } from "@/lib/files/types";
import { cn } from "@/lib/utils";

type GalleryDateEditorProps = {
  item: FileItem;
  onSaved: (item: FileItem) => void;
  /** Тёмная панель лайтбокса */
  variant?: "light" | "dark";
  className?: string;
};

export function GalleryDateEditor({
  item,
  onSaved,
  variant = "light",
  className,
}: GalleryDateEditorProps) {
  const sortIso = gallerySortDate(item);
  const [value, setValue] = useState(() => toDateInputValue(sortIso));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(toDateInputValue(gallerySortDate(item)));
  }, [item.id, item.capturedAt, item.createdAt]);

  const dirty = value !== toDateInputValue(sortIso);

  async function save() {
    if (!value) {
      toast.error("Укажите дату");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/gallery/${item.id}/captured-at`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capturedAt: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(String(data.error ?? "Не удалось сохранить дату"));
      }
      onSaved(data.item as FileItem);
      toast.success("Дата съёмки обновлена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const dark = variant === "dark";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        dark ? "text-white" : "text-foreground",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Calendar className={cn("size-4 shrink-0", dark ? "text-white/70" : "text-muted-foreground")} />
      <label className={cn("text-xs", dark ? "text-white/80" : "text-muted-foreground")}>
        Дата съёмки
      </label>
      <Input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          "h-8 w-[9.5rem] text-xs",
          dark && "border-white/25 bg-white/10 text-white [color-scheme:dark]",
        )}
      />
      <Button
        type="button"
        size="sm"
        variant={dark ? "secondary" : "default"}
        className={cn("h-8", dark && "border-white/20 bg-white/15 text-white hover:bg-white/25")}
        disabled={!dirty || saving}
        onClick={() => void save()}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Сохранить"}
      </Button>
    </div>
  );
}
