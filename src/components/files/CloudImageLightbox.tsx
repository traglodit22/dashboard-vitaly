"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  id: string;
  title: string;
  createdAt: string;
}

export function CloudImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const item = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const src = item ? `/api/files/${item.id}/content` : "";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && hasNext) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, hasPrev, hasNext, onClose, onIndexChange]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onClick={onClose}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 truncate text-sm font-medium">
          {item.title}
          <span className="ml-2 text-white/60">
            {index + 1} / {images.length}
          </span>
        </p>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPrev && (
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={() => onIndexChange(index - 1)}
            className="absolute left-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 sm:left-4"
          >
            <ChevronLeft className="size-7" />
          </button>
        )}

        <div className="relative flex max-h-full max-w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={item.id}
            src={src}
            alt={item.title}
            className="max-h-[calc(100vh-7rem)] max-w-full object-contain"
          />
        </div>

        {hasNext && (
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={() => onIndexChange(index + 1)}
            className="absolute right-2 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 sm:right-4"
          >
            <ChevronRight className="size-7" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Кликабельная область превью для открытия лайтбокса. */
export function LightboxPreviewTrigger({
  onOpen,
  className,
  children,
}: {
  onOpen: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("cursor-zoom-in text-left", className)}
    >
      {children}
    </button>
  );
}

export function LightboxLoadingSpinner() {
  return (
    <div className="flex aspect-[4/3] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
