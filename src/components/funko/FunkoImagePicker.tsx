"use client";

import { useEffect, useState } from "react";
import { Check, ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import type { FunkoImageSuggestion, FunkoItem } from "@/lib/funko/types";
import { cn } from "@/lib/utils";

export function FunkoImagePicker({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: FunkoItem | null;
  onClose: () => void;
  onSaved: (item: FunkoItem) => void;
}) {
  const [suggestions, setSuggestions] = useState<FunkoImageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/funko/${item.id}/image-suggestions`);
        const data = await res.json();
        if (!res.ok) throw new Error(String(data.error ?? "Ошибка загрузки"));
        setSuggestions((data.suggestions as FunkoImageSuggestion[]) ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ошибка");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, item]);

  if (!open || !item) return null;

  async function pickSource(sourceUrl: string) {
    setApplying(sourceUrl);
    try {
      const res = await apiFetch(`/api/funko/${item!.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Не удалось сохранить"));
      toast.success("Фото сохранено в облако");
      onSaved(data.item as FunkoItem);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setApplying(null);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/api/funko/${item!.id}/image`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data.error ?? "Не удалось загрузить"));
      toast.success("Фото загружено в облако");
      onSaved(data.item as FunkoItem);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border bg-card shadow-lg">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Подобрать фото</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.title}</p>
        </div>

        <div className="overflow-y-auto p-4">
          <label className="mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm hover:bg-muted/40">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void onFileChange(e)}
            />
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Загрузить своё фото
          </label>

          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : suggestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Варианты не найдены — загрузите фото вручную
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {suggestions.map((s) => (
                <button
                  key={`${s.handle}-${s.imageUrl}`}
                  type="button"
                  disabled={Boolean(applying)}
                  onClick={() => void pickSource(s.imageUrl)}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border bg-muted/20 text-left transition-colors hover:border-primary",
                    applying === s.imageUrl && "ring-2 ring-primary",
                  )}
                >
                  <div className="aspect-square bg-muted/30 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt={s.title}
                      className="size-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="line-clamp-2 text-[10px] leading-snug font-medium">
                      {s.title}
                    </p>
                    {s.popNumber != null && (
                      <p className="text-[10px] text-muted-foreground">#{s.popNumber}</p>
                    )}
                  </div>
                  {applying === s.imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                  )}
                  <div className="absolute top-1 right-1 rounded bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Check className="size-3" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t p-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={Boolean(applying)}>
            <ImageIcon className="size-4" />
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
