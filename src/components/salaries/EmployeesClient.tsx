"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Archive, ArchiveRestore, Loader2, UserSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/apiFetch";
import { formatMoney } from "@/lib/salaries/format";
import { EmployeeDialog } from "./EmployeeDialog";
import type { Employee } from "@/types";

async function fetchEmployees(): Promise<Employee[]> {
  const res = await apiFetch("/api/employees", { cache: "no-store" });
  const data = await res.json();
  return data.employees ?? [];
}

export function EmployeesClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; employee: Employee | null }>({
    open: false,
    employee: null,
  });

  const load = useCallback(async () => {
    setEmployees(await fetchEmployees());
  }, []);

  useEffect(() => {
    let active = true;
    fetchEmployees().then((e) => {
      if (active) {
        setEmployees(e);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function setActive(id: string, active: boolean, who: string) {
    const res = await apiFetch(`/api/employees/${id}`, {
      method: active ? "PATCH" : "DELETE",
      ...(active
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }) }
        : {}),
    });
    if (res.ok) {
      toast.success(active ? "Сотрудник восстановлен" : "Сотрудник в архиве", { description: who });
      load();
    } else {
      toast.error("Не удалось изменить");
    }
  }

  const activeEmps = employees.filter((e) => e.active);
  const archived = employees.filter((e) => !e.active);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, employee: null })}>
          <Plus className="size-4" />
          Добавить сотрудника
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserSquare className="size-5 text-primary" />
            Сотрудники
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {activeEmps.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка…
            </div>
          ) : activeEmps.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Пока нет сотрудников. Добавьте первого — без них зарплаты не посчитать.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Должность</TableHead>
                  <TableHead className="text-right">Ставка ₽/час</TableHead>
                  <TableHead>Email трекера</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEmps.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.role || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatMoney(e.hourlyRate)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {e.trackerEmail}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setDialog({ open: true, employee: e })}
                          title="Редактировать"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setActive(e.id, false, e.name)}
                          title="В архив"
                        >
                          <Archive className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <Archive className="size-4" />
              Архив
              <span className="font-mono text-sm font-normal">{archived.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {archived.map((e) => (
                <li key={e.id} className="flex items-center gap-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{e.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{e.trackerEmail}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActive(e.id, true, e.name)}>
                    <ArchiveRestore className="size-4" />
                    Восстановить
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {dialog.open && (
        <EmployeeDialog
          employee={dialog.employee}
          onClose={(saved) => {
            setDialog({ open: false, employee: null });
            if (saved) load();
          }}
        />
      )}
    </div>
  );
}
