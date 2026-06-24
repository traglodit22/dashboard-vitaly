"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import { fileContentUrl, fileDownloadUrl } from "@/lib/files/routes";

export function CloudPdfViewer({
  fileId,
  title,
  onClose,
}: {
  fileId: string;
  title: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const src = fileContentUrl(fileId);

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

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Просмотр PDF: ${title}`}
    >
      <div className="relative z-20 flex shrink-0 items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        <a
          href={fileDownloadUrl(fileId)}
          download
          title="Скачать оригинал"
          className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <Download className="size-5" />
        </a>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-8 animate-spin text-white/70" />
          </div>
        )}
        <iframe
          src={src}
          title={title}
          className="size-full border-0 bg-white"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>,
    document.body,
  );
}
