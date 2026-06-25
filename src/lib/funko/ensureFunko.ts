import { pool, query } from '@/lib/db/index'

const FUNKO_DDL = `
CREATE TABLE IF NOT EXISTS funko_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funko_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES funko_categories(id) ON DELETE CASCADE,
  handle      TEXT NOT NULL,
  title       TEXT NOT NULL,
  image_url   TEXT,
  series      TEXT[] NOT NULL DEFAULT '{}',
  pop_number  INTEGER,
  owned       BOOLEAN NOT NULL DEFAULT false,
  want        BOOLEAN NOT NULL DEFAULT false,
  quantity    INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, handle)
);

CREATE INDEX IF NOT EXISTS funko_items_category_idx
  ON funko_items (category_id, sort_order, title);

CREATE INDEX IF NOT EXISTS funko_items_owned_idx
  ON funko_items (category_id, owned)
  WHERE owned = true;
`

const ANIMATION_CATEGORY_SQL = `
INSERT INTO funko_categories (slug, name, sort_order)
SELECT 'animation', 'Pop! Animation', 10
WHERE NOT EXISTS (SELECT 1 FROM funko_categories WHERE slug = 'animation');
`

let ensured = false

export async function ensureFunkoSchema(): Promise<void> {
  if (ensured) return
  await pool.query(FUNKO_DDL)
  await pool.query(ANIMATION_CATEGORY_SQL)
  ensured = true
}

export async function getCategoryBySlug(slug: string) {
  await ensureFunkoSchema()
  const rows = await query<{ id: string; slug: string; name: string }>(
    'SELECT id, slug, name FROM funko_categories WHERE slug = $1',
    [slug],
  )
  return rows[0] ?? null
}
