import { apiFetch } from "@/lib/apiFetch";

type FolderRow = { id: string; name: string };

/** Кэш «parentId|name» → id, чтобы не дублировать запросы при пакетной загрузке. */
export type FolderPathCache = Map<string, string>;

function cacheKey(parentId: string | null, name: string): string {
  return `${parentId ?? "root"}|${name.toLowerCase()}`;
}

async function listChildFolders(
  categorySlug: string,
  parentId: string | null,
): Promise<FolderRow[]> {
  const params = new URLSearchParams({ categorySlug });
  if (parentId) params.set("parentId", parentId);
  const res = await apiFetch(`/api/files/folders?${params}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(String(data.error ?? "Не удалось загрузить список папок"));
  }
  return (data.folders ?? []) as FolderRow[];
}

async function createChildFolder(
  categorySlug: string,
  parentId: string | null,
  name: string,
): Promise<FolderRow> {
  const res = await apiFetch("/api/files/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categorySlug, parentId, name }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(String(data.error ?? "Не удалось создать папку"));
  }
  return data.folder as FolderRow;
}

/** Создаёт цепочку вложенных папок и возвращает id конечной папки. */
export async function ensureFolderPath(
  categorySlug: string,
  baseParentId: string | null,
  segments: string[],
  cache: FolderPathCache,
): Promise<string | null> {
  let parentId = baseParentId;

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const key = cacheKey(parentId, trimmed);
    const cached = cache.get(key);
    if (cached) {
      parentId = cached;
      continue;
    }

    const siblings = await listChildFolders(categorySlug, parentId);
    const existing = siblings.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      cache.set(key, existing.id);
      parentId = existing.id;
      continue;
    }

    const created = await createChildFolder(categorySlug, parentId, trimmed);
    cache.set(key, created.id);
    parentId = created.id;
  }

  return parentId;
}
