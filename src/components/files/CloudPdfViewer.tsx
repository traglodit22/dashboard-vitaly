"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { apiFetch } from "@/lib/apiFetch";
import { fileDownloadUrl, fileInlineContentUrl } from "@/lib/files/routes";

const PDFJS_VERSION = "6.0.227";
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/build/pdf.worker.min.mjs`;
  return pdfjs;
}

function PdfPageCanvas({
  pdf,
  pageNum,
  width,
}: {
  pdf: PDFDocumentProxy;
  pageNum: number;
  width: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    if (!width) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setRendering(true);

    void (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const scale = width / base.width;
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum, width]);

  return (
    <div className="relative mx-auto w-full max-w-full">
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <canvas ref={canvasRef} className="block w-full bg-white shadow-sm" />
    </div>
  );
}

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
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [viewWidth, setViewWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const next = Math.floor(el.clientWidth - 16);
      if (next > 0) setViewWidth(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, pdf]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      setPdf(null);
      setPageCount(0);

      try {
        const res = await apiFetch(fileInlineContentUrl(fileId), {}, 120_000);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Не удалось загрузить PDF");
        }

        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({
          data: buffer,
          cMapUrl: `${PDFJS_CDN}/cmaps/`,
          cMapPacked: true,
        }).promise;

        if (cancelled) {
          void doc.cleanup();
          return;
        }

        setPdf(doc);
        setPageCount(doc.numPages);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось открыть PDF");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  useEffect(() => {
    return () => {
      if (pdf) void pdf.cleanup();
    };
  }, [pdf]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-neutral-900"
      role="dialog"
      aria-modal="true"
      aria-label={`Просмотр PDF: ${title}`}
    >
      <div className="relative z-20 flex shrink-0 items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        {pageCount > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-white/70">{pageCount} стр.</span>
        )}
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

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] touch-pan-y"
      >
        {loading && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-white/70" />
          </div>
        )}

        {error && !loading && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <a
              href={fileDownloadUrl(fileId)}
              download
              className="text-sm text-white underline underline-offset-2"
            >
              Скачать файл
            </a>
          </div>
        )}

        {pdf && viewWidth > 0 && !error && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 py-2">
            {Array.from({ length: pageCount }, (_, i) => (
              <PdfPageCanvas key={i + 1} pdf={pdf} pageNum={i + 1} width={viewWidth} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
