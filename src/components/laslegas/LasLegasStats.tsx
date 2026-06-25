"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Users,
  Ticket,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import type {
  LasLegasCalendar,
  LasLegasDayDetail,
  LasLegasOverview,
  LasLegasPeriodDetail,
} from "@/lib/laslegas/types";

const numFmt = new Intl.NumberFormat("ru-RU");
const bynFmt = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatByn(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${bynFmt.format(value)} BYN`;
}

type ModalKind = "calendar" | "day" | "period";

interface ModalState {
  kind: ModalKind;
  title: string;
  month?: string;
  date?: string;
  period?: "today" | "7d" | "30d";
}

interface OverviewCard {
  id: string;
  label: string;
  value: string;
  icon: typeof Users;
  accent?: string;
  modal: ModalState;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function LasLegasStats() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<LasLegasOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/stats/las-legas?view=overview", {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.configured === false) {
        setConfigured(false);
        setOverview(null);
        return;
      }
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setConfigured(true);
      setOverview(data as LasLegasOverview);
    } catch (e) {
      setConfigured(true);
      setError(e instanceof Error ? e.message : "Не удалось загрузить Las Legas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const cards = useMemo((): OverviewCard[] => {
    if (!overview) return [];
    const todayDate = overview.today.visitors.date;
    const monthKey = overview.month.from?.slice(0, 7) ?? monthFromDate(todayDate);

    return [
      {
        id: "today-visitors",
        label: "Посетители сегодня",
        value: numFmt.format(overview.today.visitors.visitors),
        icon: Users,
        accent: "text-sky-400",
        modal: { kind: "day", title: "Сегодня", date: todayDate },
      },
      {
        id: "today-revenue",
        label: "Выручка сегодня",
        value: formatByn(overview.today.revenue.total),
        icon: Banknote,
        accent: "text-emerald-400",
        modal: { kind: "day", title: "Выручка сегодня", date: todayDate },
      },
      {
        id: "today-tickets",
        label: "Билетов сегодня",
        value: numFmt.format(overview.today.visitors.ticketsSold),
        icon: Ticket,
        modal: { kind: "day", title: "Билеты сегодня", date: todayDate },
      },
      {
        id: "month-visitors",
        label: "Посетители за месяц",
        value: numFmt.format(overview.month.visitors ?? 0),
        icon: Users,
        modal: {
          kind: "calendar",
          title: overview.month.label ?? "Календарь",
          month: monthKey,
        },
      },
      {
        id: "month-revenue",
        label: "Выручка за месяц",
        value: formatByn(overview.month.revenue?.total),
        icon: Banknote,
        accent: "text-emerald-400",
        modal: {
          kind: "calendar",
          title: overview.month.label ?? "Календарь",
          month: monthKey,
        },
      },
      {
        id: "7d-revenue",
        label: "Выручка за 7 дней",
        value: formatByn(overview.last7d.revenue?.total),
        icon: Banknote,
        modal: { kind: "period", title: "Последние 7 дней", period: "7d" },
      },
      {
        id: "7d-visitors",
        label: "Посетители за 7 дней",
        value: numFmt.format(overview.last7d.visitors ?? 0),
        icon: Users,
        modal: { kind: "period", title: "Последние 7 дней", period: "7d" },
      },
      {
        id: "30d-revenue",
        label: "Выручка за 30 дней",
        value: formatByn(overview.last30d.revenue?.total),
        icon: Banknote,
        modal: { kind: "period", title: "Последние 30 дней", period: "30d" },
      },
      {
        id: "30d-visitors",
        label: "Посетители за 30 дней",
        value: numFmt.format(overview.last30d.visitors ?? 0),
        icon: Users,
        modal: { kind: "period", title: "Последние 30 дней", period: "30d" },
      },
    ];
  }, [overview]);

  if (configured === false) return null;

  return (
    <>
      <Card>
        <CardContent className="py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="size-4 text-primary" />
              Las Legas — музей LEGO
            </p>
            {overview?.generatedAt && (
              <span className="text-xs text-muted-foreground">
                Обновлено:{" "}
                {new Intl.DateTimeFormat("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Minsk",
                }).format(new Date(overview.generatedAt))}
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка статистики…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
              <Button
                variant="secondary"
                size="sm"
                className="ml-3"
                onClick={() => void loadOverview()}
              >
                Повторить
              </Button>
            </div>
          )}

          {!loading && !error && cards.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {cards.map(({ id, label, value, icon: Icon, accent, modal: m }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModal(m)}
                  className="rounded-lg border border-border bg-muted/20 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className={cn("size-3.5 shrink-0", accent ?? "text-primary")} />
                    <span>{label}</span>
                  </div>
                  <p className={cn("text-lg font-semibold tabular-nums sm:text-xl", accent)}>
                    {value}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {modal && (
        <LasLegasModal
          state={modal}
          onClose={() => setModal(null)}
          onOpenDay={(date) =>
            setModal({ kind: "day", title: date, date })
          }
          onOpenCalendar={(month) =>
            setModal({ kind: "calendar", title: "Календарь", month })
          }
        />
      )}
    </>
  );
}

function LasLegasModal({
  state,
  onClose,
  onOpenDay,
  onOpenCalendar,
}: {
  state: ModalState;
  onClose: () => void;
  onOpenDay: (date: string) => void;
  onOpenCalendar: (month: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<LasLegasCalendar | null>(null);
  const [day, setDay] = useState<LasLegasDayDetail | null>(null);
  const [period, setPeriod] = useState<LasLegasPeriodDetail | null>(null);
  const [month, setMonth] = useState(state.month ?? monthFromDate(new Date().toISOString().slice(0, 10)));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCalendar(null);
    setDay(null);
    setPeriod(null);
    try {
      let url = "/api/stats/las-legas?";
      if (state.kind === "calendar") {
        url += `view=calendar&month=${encodeURIComponent(month)}`;
      } else if (state.kind === "day" && state.date) {
        url += `date=${encodeURIComponent(state.date)}`;
      } else if (state.kind === "period" && state.period) {
        url += `period=${encodeURIComponent(state.period)}`;
      } else {
        throw new Error("Неизвестный тип запроса");
      }

      const res = await apiFetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      if (state.kind === "calendar") setCalendar(data as LasLegasCalendar);
      else if (state.kind === "day") setDay(data as LasLegasDayDetail);
      else setPeriod(data as LasLegasPeriodDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [state, month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.month) setMonth(state.month);
  }, [state.month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 py-10 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold sm:text-base">{state.title}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Закрыть">
            <X className="size-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-auto p-4">
          {loading && (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка…
            </div>
          )}

          {!loading && error && (
            <p className="py-6 text-center text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && state.kind === "calendar" && calendar && (
            <CalendarView
              data={calendar}
              month={month}
              onMonthChange={(m) => {
                setMonth(m);
                onOpenCalendar(m);
              }}
              onDayClick={onOpenDay}
            />
          )}

          {!loading && !error && state.kind === "day" && day && (
            <DayDetailView data={day} onOpenCalendar={(m) => onOpenCalendar(m)} />
          )}

          {!loading && !error && state.kind === "period" && period && (
            <PeriodDetailView data={period} period={state.period} />
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarView({
  data,
  month,
  onMonthChange,
  onDayClick,
}: {
  data: LasLegasCalendar;
  month: string;
  onMonthChange: (month: string) => void;
  onDayClick: (date: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="icon-sm" onClick={() => onMonthChange(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="flex items-center gap-2 text-sm font-medium capitalize">
          <CalendarDays className="size-4 text-primary" />
          {data.monthLabel}
        </p>
        <Button variant="secondary" size="icon-sm" onClick={() => onMonthChange(shiftMonth(month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {data.calendar.map((cell) => {
          const stats = data.dayCounts[cell.date];
          const hasData = Boolean(stats && (stats.visitors > 0 || stats.revenue > 0));
          return (
            <button
              key={cell.date}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => cell.inMonth && onDayClick(cell.date)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-xs transition-colors",
                !cell.inMonth && "border-transparent opacity-30",
                cell.inMonth && !hasData && "border-border/50 bg-muted/20",
                cell.inMonth && hasData && "border-primary/30 bg-primary/5 hover:bg-primary/10",
                cell.isToday && "ring-1 ring-primary/50",
              )}
            >
              <span className="font-medium">{cell.day}</span>
              {cell.inMonth && stats && (
                <>
                  <span className="tabular-nums text-[10px] text-sky-400">
                    {stats.visitors > 0 ? stats.visitors : ""}
                  </span>
                  {stats.revenue > 0 && (
                    <span className="truncate text-[9px] tabular-nums text-emerald-500">
                      {Math.round(stats.revenue)}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Число — посетители, зелёное — выручка (BYN). Клик по дню — детализация.
      </p>
    </div>
  );
}

function DayDetailView({
  data,
  onOpenCalendar,
}: {
  data: LasLegasDayDetail;
  onOpenCalendar: (month: string) => void;
}) {
  const v = data.visitors;
  const r = data.revenue;
  const date = v?.date ?? data.date ?? "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{v?.dateLabel ?? date}</p>
        {date && (
          <Button variant="secondary" size="sm" onClick={() => onOpenCalendar(monthFromDate(date))}>
            <CalendarDays className="size-4" />
            Календарь
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricTile label="Посетители" value={numFmt.format(v?.visitors ?? 0)} />
        <MetricTile label="Билетов" value={numFmt.format(v?.ticketsSold ?? 0)} />
        <MetricTile label="Выручка" value={formatByn(r?.total)} accent />
      </div>

      {r && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Разбивка выручки</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricTile label="Наличные" value={formatByn(r.cash)} small />
            <MetricTile label="Безнал касса" value={formatByn(r.card)} small />
            <MetricTile label="ЕРИП" value={formatByn(r.erip)} small />
            <MetricTile label="Группы/юрлица" value={formatByn(r.nonCashGroups)} small />
          </div>
        </div>
      )}

      {v?.breakdown && Object.keys(v.breakdown).length > 0 && (
        <BreakdownTable title="По типам билетов" data={v.breakdown} />
      )}

      {v?.salesBreakdown && Object.keys(v.salesBreakdown).length > 0 && (
        <BreakdownTable title="Проданные позиции" data={v.salesBreakdown} />
      )}
    </div>
  );
}

function PeriodDetailView({
  data,
  period,
}: {
  data: LasLegasPeriodDetail;
  period?: "today" | "7d" | "30d";
}) {
  const v = data.visitors;
  const r = data.revenue;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {period === "7d" && "Сводка за 7 дней"}
        {period === "30d" && "Сводка за 30 дней"}
        {period === "today" && "Сводка за сегодня"}
        {!period && "Сводка за период"}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricTile label="Посетители" value={numFmt.format(v?.visitors ?? 0)} />
        <MetricTile label="Билетов" value={numFmt.format(v?.ticketsSold ?? 0)} />
        <MetricTile label="Выручка" value={formatByn(r?.total)} accent />
      </div>

      {r && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricTile label="Наличные" value={formatByn(r.cash)} small />
          <MetricTile label="Безнал" value={formatByn(r.card)} small />
          <MetricTile label="ЕРИП" value={formatByn(r.erip)} small />
          <MetricTile label="Группы" value={formatByn(r.nonCashGroups)} small />
        </div>
      )}

      {data.history && data.history.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Посетители</th>
                <th className="px-3 py-2">Билеты</th>
                <th className="px-3 py-2">Выручка</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((row) => (
                <tr key={row.date} className="border-b border-border/50">
                  <td className="px-3 py-2 tabular-nums">{row.date}</td>
                  <td className="px-3 py-2 tabular-nums">{row.visitors ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{row.ticketsSold ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{formatByn(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v?.breakdown && Object.keys(v.breakdown).length > 0 && (
        <BreakdownTable title="По типам билетов" data={v.breakdown} />
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/40 p-3", small && "p-2")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold tabular-nums",
          small ? "text-sm" : "text-lg",
          accent && "text-emerald-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BreakdownTable({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Позиция</th>
              <th className="px-3 py-2 text-right">Кол-во</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, qty]) => (
              <tr key={name} className="border-b border-border/50">
                <td className="px-3 py-2">{name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
