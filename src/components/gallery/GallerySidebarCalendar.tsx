"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { GALLERY_CHANGED_EVENT } from "@/lib/gallery/galleryRoutes";
import {
  MONTH_SHORT,
  type GalleryYearGroup,
  parseGalleryHash,
  photoDaysInMonth,
  scrollToGalleryAnchor,
} from "@/lib/gallery/groupByDate";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Понедельник = 0 … воскресенье = 6 */
function mondayBasedWeekday(year: number, month: number): number {
  const w = new Date(year, month - 1, 1).getDay();
  return w === 0 ? 6 : w - 1;
}

export function GallerySidebarCalendar() {
  const [grouped, setGrouped] = useState<GalleryYearGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [pick, setPick] = useState<{ year: number; month: number } | null>(null);
  const [active, setActive] = useState<{ year: number; month: number; day?: number } | null>(
    null,
  );

  const load = useCallback(async () => {
    const res = await apiFetch("/api/gallery", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return;
    const next = (data.grouped as GalleryYearGroup[]) ?? [];
    setGrouped(next);
    if (next.length) {
      setExpandedYears((prev) => {
        const years = new Set(prev);
        years.add(next[0].year);
        return years;
      });
      setPick((prev) => prev ?? { year: next[0].year, month: next[0].months[0]?.month ?? 1 });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(GALLERY_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(GALLERY_CHANGED_EVENT, onChange);
  }, [load]);

  useEffect(() => {
    const syncFromHash = () => {
      const parsed = parseGalleryHash(window.location.hash);
      if (parsed) setActive(parsed);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const monthMeta = useMemo(() => {
    const map = new Map<string, { count: number; items: GalleryYearGroup["months"][0]["items"] }>();
    for (const y of grouped) {
      for (const m of y.months) {
        map.set(`${y.year}-${m.month}`, { count: m.items.length, items: m.items });
      }
    }
    return map;
  }, [grouped]);

  function toggleYear(year: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  function goToMonth(year: number, month: number) {
    setPick({ year, month });
    setActive({ year, month });
    scrollToGalleryAnchor(year, month);
  }

  function goToDay(year: number, month: number, day: number) {
    setPick({ year, month });
    setActive({ year, month, day });
    scrollToGalleryAnchor(year, month, day);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Календарь…
      </div>
    );
  }

  if (!grouped.length) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Загрузите фото — они появятся в календаре по дате съёмки.
      </p>
    );
  }

  const picker = pick ?? {
    year: grouped[0].year,
    month: grouped[0].months[0]?.month ?? 1,
  };
  const pickerItems = monthMeta.get(`${picker.year}-${picker.month}`)?.items ?? [];
  const dayCounts = photoDaysInMonth(pickerItems, picker.year, picker.month);
  const dim = daysInMonth(picker.year, picker.month);
  const lead = mondayBasedWeekday(picker.year, picker.month);

  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-2">
      {grouped.map((yearGroup) => {
        const open = expandedYears.has(yearGroup.year);
        return (
          <div key={yearGroup.year}>
            <button
              type="button"
              onClick={() => toggleYear(yearGroup.year)}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-semibold hover:bg-accent"
            >
              {open ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span>{yearGroup.year}</span>
              <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
                {yearGroup.total}
              </span>
            </button>
            {open && (
              <div className="mt-1 grid grid-cols-4 gap-1 px-1">
                {MONTH_SHORT.map((label, idx) => {
                  const month = idx + 1;
                  const meta = monthMeta.get(`${yearGroup.year}-${month}`);
                  const count = meta?.count ?? 0;
                  const selected =
                    pick?.year === yearGroup.year && pick?.month === month;
                  const isActive =
                    active?.year === yearGroup.year &&
                    active?.month === month &&
                    active.day == null;
                  return (
                    <button
                      key={month}
                      type="button"
                      disabled={!count}
                      onClick={() => goToMonth(yearGroup.year, month)}
                      className={cn(
                        "flex flex-col items-center rounded-md px-1 py-1.5 text-[10px] leading-tight transition-colors",
                        count
                          ? "hover:bg-primary/10"
                          : "cursor-default text-muted-foreground/35",
                        selected && "bg-primary/15 ring-1 ring-primary/30",
                        isActive && "font-semibold text-primary",
                        count > 0 && !selected && "text-foreground",
                      )}
                      title={count ? `${label} — ${count} фото` : label}
                    >
                      <span>{label}</span>
                      {count > 0 && (
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {pickerItems.length > 0 && (
        <div className="shrink-0 border-t border-border/60 pt-3">
          <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {MONTH_SHORT[picker.month - 1]} {picker.year}
          </p>
          <div className="grid grid-cols-7 gap-0.5 px-1 text-center text-[9px] text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-0.5">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-1">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`e-${i}`} />
            ))}
            {Array.from({ length: dim }, (_, i) => {
              const day = i + 1;
              const count = dayCounts.get(day) ?? 0;
              const isActive =
                active?.year === picker.year &&
                active?.month === picker.month &&
                active?.day === day;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!count}
                  onClick={() => goToDay(picker.year, picker.month, day)}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-md text-[11px] tabular-nums transition-colors",
                    count
                      ? "bg-primary/12 font-medium hover:bg-primary/22"
                      : "text-muted-foreground/30",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  title={count ? `${day}: ${count} фото` : String(day)}
                >
                  {day}
                  {count > 1 && !isActive && (
                    <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
