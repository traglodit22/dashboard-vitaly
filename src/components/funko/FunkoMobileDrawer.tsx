"use client";

import { Suspense, useEffect } from "react";
import { PanelLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FunkoSidebar } from "@/components/funko/FunkoSidebar";

export function FunkoMobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Категории Funko">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(100vw-2.5rem,20rem)] max-w-full flex-col border-r border-border bg-sidebar shadow-2xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Funko</span>
          <Button type="button" variant="ghost" size="icon" className="size-9" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense fallback={<div className="p-3 text-xs text-muted-foreground">Загрузка…</div>}>
            <FunkoSidebar />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function FunkoMobileNavButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-1.5 md:hidden"
      onClick={onClick}
    >
      <PanelLeft className="size-4" />
      Категории
    </Button>
  );
}
