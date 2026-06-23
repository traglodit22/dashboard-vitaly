"use client";

import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { filesCategoryPath } from "@/lib/files/routes";

interface Subfolder {
  id: string;
  name: string;
}

export function FilesSubfolderGrid({
  folders,
  categorySlug,
  currentFolderId,
}: {
  folders: Subfolder[];
  categorySlug: string;
  currentFolderId: string | null;
}) {
  if (folders.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-medium">{currentFolderId ? "Подпапки" : "Папки"}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {folders.map((folder) => (
          <Link
            key={folder.id}
            href={filesCategoryPath(categorySlug, folder.id)}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-colors",
              "hover:border-primary/40 hover:bg-muted/40",
            )}
            title={folder.name}
          >
            <Folder className="size-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]">
              {folder.name}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-60 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </section>
  );
}
