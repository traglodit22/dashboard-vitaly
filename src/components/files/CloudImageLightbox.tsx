"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  footer,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const item = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const src = item ? `/api/files/${item.id}/content` : "";

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!item || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
    >
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 z-0"
        onClick={onClose}
      />

      <div
        className="relative z-20 flex shrink-0 items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 flex-1 truncate pr-2 text-sm font-medium">
          {item.title}
          <span className="ml-2 text-white/60">
            {index + 1} / {images.length}
          </span>
        </p>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-white/15 text-white transition-colors active:bg-white/30"
        >
          <X className="size-6" />
        </button>
      </div>

      <div
        className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-16"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPrev && (
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={() => onIndexChange(index - 1)}
            className="absolute left-[max(0.5rem,env(safe-area-inset-left))] top-1/2 z-20 flex size-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-black/50 text-white transition-colors active:bg-black/70 sm:left-4"
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
            className="max-h-[calc(100dvh-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-full select-none object-contain"
            draggable={false}
          />
        </div>

        {hasNext && (
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={() => onIndexChange(index + 1)}
            className="absolute right-[max(0.5rem,env(safe-area-inset-right))] top-1/2 z-20 flex size-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full bg-black/50 text-white transition-colors active:bg-black/70 sm:right-4"
          >
            <ChevronRight className="size-7" />
          </button>
        )}
      </div>

      {footer && (
        <div
          className="relative z-20 shrink-0 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          {footer}
        </div>
      )}
    </div>,
    document.body,
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
