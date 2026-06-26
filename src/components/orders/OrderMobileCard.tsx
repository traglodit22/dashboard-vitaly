"use client";

import {
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ProductOrder } from "@/types";
import { cn } from "@/lib/utils";

const yuan = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const kg = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function OrderMobileCard({
  order: o,
  statusLabel,
  statusClassName,
  rowClassName,
  showWeight,
  trackValue,
  onTrackChange,
  busy,
  onAddTrack,
  onSend,
  onEdit,
  onCopy,
  onRemove,
}: {
  order: ProductOrder;
  statusLabel: string;
  statusClassName: string;
  rowClassName?: string;
  showWeight: boolean;
  trackValue: string;
  onTrackChange: (value: string) => void;
  busy: boolean;
  onAddTrack: () => void;
  onSend: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  return (
    <Card size="sm" className={cn("gap-0 py-0", rowClassName)}>
      <CardContent className="space-y-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 text-sm font-medium leading-snug">{o.itemDescription}</p>
            <a
              href={o.itemStoreLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
            >
              {o.store || "магазин"} <ExternalLink className="size-3" />
            </a>
          </div>
          <Badge variant="outline" className={cn("shrink-0 text-[10px]", statusClassName)}>
            {statusLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{dt.format(new Date(o.createdAt))}</span>
          <span className="font-mono tabular-nums text-amber-500">
            ¥{yuan.format(o.totalAmount)} ×{o.numberOfItemPieces}
          </span>
          {showWeight && o.dpWeightKg != null && (
            <span className="font-mono tabular-nums">{kg.format(o.dpWeightKg)} кг</span>
          )}
        </div>

        {o.status === "awaiting_track" && (
          <div className="flex gap-2">
            <Input
              value={trackValue}
              maxLength={15}
              placeholder="трек Китай"
              className="h-10 min-w-0 flex-1 font-mono text-sm"
              onChange={(e) => onTrackChange(e.target.value)}
            />
            <Button
              type="button"
              className="h-10 shrink-0 px-4"
              disabled={busy}
              onClick={onAddTrack}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "OK"}
            </Button>
          </div>
        )}

        {o.status === "ready" && (
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-full gap-2"
              disabled={busy}
              onClick={onSend}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Отправить в ДоброПост
            </Button>
            {o.incomingDeclaration && (
              <p className="truncate text-xs text-muted-foreground">
                Китай: <span className="font-mono">{o.incomingDeclaration}</span>
              </p>
            )}
            {o.lastError && (
              <p className="text-xs text-destructive">{o.lastError}</p>
            )}
          </div>
        )}

        {o.status === "sent" && (
          <div className="space-y-0.5 text-xs">
            {o.dpTrackNumber && (
              <p className="truncate font-mono text-emerald-400">{o.dpTrackNumber}</p>
            )}
            {o.incomingDeclaration && (
              <p className="truncate text-muted-foreground">
                Китай: <span className="font-mono">{o.incomingDeclaration}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-2">
          {o.status !== "sent" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={onEdit}
              title="Редактировать"
            >
              <Pencil className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            disabled={busy}
            onClick={onCopy}
            title="Скопировать"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            title="Удалить"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
