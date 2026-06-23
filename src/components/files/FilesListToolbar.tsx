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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex w-full flex-col gap-1.5 sm:min-w-0 sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="text-xs text-muted-foreground">Сортировка</span>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            if (v) onSortChange(v as FileSortKey);
          }}
        >
          <SelectTrigger size="sm" className="h-9 w-full sm:h-8 sm:max-w-[16rem]">
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
        <div className="flex w-full flex-col gap-1.5 sm:min-w-0 sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="text-xs text-muted-foreground">Тип</span>
          <Select value={extFilter} onValueChange={(v) => onExtFilterChange(v ?? "all")}>
            <SelectTrigger size="sm" className="h-9 w-full sm:h-8 sm:max-w-[14rem]">
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
