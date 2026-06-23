"use client";

import { useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import type { ProcurementStatus } from "@/lib/procurement/mapRow";
import {
  STATUS_COLOR_KEYS,
  STATUS_COLOR_LABEL,
  STATUS_SWATCH_CLASS,
  type StatusColorKey,
} from "@/lib/procurement/statusColors";

const NO_STATUS_FILTER = "__none__";

export function ProcurementStatusBar({
  categoryId,
  statuses,
  statusFilterId,
  statusCounts,
  noStatusCount,
  onFilterChange,
  onStatusesChange,
}: {
  categoryId: string;
  statuses: ProcurementStatus[];
  statusFilterId: string | null;
  statusCounts: Map<string, number>;
  noStatusCount: number;
  onFilterChange: (id: string | null) => void;
  onStatusesChange: (next: ProcurementStatus[]) => void;
}) {
  const [showManage, setShowManage] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={statusFilterId === null}
          label="Все"
          onClick={() => onFilterChange(null)}
        />
        {statuses.map((s) => (
          <FilterChip
            key={s.id}
            active={statusFilterId === s.id}
            label={s.name}
            count={statusCounts.get(s.id) ?? 0}
            colorKey={s.colorKey}
            onClick={() => onFilterChange(s.id)}
          />
        ))}
        {noStatusCount > 0 && (
          <FilterChip
            active={statusFilterId === NO_STATUS_FILTER}
            label="Без статуса"
            count={noStatusCount}
            onClick={() => onFilterChange(NO_STATUS_FILTER)}
          />
        )}
        <Button
          type="button"
          variant={showManage ? "secondary" : "outline"}
          size="sm"
          className="ml-auto h-8 gap-1.5"
          onClick={() => setShowManage((v) => !v)}
        >
          <Settings2 className="size-3.5" />
          Статусы
        </Button>
      </div>

      {showManage && (
        <StatusManager
          categoryId={categoryId}
          statuses={statuses}
          onClose={() => setShowManage(false)}
          onStatusesChange={onStatusesChange}
        />
      )}
    </div>
  );
}

export { NO_STATUS_FILTER };

function FilterChip({
  active,
  label,
  count,
  colorKey,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  colorKey?: StatusColorKey;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {colorKey && (
        <span
          className={cn("size-2.5 shrink-0 rounded-full border", STATUS_SWATCH_CLASS[colorKey])}
        />
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span className="font-mono text-[10px] opacity-70">{count}</span>
      )}
    </button>
  );
}

function StatusManager({
  categoryId,
  statuses,
  onClose,
  onStatusesChange,
}: {
  categoryId: string;
  statuses: ProcurementStatus[];
  onClose: () => void;
  onStatusesChange: (next: ProcurementStatus[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<StatusColorKey>("red");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updateStatus(id: string, patch: { name?: string; colorKey?: StatusColorKey }) {
    setSavingId(id);
    try {
      const res = await apiFetch(`/api/procurement/statuses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Не удалось сохранить статус");
        return;
      }
      onStatusesChange(
        statuses
          .map((s) => (s.id === id ? data.status : s))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru")),
      );
    } finally {
      setSavingId(null);
    }
  }

  async function deleteStatus(id: string, name: string) {
    if (!confirm(`Удалить статус «${name}»?`)) return;
    const res = await apiFetch(`/api/procurement/statuses/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Не удалось удалить статус");
      return;
    }
    onStatusesChange(statuses.filter((s) => s.id !== id));
    toast.success("Статус удалён");
  }

  async function addStatus(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const res = await apiFetch("/api/procurement/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, name, colorKey: newColor }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Не удалось создать статус");
      return;
    }
    onStatusesChange(
      [...statuses, data.status].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"),
      ),
    );
    setNewName("");
    toast.success("Статус добавлен");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Настройка статусов</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {statuses.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
            >
              <ColorPicker
                value={s.colorKey}
                disabled={savingId === s.id}
                onChange={(colorKey) => void updateStatus(s.id, { colorKey })}
              />
              <Input
                className="h-8 min-w-[140px] flex-1"
                defaultValue={s.name}
                disabled={savingId === s.id}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== s.name) void updateStatus(s.id, { name });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => void deleteStatus(s.id, s.name)}
                title="Удалить"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>

        <form onSubmit={addStatus} className="flex flex-wrap items-end gap-2 border-t pt-4">
          <div className="min-w-[160px] flex-1">
            <Label className="text-xs">Новый статус</Label>
            <Input
              className="h-8"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название"
            />
          </div>
          <div>
            <Label className="text-xs">Цвет</Label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <Button type="submit" size="sm" className="h-8 gap-1">
            <Plus className="size-3.5" />
            Добавить
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClose}>
            Закрыть
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: StatusColorKey;
  onChange: (color: StatusColorKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" title={STATUS_COLOR_LABEL[value]}>
      {STATUS_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          title={STATUS_COLOR_LABEL[key]}
          onClick={() => onChange(key)}
          className={cn(
            "size-5 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-50",
            STATUS_SWATCH_CLASS[key],
            value === key && "ring-2 ring-foreground ring-offset-1",
          )}
        />
      ))}
    </div>
  );
}
