"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, FolderPlus, GripVertical, Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import {
  FILES_CHANGED_EVENT,
  filesCategoryFromPathname,
  filesCategoryPath,
  notifyFilesChanged,
} from "@/lib/files/routes";
import { reorderById } from "@/lib/files/reorderList";

interface FileFolder {
  id: string;
  categoryId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  isFavorite: boolean;
}

interface FolderNode extends FileFolder {
  children: FolderNode[];
}

function buildFolderTree(folders: FileFolder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>()
  for (const f of folders) {
    byId.set(f.id, { ...f, children: [] })
  }
  const roots: FolderNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortNodes = (nodes: FolderNode[]) => {
    nodes.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"),
    )
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)
  return roots
}

function collectAncestorIds(folders: FileFolder[], folderId: string | null): Set<string> {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const expanded = new Set<string>()
  let current = folderId
  while (current) {
    expanded.add(current)
    current = byId.get(current)?.parentId ?? null
  }
  return expanded
}

export function FilesSidebarTree({
  onNavigate,
  embedded = false,
  className,
}: {
  onNavigate?: () => void;
  embedded?: boolean;
  className?: string;
} = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const categorySlug = filesCategoryFromPathname(pathname)
  const currentFolderId = searchParams.get("folder")

  const [folders, setFolders] = useState<FileFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  /** null = создать в текущей открытой папке (или в корне) */
  const [creatingIn, setCreatingIn] = useState<string | null | false>(false)
  const [newName, setNewName] = useState("")
  const [dragFolderId, setDragFolderId] = useState<string | null>(null)

  const loadFolders = useCallback(async () => {
    if (!categorySlug) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ categorySlug, all: "true" })
      const res = await apiFetch(`/api/files/folders?${params}`, { cache: "no-store" })
      const data = await res.json()
      setFolders(data.folders ?? [])
    } finally {
      setLoading(false)
    }
  }, [categorySlug])

  useEffect(() => {
    void loadFolders()
  }, [loadFolders])

  useEffect(() => {
    const onChange = () => void loadFolders()
    window.addEventListener(FILES_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(FILES_CHANGED_EVENT, onChange)
  }, [loadFolders])

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of collectAncestorIds(folders, currentFolderId)) next.add(id)
      return next
    })
  }, [folders, currentFolderId])

  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  if (!categorySlug) return null;

  function startCreate(parentId: string | null) {
    setCreatingIn(parentId)
    setNewName("")
    if (parentId) {
      setExpanded((prev) => new Set(prev).add(parentId))
    }
  }

  async function submitCreateFolder() {
    const name = newName.trim()
    if (!name || creatingIn === false) return

    const parentId = creatingIn

    const res = await apiFetch("/api/files/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, parentId, name }),
    })
    const data = await res.json()
    if (res.ok && data.folder) {
      setNewName("")
      setCreatingIn(false)
      if (parentId) {
        setExpanded((prev) => new Set(prev).add(parentId))
      }
      notifyFilesChanged()
      router.push(filesCategoryPath(categorySlug!, data.folder.id))
      toast.success(parentId ? "Подпапка создана" : "Папка создана")
    } else {
      toast.error("Не удалось создать папку", { description: data.error })
    }
  }

  function siblingsOf(parentId: string | null): FileFolder[] {
    return folders
      .filter((f) => f.parentId === parentId)
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"),
      )
  }

  async function persistFolderOrder(parentId: string | null, ordered: FileFolder[]) {
    const res = await apiFetch("/api/files/folders/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, parentId, ids: ordered.map((f) => f.id) }),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error("Не удалось сохранить порядок", { description: data.error })
      void loadFolders()
      return
    }
    const sortMap = new Map(ordered.map((f, i) => [f.id, (i + 1) * 10]))
    setFolders((prev) =>
      prev.map((f) => (sortMap.has(f.id) ? { ...f, sortOrder: sortMap.get(f.id)! } : f)),
    )
    notifyFilesChanged()
  }

  function onFolderDrop(targetId: string, parentId: string | null) {
    if (!dragFolderId || dragFolderId === targetId) return
    const siblings = siblingsOf(parentId)
    if (siblings.length < 2) return
    if (!siblings.some((s) => s.id === dragFolderId)) return
    const next = reorderById(siblings, dragFolderId, targetId)
    setDragFolderId(null)
    void persistFolderOrder(parentId, next)
  }

  async function renameFolderItem(folder: FileFolder, name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === folder.name) return

    const res = await apiFetch(`/api/files/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    const data = await res.json()
    if (res.ok && data.folder) {
      setFolders((prev) =>
        prev.map((f) => (f.id === folder.id ? { ...f, name: data.folder.name } : f)),
      )
      notifyFilesChanged()
    } else {
      toast.error("Не удалось переименовать", { description: data.error })
    }
  }

  async function deleteFolder(folder: FileFolder) {
    if (!confirm(`Удалить папку «${folder.name}»?`)) return
    const res = await apiFetch(`/api/files/folders/${folder.id}`, { method: "DELETE" })
    const data = await res.json()
    if (res.ok) {
      notifyFilesChanged()
      if (currentFolderId === folder.id) {
        router.push(filesCategoryPath(categorySlug!))
      }
      toast.success("Папка удалена")
    } else {
      toast.error("Не удалось удалить", { description: data.error })
    }
  }

  async function toggleFavorite(folder: FileFolder) {
    const res = await apiFetch(`/api/files/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !folder.isFavorite }),
    });
    const data = await res.json();
    if (res.ok && data.folder) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folder.id ? { ...f, isFavorite: Boolean(data.folder.isFavorite) } : f,
        ),
      );
      notifyFilesChanged();
      toast.success(data.folder.isFavorite ? "Добавлено в избранное" : "Убрано из избранного");
    } else {
      toast.error("Не удалось обновить избранное", { description: data.error });
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={cn("mt-2 flex min-h-0 flex-1 flex-col space-y-1 border-t border-border pt-2", className)}>
      {!embedded && (
      <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        Папки
      </div>
      )}

      <Link
        href={filesCategoryPath(categorySlug)}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
          !currentFolderId
            ? "bg-primary/15 font-medium text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Folder className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">Все файлы</span>
      </Link>

      {loading && folders.length === 0 ? (
        <div className="flex justify-center py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          className={cn(
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1",
          embedded && "max-h-none",
        )}
          role="tree"
          aria-label="Папки облака"
        >
          {tree.map((node) => (
            <FolderTreeNode
              key={node.id}
              node={node}
              depth={0}
              categorySlug={categorySlug}
              currentFolderId={currentFolderId}
              expanded={expanded}
              siblingCount={tree.length}
              dragFolderId={dragFolderId}
              onNavigate={onNavigate}
              onToggle={toggleExpand}
              onDelete={deleteFolder}
              onRename={renameFolderItem}
              onToggleFavorite={toggleFavorite}
              onCreateSubfolder={startCreate}
              onDragStart={setDragFolderId}
              onDragEnd={() => setDragFolderId(null)}
              onDrop={onFolderDrop}
              compactActions={embedded}
            />
          ))}
          {!loading && tree.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Нет папок</p>
          )}
        </div>
      )}

      {creatingIn !== false ? (
        <div className="space-y-1.5 px-2 pb-1">
          <p className="px-1 text-[10px] text-muted-foreground">
            {creatingIn ? "Новая подпапка" : "Новая папка в корне"}
          </p>
          <Input
            autoFocus
            className="h-8 text-xs"
            placeholder="Название папки"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitCreateFolder()
              if (e.key === "Escape") {
                setCreatingIn(false)
                setNewName("")
              }
            }}
          />
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={() => void submitCreateFolder()}>
              Создать
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setCreatingIn(false)
                setNewName("")
              }}
            >
              ✕
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => startCreate(currentFolderId)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <FolderPlus className="size-3.5 shrink-0" />
          {currentFolderId ? "Подпапка здесь" : "Новая папка"}
        </button>
      )}
    </div>
  )
}

function FolderTreeNode({
  node,
  depth,
  categorySlug,
  currentFolderId,
  expanded,
  siblingCount,
  dragFolderId,
  onToggle,
  onDelete,
  onRename,
  onToggleFavorite,
  onCreateSubfolder,
  onDragStart,
  onDragEnd,
  onDrop,
  onNavigate,
  compactActions = false,
}: {
  node: FolderNode
  depth: number
  categorySlug: string
  currentFolderId: string | null
  expanded: Set<string>
  siblingCount: number
  dragFolderId: string | null
  onToggle: (id: string) => void
  onDelete: (folder: FileFolder) => void
  onRename: (folder: FileFolder, name: string) => void
  onToggleFavorite: (folder: FileFolder) => void
  onCreateSubfolder: (parentId: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: (targetId: string, parentId: string | null) => void
  onNavigate?: () => void
  compactActions?: boolean
}) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)
  const isActive = currentFolderId === node.id
  const isDragging = dragFolderId === node.id
  const canDrag = siblingCount > 1
  const isRoot = depth === 0
  const isNested = depth > 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.name)

  useEffect(() => {
    setDraft(node.name)
  }, [node.name])

  const isOnPath =
    isActive ||
    node.children.some(function walk(n: FolderNode): boolean {
      if (n.id === currentFolderId) return true
      return n.children.some(walk)
    })

  const row = (
    <div
      className={cn(
        "group rounded-md py-0.5 pr-1",
        isDragging && "opacity-50",
        isActive && "bg-primary/12 ring-1 ring-primary/25",
        isNested && !isActive && "bg-muted/15",
      )}
      onDragOver={(e) => {
        if (!dragFolderId || dragFolderId === node.id) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(node.id, node.parentId)
      }}
    >
      <div className="flex min-w-0 items-start gap-0.5">
        {canDrag ? (
          <span
            draggable
            title="Перетащить"
            className="mt-0.5 hidden size-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:bg-accent hover:text-muted-foreground active:cursor-grabbing group-hover:opacity-100 sm:flex"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              onDragStart(node.id)
            }}
            onDragEnd={onDragEnd}
          >
            <GripVertical className="size-3" />
          </span>
        ) : null}
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
          {hasChildren ? (
            <button
              type="button"
              aria-label={isOpen ? "Свернуть" : "Развернуть"}
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
              onClick={() => onToggle(node.id)}
            >
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span
              className={cn(
                "size-1.5 rounded-full",
                isNested ? "bg-muted-foreground/35" : "bg-transparent",
              )}
              aria-hidden
            />
          )}
        </span>
        {editing ? (
          <Input
            autoFocus
            className="h-7 min-w-0 flex-1 text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false)
              void onRename(node, draft)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") {
                setDraft(node.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <>
            <Link
              href={filesCategoryPath(categorySlug, node.id)}
              onClick={onNavigate}
              className={cn(
                "flex min-w-0 flex-1 items-start gap-1.5 rounded-md px-1 py-0.5 leading-snug transition-colors",
                isRoot ? "text-sm" : "text-[13px]",
                isActive
                  ? "font-semibold text-primary"
                  : isOnPath
                    ? "font-medium text-foreground"
                    : isNested
                      ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                      : "text-foreground/90 hover:bg-accent hover:text-foreground",
              )}
              title={node.name}
              onDoubleClick={(e) => {
                e.preventDefault()
                setDraft(node.name)
                setEditing(true)
              }}
            >
              <Folder
                className={cn(
                  "mt-0.5 shrink-0",
                  isRoot ? "size-4" : "size-3.5",
                  isActive
                    ? "fill-primary/15 text-primary"
                    : isNested
                      ? "text-amber-500/70"
                      : "text-amber-500",
                )}
              />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{node.name}</span>
            </Link>
            <div
              className={cn(
                "mt-0.5 flex shrink-0 gap-0.5",
                compactActions || node.isFavorite
                  ? "opacity-100"
                  : "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
              )}
            >
              <button
                type="button"
                aria-label={node.isFavorite ? "Убрать из избранного" : "В избранное"}
                title={node.isFavorite ? "Убрать из избранного" : "В избранное"}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onToggleFavorite(node)}
              >
                <Star
                  className={cn(
                    "size-3",
                    node.isFavorite && "fill-amber-400 text-amber-400",
                  )}
                />
              </button>
              <button
                type="button"
                aria-label={`Переименовать «${node.name}»`}
                title="Переименовать"
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => {
                  setDraft(node.name)
                  setEditing(true)
                }}
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Подпапка в «${node.name}»`}
                title="Создать подпапку"
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onCreateSubfolder(node.id)}
              >
                <FolderPlus className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`Удалить ${node.name}`}
                title="Удалить"
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(node)}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-w-0" role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
      {row}
      {isOpen && hasChildren && (
        <div
          className={cn(
            "relative ms-3 space-y-0.5 border-s-2 ps-2.5",
            isActive ? "border-primary/30" : "border-border/70",
          )}
        >
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              categorySlug={categorySlug}
              currentFolderId={currentFolderId}
              expanded={expanded}
              siblingCount={node.children.length}
              dragFolderId={dragFolderId}
              onToggle={onToggle}
              onDelete={onDelete}
              onRename={onRename}
              onToggleFavorite={onToggleFavorite}
              onCreateSubfolder={onCreateSubfolder}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onNavigate={onNavigate}
              compactActions={compactActions}
            />
          ))}
        </div>
      )}
    </div>
  )
}
