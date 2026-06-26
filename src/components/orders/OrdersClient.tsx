"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Send,
  Boxes,
  ExternalLink,
  Trash2,
  Copy,
  Pencil,
  RefreshCw,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ORDER_STATUS_LABELS, type ProductOrder } from "@/types";
import { getStatusName, isRefusal, DELIVERING_STATUS_ID } from "@/lib/delivery/statuses";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { EditOrderDialog } from "@/components/orders/EditOrderDialog";
import { OrderMobileCard } from "@/components/orders/OrderMobileCard";
import { staleShipmentRowClass } from "@/lib/orders/staleHighlight";

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

const WAREHOUSE_STATUS_ID = 1; // "Ожидается на складе"
const PAGE_SIZE = 50;

type TabKey = "all" | "warehouse" | "awaiting_track" | "other" | "delivering";
type SortKey = "item" | "store" | "value";
type SortDir = "asc" | "desc";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "warehouse", label: "Ожидается на складе" },
  { key: "awaiting_track", label: "Ожидает ввода трек-кода" },
  { key: "other", label: "Все остальные статусы" },
  { key: "delivering", label: "Доставляется" },
];

// Поиск по описанию товара и трек-кодам (Китай + ДоброПост).
function matchesQuery(o: ProductOrder, q: string): boolean {
  return (
    o.itemDescription.toLowerCase().includes(q) ||
    (o.incomingDeclaration ?? "").toLowerCase().includes(q) ||
    (o.dpTrackNumber ?? "").toLowerCase().includes(q)
  );
}

function tabOf(o: ProductOrder): TabKey {
  if (o.status === "awaiting_track") return "awaiting_track";
  if (o.status === "sent") {
    if (o.dpStatusId === WAREHOUSE_STATUS_ID) return "warehouse";
    if (o.dpStatusId === DELIVERING_STATUS_ID) return "delivering";
  }
  return "other";
}

// Бейдж статуса: для отправленных показываем актуальный статус ДоброПост,
// отказы — красным, «Ожидается на складе» — голубым, прочее — зелёным.
function statusView(o: ProductOrder): { label: string; className: string } {
  if (o.status === "awaiting_track")
    return {
      label: ORDER_STATUS_LABELS.awaiting_track,
      className: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    };
  if (o.status === "ready")
    return {
      label: ORDER_STATUS_LABELS.ready,
      className: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    };
  const id = o.dpStatusId ?? undefined;
  const label =
    o.dpStatusName ??
    (id != null ? getStatusName(id) : ORDER_STATUS_LABELS.sent);
  if (id != null && isRefusal(id))
    return {
      label,
      className: "border-red-500/40 bg-red-500/10 text-red-400",
    };
  if (id === WAREHOUSE_STATUS_ID)
    return {
      label,
      className: "border-sky-500/40 bg-sky-500/10 text-sky-400",
    };
  return {
    label,
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  };
}

interface StatusChange {
  id: string;
  itemDescription: string;
  fromStatusName: string;
  toStatusId: number;
  toStatusName: string;
}

async function fetchOrders(archived?: boolean): Promise<ProductOrder[]> {
  const res = await apiFetch(`/api/orders${archived ? "?archived=1" : ""}`, {
    cache: "no-store",
  });
  const data = await res.json();
  return data.orders ?? [];
}

export function OrdersClient() {
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("warehouse");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProductOrder | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [changes, setChanges] = useState<StatusChange[]>([]);
  const changedIds = useMemo(
    () => new Set(changes.map((c) => c.id)),
    [changes],
  );

  const load = useCallback(async () => {
    const base = await fetchOrders();
    setOrders(archivedLoaded ? [...base, ...(await fetchOrders(true))] : base);
  }, [archivedLoaded]);

  const mergeArchived = useCallback(async (showToast = false) => {
    if (archivedLoaded) return;
    setLoadingArchived(true);
    try {
      const archived = await fetchOrders(true);
      setOrders((prev) => {
        const ids = new Set(prev.map((o) => o.id));
        return [...prev, ...archived.filter((o) => !ids.has(o.id))];
      });
      setArchivedLoaded(true);
      if (showToast) toast.success(`Загружено доставленных: ${archived.length}`);
    } finally {
      setLoadingArchived(false);
    }
  }, [archivedLoaded]);

  // «Доставляется» — архив, подгружается по требованию (кнопка во вкладке),
  // чтобы основной список не разрастался доставленными посылками.
  const loadArchived = useCallback(() => mergeArchived(true), [mergeArchived]);

  useEffect(() => {
    let active = true;
    fetchOrders().then((o) => {
      if (active) {
        setOrders(o);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Поиск должен находить и доставленные (архив), даже если вкладку ещё не открывали.
  useEffect(() => {
    if (!query.trim() || archivedLoaded) return;
    void mergeArchived(false);
  }, [query, archivedLoaded, mergeArchived]);

  // Сначала фильтр по поиску, затем счётчики/вкладки считаются от найденного.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => matchesQuery(o, q));
  }, [orders, query]);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      all: searched.length,
      warehouse: 0,
      awaiting_track: 0,
      other: 0,
      delivering: 0,
    };
    for (const o of searched) c[tabOf(o)]++;
    return c;
  }, [searched]);

  const visible = useMemo(() => {
    const base = tab === "all" ? searched : searched.filter((o) => tabOf(o) === tab);
    if (!sortKey) return base;
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "item") cmp = a.itemDescription.localeCompare(b.itemDescription, "ru");
      else if (sortKey === "store") cmp = (a.store ?? "").localeCompare(b.store ?? "", "ru");
      else if (sortKey === "value") cmp = a.totalAmount - b.totalAmount;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [searched, tab, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Если после фильтрации/поиска текущая страница оказалась за пределами — откатываемся на последнюю доступную.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);
  // Смена вкладки, поиска или сортировки — начинаем с первой страницы.
  useEffect(() => {
    setPage(1);
  }, [tab, query, sortKey, sortDir]);
  const paged = useMemo(
    () => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visible, page],
  );

  // Вес известен только для посылок, уже принятых складом — на «Ожидается на
  // складе» и «Ожидает трек-код» он всегда пуст, поэтому там колонку прячем.
  const showWeight = tab === "all" || tab === "other" || tab === "delivering";

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 inline size-3 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline size-3 text-primary" />
      : <ArrowDown className="ml-1 inline size-3 text-primary" />;
  }

  // При начале поиска (переход пусто→текст) переключаемся на «Все», чтобы
  // совпадение не пряталось в неактивной вкладке. Дальше можно сузить вручную.
  const onSearch = (value: string) => {
    if (!query && value) setTab("all");
    setQuery(value);
  };

  async function refreshStatuses(which: "warehouse" | "other") {
    setRefreshing(true);
    try {
      const url =
        which === "warehouse"
          ? "/api/orders/refresh-statuses"
          : "/api/orders/refresh-other-statuses";
      const res = await apiFetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Не удалось обновить статусы", {
          description: data.error,
        });
        return;
      }
      await load();
      const changed: StatusChange[] = data.changed ?? [];
      setChanges(changed);
      if (changed.length === 0) {
        toast.info(`Проверено: ${data.checked}. Изменений нет.`);
      } else {
        toast.success(
          `Сменили статус: ${changed.length} из ${data.checked}`,
        );
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function addTrack(id: string) {
    const track = (tracks[id] ?? "").trim();
    if (!track) return;
    setBusy(id);
    try {
      const res = await apiFetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incomingDeclaration: track }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Ошибка", { description: (data.errors ?? [])[0] });
        return;
      }
      toast[data.sent ? "success" : "warning"](
        data.sent ? "Отправлено в ДоброПост" : "Трек добавлен",
        { description: data.sent ? data.order.dpTrackNumber : data.error },
      );
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function send(id: string) {
    setBusy(id);
    try {
      const res = await apiFetch(`/api/orders/${id}/send`, { method: "POST" });
      const data = await res.json();
      toast[data.sent ? "success" : "warning"](
        data.sent ? "Отправлено в ДоброПост" : "Не удалось отправить",
        { description: data.sent ? data.order.dpTrackNumber : data.error },
      );
      await load();
    } finally {
      setBusy(null);
    }
  }

  // Дубликат повторно купленного товара: те же данные, но без трек-кода —
  // новая отправка создаётся в статусе «Ожидает ввода трек-кода».
  async function copy(o: ProductOrder) {
    setBusy(o.id);
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemDescription: o.itemDescription,
          numberOfItemPieces: o.numberOfItemPieces,
          itemPrice: o.itemPrice,
          itemStoreLink: o.itemStoreLink,
          store: o.store,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Не удалось скопировать", {
          description: (data.errors ?? [])[0],
        });
        return;
      }
      toast.success("Скопировано", { description: "Новая отправка ждёт трек-код" });
      setTab("awaiting_track");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    const res = await apiFetch(`/api/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Удалено");
      load();
    }
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Boxes className="size-5 text-primary" />
          Отправки
          <span className="font-mono text-sm font-normal text-muted-foreground">
            {orders.length}
          </span>
        </CardTitle>
        {(tab === "warehouse" || tab === "other" || tab === "delivering") && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (tab === "delivering") loadArchived();
              else if (tab === "warehouse" || tab === "other")
                refreshStatuses(tab);
            }}
            disabled={refreshing || loadingArchived}
          >
            {refreshing || loadingArchived ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Обновить статусы
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поиск по треку и описанию */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Поиск по трек-коду (Китай / ДоброПост) или описанию товара"
            className="h-9 pr-8 pl-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Очистить поиск"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Вкладки по статусам */}
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-mono",
                  tab === key
                    ? "bg-primary/15 text-primary"
                    : "bg-foreground/10 text-muted-foreground",
                )}
              >
                {key === "delivering" && !archivedLoaded ? "…" : counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Сводка по сменившим статус после «Обновить статусы» */}
        {changes.length > 0 && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-400">
                Сменили статус: {changes.length}
              </span>
              <button
                onClick={() => setChanges([])}
                className="text-emerald-400/70 hover:text-emerald-400"
                aria-label="Скрыть"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="space-y-1">
              {changes.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
                >
                  <span className="font-medium">{c.itemDescription}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {c.fromStatusName}
                    <ArrowRight className="size-3" />
                    <span
                      className={cn(
                        "font-medium",
                        isRefusal(c.toStatusId)
                          ? "text-red-400"
                          : "text-emerald-400",
                      )}
                    >
                      {c.toStatusName}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading || (query.trim() && loadingArchived && !archivedLoaded) ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {query.trim() && loadingArchived ? "Поиск в архиве…" : "Загрузка…"}
          </div>
        ) : tab === "delivering" && !archivedLoaded ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Доставленные посылки хранятся как архив — нажмите «Обновить
            статусы», чтобы загрузить.
          </p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {query
              ? searched.length === 0
                ? `Ничего не найдено по запросу «${query}».`
                : `В этой вкладке нет совпадений. Всего найдено: ${searched.length} — откройте «Все».`
              : orders.length === 0
                ? "Пока нет отправок. Добавьте товар на странице «Создать»."
                : "В этой вкладке пока пусто."}
          </p>
        ) : (
          <>
          <div className="space-y-2 md:hidden">
            {paged.map((o) => {
              const view = statusView(o);
              const staleRow = staleShipmentRowClass(o);
              return (
                <OrderMobileCard
                  key={o.id}
                  order={o}
                  statusLabel={view.label}
                  statusClassName={view.className}
                  rowClassName={cn(
                    staleRow,
                    !staleRow &&
                      changedIds.has(o.id) &&
                      "border-emerald-500/30 bg-emerald-500/10",
                  )}
                  showWeight={showWeight}
                  trackValue={tracks[o.id] ?? ""}
                  onTrackChange={(v) => setTracks((t) => ({ ...t, [o.id]: v }))}
                  busy={busy === o.id}
                  onAddTrack={() => addTrack(o.id)}
                  onSend={() => send(o.id)}
                  onEdit={() => setEditing(o)}
                  onCopy={() => copy(o)}
                  onRemove={() => remove(o.id)}
                />
              );
            })}
          </div>
          <Table className="hidden table-fixed text-xs md:table sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[3.25rem] px-1.5">Дата</TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => toggleSort("item")}
                >
                  Товар<SortIcon col="item" />
                </TableHead>
                <TableHead
                  className="hidden w-[4.5rem] cursor-pointer select-none hover:text-foreground sm:table-cell"
                  onClick={() => toggleSort("store")}
                >
                  Маг.<SortIcon col="store" />
                </TableHead>
                <TableHead
                  className="w-[4.5rem] cursor-pointer select-none text-right hover:text-foreground"
                  onClick={() => toggleSort("value")}
                >
                  ¥<SortIcon col="value" />
                </TableHead>
                {showWeight && (
                  <TableHead className="hidden w-[3.5rem] text-right md:table-cell">
                    кг
                  </TableHead>
                )}
                <TableHead className="w-[5.5rem]">Статус</TableHead>
                <TableHead className="min-w-0">Трек / действие</TableHead>
                <TableHead className="w-[4.75rem] px-1" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((o) => {
                const view = statusView(o);
                const staleRow = staleShipmentRowClass(o);
                return (
                  <TableRow
                    key={o.id}
                    className={cn(
                      staleRow,
                      !staleRow &&
                        changedIds.has(o.id) &&
                        "bg-emerald-500/10 hover:bg-emerald-500/15",
                    )}
                  >
                    <TableCell className="whitespace-normal px-1.5 py-1.5 align-top font-mono text-[10px] leading-tight text-muted-foreground sm:text-xs">
                      {dt.format(new Date(o.createdAt))}
                    </TableCell>
                    <TableCell className="max-w-0 whitespace-normal py-1.5 align-top">
                      <div
                        className="line-clamp-2 text-xs font-medium leading-snug sm:text-sm"
                        title={o.itemDescription}
                      >
                        {o.itemDescription}
                      </div>
                      <a
                        href={o.itemStoreLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary sm:text-xs"
                      >
                        ссылка <ExternalLink className="size-2.5 sm:size-3" />
                      </a>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground sm:hidden">
                        {o.store}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-0 truncate py-1.5 align-top text-xs text-muted-foreground sm:table-cell">
                      {o.store}
                    </TableCell>
                    <TableCell className="whitespace-normal py-1.5 text-right align-top font-mono tabular-nums leading-tight">
                      <div className="text-amber-500">¥{yuan.format(o.totalAmount)}</div>
                      <div className="text-[10px] text-muted-foreground sm:text-xs">
                        ×{o.numberOfItemPieces}
                      </div>
                    </TableCell>
                    {showWeight && (
                      <TableCell className="hidden py-1.5 text-right align-top font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                        {o.dpWeightKg != null ? kg.format(o.dpWeightKg) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-normal py-1.5 align-top">
                      <Badge
                        variant="outline"
                        className={cn("max-w-full truncate px-1.5 py-0 text-[10px] sm:text-xs", view.className)}
                        title={view.label}
                      >
                        {view.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-0 whitespace-normal py-1.5 align-top">
                      {o.status === "awaiting_track" && (
                        <div className="flex min-w-0 items-center gap-1">
                          <Input
                            value={tracks[o.id] ?? ""}
                            maxLength={15}
                            placeholder="трек Китай"
                            className="h-7 min-w-0 flex-1 px-2 font-mono text-[11px] sm:text-xs"
                            onChange={(e) =>
                              setTracks((t) => ({
                                ...t,
                                [o.id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="icon"
                            className="size-7 shrink-0"
                            disabled={busy === o.id}
                            onClick={() => addTrack(o.id)}
                            title="Сохранить трек"
                          >
                            {busy === o.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <span className="text-[10px] font-semibold">OK</span>
                            )}
                          </Button>
                        </div>
                      )}
                      {o.status === "ready" && (
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="size-7"
                            disabled={busy === o.id}
                            onClick={() => send(o.id)}
                            title="Отправить в ДоброПост"
                          >
                            {busy === o.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                          </Button>
                          {o.incomingDeclaration && (
                            <span className="truncate text-[10px] text-muted-foreground sm:text-xs">
                              Китай:{" "}
                              <span className="font-mono">{o.incomingDeclaration}</span>
                            </span>
                          )}
                          {o.lastError && (
                            <span
                              className="line-clamp-2 text-[10px] text-destructive sm:text-xs"
                              title={o.lastError}
                            >
                              {o.lastError}
                            </span>
                          )}
                        </div>
                      )}
                      {o.status === "sent" && (
                        <div className="flex min-w-0 flex-col gap-0.5 text-[10px] sm:text-xs">
                          {o.dpTrackNumber && (
                            <span
                              className="truncate font-mono text-emerald-400"
                              title="Трек ДоброПост"
                            >
                              {o.dpTrackNumber}
                            </span>
                          )}
                          {o.incomingDeclaration && (
                            <span
                              className="truncate text-muted-foreground"
                              title="Трек по Китаю"
                            >
                              Китай:{" "}
                              <span className="font-mono">{o.incomingDeclaration}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-1 py-1.5 align-top">
                      <div className="flex items-center justify-end gap-0">
                        {o.status !== "sent" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditing(o)}
                            title="Редактировать"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          disabled={busy === o.id}
                          onClick={() => copy(o)}
                          title="Скопировать"
                        >
                          {busy === o.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(o.id)}
                          title="Удалить"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </>
        )}

        {!loading && visible.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Страница {page} из {pageCount} · показано {paged.length} из {visible.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    {editing && (
      <EditOrderDialog
        order={editing}
        onClose={(updated) => {
          setEditing(null);
          if (updated) load();
        }}
      />
    )}
    </>
  );
}
