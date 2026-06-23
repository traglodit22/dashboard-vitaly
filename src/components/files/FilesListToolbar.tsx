"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FILE_SORT_OPTIONS,
  type ExtensionOption,
  type FileSortKey,
} from "@/lib/files/fileListFilters";

export function FilesListToolbar({
  sortBy,
  onSortChange,
  extFilter,
  onExtFilterChange,
  extensions,
  totalCount,
  visibleCount,
}: {
  sortBy: FileSortKey;
  onSortChange: (value: FileSortKey) => void;
  extFilter: string;
  onExtFilterChange: (value: string) => void;
  extensions: ExtensionOption[];
  totalCount: number;
  visibleCount: number;
}) {
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Сортировка</span>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            if (v) onSortChange(v as FileSortKey);
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-full min-w-[10rem] max-w-[16rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILE_SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {extensions.length > 0 && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Тип</span>
          <Select value={extFilter} onValueChange={(v) => onExtFilterChange(v ?? "all")}>
            <SelectTrigger size="sm" className="h-8 w-full min-w-[8rem] max-w-[14rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы ({totalCount})</SelectItem>
              {extensions.map((opt) => (
                <SelectItem key={opt.ext} value={opt.ext}>
                  {opt.label} ({opt.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {extFilter !== "all" && (
        <p className="w-full text-xs text-muted-foreground sm:w-auto">
          Показано {visibleCount} из {totalCount}
        </p>
      )}
    </div>
  );
}
