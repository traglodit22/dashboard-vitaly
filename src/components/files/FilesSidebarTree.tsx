"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, FolderPlus, Loader2, Trash2 } from "lucide-react";
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

interface FileFolder {
  id: string;
  categoryId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
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
    nodes.sort((a, b) => a.name.localeCompare(b.name, "ru"))
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

export function FilesSidebarTree() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const categorySlug = filesCategoryFromPathname(pathname)
  const currentFolderId = searchParams.get("folder")

  const [folders, setFolders] = useState<FileFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

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
    setExpanded(collectAncestorIds(folders, currentFolderId))
  }, [folders, currentFolderId])

  const tree = useMemo(() => buildFolderTree(folders), [folders])

  if (!categorySlug) return null

  async function createFolder() {
    const name = newName.trim()
    if (!name) return
    const res = await apiFetch("/api/files/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categorySlug,
        parentId: currentFolderId,
        name,
      }),
    })
    const data = await res.json()
    if (res.ok && data.folder) {
      setNewName("")
      setCreating(false)
      notifyFilesChanged()
      router.push(filesCategoryPath(categorySlug!, data.folder.id))
      toast.success("Папка создана")
    } else {
      toast.error("Не удалось создать папку", { description: data.error })
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

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-2 space-y-1 border-t border-border pt-2">
      <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        Папки
      </div>

      <Link
        href={filesCategoryPath(categorySlug)}
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
        <div className="max-h-[min(50vh,420px)] space-y-0.5 overflow-y-auto px-1">
          {tree.map((node) => (
            <FolderTreeNode
              key={node.id}
              node={node}
              depth={0}
              categorySlug={categorySlug}
              currentFolderId={currentFolderId}
              expanded={expanded}
              onToggle={toggleExpand}
              onDelete={deleteFolder}
            />
          ))}
          {!loading && tree.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Нет папок</p>
          )}
        </div>
      )}

      {creating ? (
        <div className="space-y-1.5 px-2 pb-1">
          <Input
            autoFocus
            className="h-8 text-xs"
            placeholder="Название"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createFolder()
              if (e.key === "Escape") {
                setCreating(false)
                setNewName("")
              }
            }}
          />
          <div className="flex gap-1">
            <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={() => void createFolder()}>
              OK
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setCreating(false)
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
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <FolderPlus className="size-3.5 shrink-0" />
          Новая папка
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
  onToggle,
  onDelete,
}: {
  node: FolderNode
  depth: number
  categorySlug: string
  currentFolderId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onDelete: (folder: FileFolder) => void
}) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)
  const isActive = currentFolderId === node.id

  return (
    <div>
      <div
        className="group flex items-center gap-0.5"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? "Свернуть" : "Развернуть"}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            onClick={() => onToggle(node.id)}
          >
            {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <Link
          href={filesCategoryPath(categorySlug, node.id)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pr-1 text-sm transition-colors",
            isActive
              ? "bg-primary/15 font-medium text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          title={node.name}
        >
          <Folder className="size-3.5 shrink-0 text-amber-500" />
          <span className="truncate">{node.name}</span>
        </Link>
        <button
          type="button"
          aria-label={`Удалить ${node.name}`}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault()
            onDelete(node)
          }}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      {hasChildren && isOpen &&
        node.children.map((child) => (
          <FolderTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            categorySlug={categorySlug}
            currentFolderId={currentFolderId}
            expanded={expanded}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
    </div>
  )
}
