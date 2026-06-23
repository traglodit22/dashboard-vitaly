"use client";

import { useEffect } from "react";
import { FolderTree, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilesSidebarTree } from "@/components/files/FilesSidebarTree";

export function FilesMobileFolderDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Папки">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(100vw-2.5rem,20rem)] max-w-full flex-col border-r border-border bg-sidebar shadow-2xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderTree className="size-4 text-primary" />
            Папки
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <FilesSidebarTree
            onNavigate={onClose}
            embedded
            className="mt-0 border-t-0 pt-0"
          />
        </div>
      </div>
    </div>
  );
}
