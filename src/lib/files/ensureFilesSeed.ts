import { pool, query } from '@/lib/db/index'
import { IMPORTANT_DOCS_SLUG } from '@/lib/files/types'

const FILES_DDL = `
CREATE TABLE IF NOT EXISTS file_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  storage_type TEXT NOT NULL DEFAULT 'local' CHECK (storage_type IN ('local', 'gcs')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES file_categories(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL DEFAULT 0,
  storage_path  TEXT NOT NULL,
  preview_path  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS file_items_category_idx ON file_items (category_id, created_at DESC);

CREATE TABLE IF NOT EXISTS file_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES file_categories(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES file_folders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS file_folders_category_idx
  ON file_folders (category_id, parent_id, name);
`

async function ensureSortOrderColumns(): Promise<void> {
  await pool.query(
    'ALTER TABLE file_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0',
  )
  await pool.query(
    'ALTER TABLE file_folders ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0',
  )
  await pool.query(
    'ALTER TABLE file_folders ADD COLUMN IF NOT EXISTS module_text_enabled BOOLEAN NOT NULL DEFAULT false',
  )
  await pool.query(
    'ALTER TABLE file_folders ADD COLUMN IF NOT EXISTS module_gallery_enabled BOOLEAN NOT NULL DEFAULT false',
  )
  await pool.query(
    "ALTER TABLE file_folders ADD COLUMN IF NOT EXISTS folder_text TEXT NOT NULL DEFAULT ''",
  )
  await pool.query(
    'ALTER TABLE file_items ADD COLUMN IF NOT EXISTS in_gallery BOOLEAN NOT NULL DEFAULT false',
  )
  await pool.query(
    'ALTER TABLE file_items ADD COLUMN IF NOT EXISTS gallery_sort_order INTEGER NOT NULL DEFAULT 0',
  )
  await pool.query(
    'ALTER TABLE file_items ADD COLUMN IF NOT EXISTS content_hash CHAR(64)',
  )
  await pool.query(
    'ALTER TABLE file_items ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ',
  )
  await pool.query(`
    CREATE INDEX IF NOT EXISTS file_items_captured_at_idx
      ON file_items (captured_at DESC NULLS LAST)
      WHERE mime_type LIKE 'image/%'
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS file_items_category_hash_uidx
      ON file_items (category_id, content_hash)
      WHERE content_hash IS NOT NULL
  `)
}

const DEFAULT_CATEGORIES = [
  { slug: IMPORTANT_DOCS_SLUG, name: 'Важные документы', storageType: 'local', sortOrder: 10 },
  { slug: 'cloud', name: 'Облако (Google Cloud)', storageType: 'gcs', sortOrder: 20 },
  { slug: 'gallery', name: 'Галерея', storageType: 'gcs', sortOrder: 25 },
] as const

export async function ensureFilesSchema(): Promise<void> {
  await pool.query(FILES_DDL)
  await pool.query(
    'ALTER TABLE file_items ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES file_folders(id) ON DELETE SET NULL',
  )
  await ensureSortOrderColumns()
}

export async function ensureFilesSeed(): Promise<void> {
  await ensureFilesSchema()

  for (const cat of DEFAULT_CATEGORIES) {
    await pool.query(
      `INSERT INTO file_categories (slug, name, storage_type, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name`,
      [cat.slug, cat.name, cat.storageType, cat.sortOrder],
    )
  }
}

export async function getCategoryBySlug(slug: string) {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM file_categories WHERE slug = $1 LIMIT 1',
    [slug],
  )
  return rows[0] ?? null
}
