"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import { fileTextContentUrl } from "@/lib/files/routes";
import { cn } from "@/lib/utils";

const AUTOSAVE_MS = 700;

export interface TextNoteItem {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
}

export function TextNoteModal({
  mode,
  fileId,
  initialTitle = "",
  categorySlug,
  folderId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  fileId?: string;
  initialTitle?: string;
  categorySlug: string;
  folderId: string | null;
  onClose: () => void;
  onSaved: (item: TextNoteItem) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(mode === "create");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(content);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (mode !== "edit" || !fileId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(fileTextContentUrl(fileId), {}, 20_000);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Не удалось загрузить заметку");
        }
        const text = await res.text();
        if (!cancelled) {
          setContent(text);
          lastSaved.current = text;
          setDirty(false);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error("Не удалось открыть заметку", {
            description: err instanceof Error ? err.message : undefined,
          });
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, fileId, onClose]);

  const save = useCallback(
    async (textOverride?: string) => {
      if (saving) return;
      const text = textOverride ?? content;
      if (mode === "edit" && text === lastSaved.current) return;

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toast.error("Укажите название заметки");
        return;
      }

      setSaving(true);
      try {
        if (mode === "create") {
          const res = await apiFetch(
            "/api/files/text-notes",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                categorySlug,
                folderId,
                title: trimmedTitle,
                content: text,
              }),
            },
            20_000,
          );
          const data = await res.json();
          if (!res.ok) {
            throw new Error(String(data.error ?? "Не удалось создать заметку"));
          }
          toast.success("Заметка создана");
          onSaved(data.item as TextNoteItem);
          onClose();
          return;
        }

        if (!fileId) return;

        const res = await apiFetch(
          `/api/files/${fileId}/content`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text }),
          },
          20_000,
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(String(data.error ?? "Не удалось сохранить"));
        }
        lastSaved.current = text;
        setDirty(false);
        onSaved(data.item as TextNoteItem);
      } catch (err) {
        toast.error(mode === "create" ? "Не удалось создать заметку" : "Не удалось сохранить", {
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setSaving(false);
      }
    },
    [saving, mode, content, title, categorySlug, folderId, fileId, onClose, onSaved],
  );

  function scheduleAutosave(value: string) {
    if (mode !== "edit") return;
    setContent(value);
    setDirty(value !== lastSaved.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save(value);
    }, AUTOSAVE_MS);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!mounted) return null;

  const heading = mode === "create" ? "Новая заметка" : initialTitle || "Заметка";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))]">
        {mode === "create" ? (
          <Input
            autoFocus
            placeholder="Название заметки"
            className="h-9 min-w-0 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{heading}</p>
        )}
        {saving && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="hidden sm:inline">Сохранение…</span>
          </span>
        )}
        {mode === "create" ? (
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            Создать
          </Button>
        ) : null}
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-full hover:bg-accent"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <textarea
            autoFocus={mode === "edit"}
            placeholder="Текст заметки…"
            className={cn(
              "size-full resize-none rounded-xl border border-input bg-background px-3 py-2.5",
              "text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            value={content}
            onChange={(e) => {
              if (mode === "create") {
                setContent(e.target.value);
                setDirty(true);
              } else {
                scheduleAutosave(e.target.value);
              }
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
