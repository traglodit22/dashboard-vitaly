"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GripVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { reorderById } from "@/lib/procurement/reorderList";
import type { ProcurementCategory } from "@/lib/procurement/mapRow";
import {
  ALL_PROCUREMENT_CATEGORY,
  isAllProcurementCategory,
  parseProcurementCategory,
  procurementHref,
} from "@/lib/procurement/procurementRoutes";

function ProcurementSidebarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = parseProcurementCategory(searchParams);

  const [categories, setCategories] = useState<ProcurementCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    const res = await apiFetch("/api/procurement/categories", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setCategories(data.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function persistCategoryOrder(next: ProcurementCategory[]) {
    const res = await apiFetch("/api/procurement/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((c) => c.id) }),
    });
    if (!res.ok) {
      toast.error("Не удалось сохранить порядок категорий");
      void loadCategories();
    }
  }

  function onCategoryDrop(targetId: string) {
    if (!dragCatId || dragCatId === targetId) return;
    const next = reorderById(categories, dragCatId, targetId);
    setCategories(next);
    setDragCatId(null);
    void persistCategoryOrder(next);
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const res = await apiFetch("/api/procurement/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error("Не удалось создать категорию");
      return;
    }
    const data = await res.json();
    setCategories((prev) => [...prev, data.category]);
    setNewCategoryName("");
    router.push(procurementHref(data.category.id));
    toast.success("Категория добавлена");
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 border-b border-border pb-3">
      <div className="px-2 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
        Категории
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
        <button
          type="button"
          onClick={() => router.push(procurementHref(ALL_PROCUREMENT_CATEGORY))}
          className={cn(
            "flex w-full items-center rounded-md px-3 py-1.5 text-left text-xs font-semibold transition-colors",
            isAllProcurementCategory(activeId)
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          Все
        </button>

        {loading && !categories.length ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">Загрузка…</div>
        ) : (
          categories.map((c) => (
            <button
              key={c.id}
              type="button"
              draggable={categories.length > 1}
              onDragStart={() => setDragCatId(c.id)}
              onDragEnd={() => setDragCatId(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                onCategoryDrop(c.id);
              }}
              onClick={() => router.push(procurementHref(c.id))}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                activeId === c.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                dragCatId === c.id && "opacity-50",
              )}
            >
              <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing" />
              <span className="truncate">{c.name}</span>
            </button>
          ))
        )}
      </div>

      <div className="flex gap-1.5 px-1">
        <Input
          placeholder="Новая…"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addCategory();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={() => void addCategory()}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function ProcurementSidebar() {
  return (
    <Suspense fallback={null}>
      <ProcurementSidebarInner />
    </Suspense>
  );
}
