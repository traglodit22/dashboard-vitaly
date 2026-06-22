"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  Save,
  Wallet,
  TriangleAlert,
  BadgeCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/apiFetch";
import { computeTotal } from "@/lib/salaries/calc";
import {
  currentMonth,
  formatHours,
  formatMonth,
  formatMoney,
  shiftMonth,
} from "@/lib/salaries/format";
import type { Employee, SalaryRecord } from "@/types";

interface RowState {
  hours: string;
  hourlyRate: string;
  bonuses: string;
  deductions: string;
  paid: boolean;
  paidAt: string | null;
}

interface UnmatchedRow {
  name: string;
  email: string;
  hours: number;
}

const num = (s: string) => Number(s) || 0;

function emptyRow(rate: number): RowState {
  return { hours: "0", hourlyRate: String(rate ?? 0), bonuses: "0", deductions: "0", paid: false, paidAt: null };
}

export function SalariesClient() {
  const [month, setMonth] = useState(currentMonth());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    const [empRes, recRes] = await Promise.all([
      apiFetch("/api/employees", { cache: "no-store" }),
      apiFetch(`/api/salaries?month=${m}`, { cache: "no-store" }),
    ]);
    const emps: Employee[] = (await empRes.json()).employees ?? [];
    const records: SalaryRecord[] = (await recRes.json()).records ?? [];
    const recById = new Map(records.map((r) => [r.employeeId, r]));

    const next: Record<string, RowState> = {};
    for (const e of emps) {
      if (!e.active && !recById.has(e.id)) continue; // архивных без начисления не показываем
      const rec = recById.get(e.id);
      next[e.id] = rec
        ? {
            hours: String(rec.hours),
            hourlyRate: String(rec.hourlyRate),
            bonuses: String(rec.bonuses),
            deductions: String(rec.deductions),
            paid: rec.paid,
            paidAt: rec.paidAt ?? null,
          }
        : emptyRow(e.hourlyRate);
    }
    setEmployees(emps);
    setRows(next);
    setHasSaved(records.length > 0);
    setConfirmDelete(false);
    setDirty(false);
    setUnmatched([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const setField = (id: string, key: keyof RowState, value: string | boolean) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], [key]: value } }));
    setDirty(true);
  };

  const togglePaid = (id: string) => {
    setRows((r) => {
      const row = r[id];
      const paid = !row.paid;
      return { ...r, [id]: { ...row, paid, paidAt: paid ? new Date().toISOString() : null } };
    });
    setDirty(true);
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // позволить повторную загрузку того же файла
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/salaries/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Не удалось загрузить отчёт", { description: data.error });
        return;
      }
      const matched: { employeeId: string; hours: number }[] = data.matched ?? [];
      setRows((r) => {
        const next = { ...r };
        for (const m of matched) {
          if (next[m.employeeId]) next[m.employeeId] = { ...next[m.employeeId], hours: String(m.hours) };
        }
        return next;
      });
      setUnmatched(data.unmatched ?? []);
      setDirty(true);
      toast.success(`Часы подставлены: ${matched.length}`, {
        description: (data.unmatched ?? []).length
          ? `Не сопоставлено строк: ${data.unmatched.length}`
          : "Все строки сопоставлены",
      });
    } catch {
      toast.error("Сеть недоступна", { description: "Повторите попытку" });
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        month,
        rows: Object.entries(rows).map(([employeeId, r]) => ({
          employeeId,
          hours: num(r.hours),
          hourlyRate: num(r.hourlyRate),
          bonuses: num(r.bonuses),
          deductions: num(r.deductions),
          paid: r.paid,
        })),
      };
      const res = await apiFetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error("Не удалось сохранить", { description: data.error });
        return;
      }
      toast.success("Ведомость сохранена", { description: formatMonth(month) });
      load(month);
    } catch {
      toast.error("Сеть недоступна", { description: "Повторите попытку" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMonth() {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/salaries?month=${month}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Не удалось удалить", { description: data.error });
        return;
      }
      toast.success("Ведомость удалена", {
        description: `${formatMonth(month)} · записей: ${data.deleted}`,
      });
      load(month);
    } catch {
      toast.error("Сеть недоступна", { description: "Повторите попытку" });
    } finally {
      setDeleting(false);
    }
  }

  function markAllPaid() {
    setRows((r) => {
      const now = new Date().toISOString();
      const next: Record<string, RowState> = {};
      for (const [id, row] of Object.entries(r)) {
        next[id] = row.paid ? row : { ...row, paid: true, paidAt: now };
      }
      return next;
    });
    setDirty(true);
  }

  const visible = employees.filter((e) => rows[e.id]);
  const totals = visible.reduce(
    (acc, e) => {
      const r = rows[e.id];
      const total = computeTotal(num(r.hours), num(r.hourlyRate), num(r.bonuses), num(r.deductions));
      acc.fund += total;
      if (r.paid) acc.paid += total;
      else acc.unpaid += total;
      return acc;
    },
    { fund: 0, paid: 0, unpaid: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Панель управления */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => shiftMonth(m, -1))} title="Предыдущий месяц">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-44 text-center text-lg font-semibold">{formatMonth(month)}</div>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => shiftMonth(m, 1))} title="Следующий месяц">
            <ChevronRight className="size-4" />
          </Button>
          <Input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="ml-1 w-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Загрузить отчёт
          </Button>
          <Button onClick={save} disabled={!dirty || saving || visible.length === 0} className="min-w-32">
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Сохраняем…
              </>
            ) : (
              <>
                <Save className="size-4" />
                Сохранить
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Удаление ведомости за месяц (если что-то сохранено) */}
      {hasSaved && (
        <div className="flex justify-end">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm">
              <span>Удалить всю ведомость за {formatMonth(month).toLowerCase()}?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Отмена
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteMonth} disabled={deleting}>
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Удалить
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              Удалить отчёт за месяц
            </Button>
          )}
        </div>
      )}

      {/* Не сопоставленные строки из отчёта */}
      {unmatched.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-4" />
            Не сопоставлено строк из отчёта: {unmatched.length}
          </div>
          <p className="mb-2 text-muted-foreground">
            Email из отчёта не совпал ни с одним сотрудником. Заведите сотрудника или поправьте у него «Email из тайм-трекера».
          </p>
          <ul className="space-y-0.5 font-mono text-xs text-muted-foreground">
            {unmatched.map((u, i) => (
              <li key={i}>
                {u.name || "—"} · {u.email || "без email"} · {formatHours(u.hours)} ч
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="size-5 text-primary" />
            Ведомость
          </CardTitle>
          {visible.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllPaid}>
              <BadgeCheck className="size-4" />
              Отметить всех выплаченными
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка…
            </div>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Нет сотрудников. Добавьте их во вкладке «Сотрудники», затем загрузите отчёт.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead className="text-right">Часы</TableHead>
                  <TableHead className="text-right">Ставка</TableHead>
                  <TableHead className="text-right">Премия</TableHead>
                  <TableHead className="text-right">Удержание</TableHead>
                  <TableHead className="text-right">Итого</TableHead>
                  <TableHead className="text-center">Выплачено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((e) => {
                  const r = rows[e.id];
                  const total = computeTotal(num(r.hours), num(r.hourlyRate), num(r.bonuses), num(r.deductions));
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.role || "—"}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <NumCell value={r.hours} onChange={(v) => setField(e.id, "hours", v)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <NumCell value={r.hourlyRate} onChange={(v) => setField(e.id, "hourlyRate", v)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <NumCell value={r.bonuses} onChange={(v) => setField(e.id, "bonuses", v)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <NumCell value={r.deductions} onChange={(v) => setField(e.id, "deductions", v)} />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatMoney(total)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-0.5">
                          <input
                            type="checkbox"
                            checked={r.paid}
                            onChange={() => togglePaid(e.id)}
                            className="size-4 accent-primary"
                            aria-label="Выплачено"
                          />
                          {r.paid && r.paidAt && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {new Date(r.paidAt).toLocaleDateString("ru-RU")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-medium">
                    Фонд за {formatMonth(month).toLowerCase()}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatMoney(totals.fund)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {visible.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Фонд за месяц" value={formatMoney(totals.fund)} />
          <Stat label="Выплачено" value={formatMoney(totals.paid)} tone="ok" />
          <Stat label="Осталось выплатить" value={formatMoney(totals.unpaid)} tone={totals.unpaid > 0 ? "warn" : "ok"} />
        </div>
      )}
    </div>
  );
}

function NumCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-24 text-right font-mono"
    />
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
