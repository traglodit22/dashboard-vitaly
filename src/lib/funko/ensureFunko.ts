import { pool, query } from '@/lib/db/index'
import { FUNKO_CATEGORY_DEFS } from '@/lib/funko/categoryConfig'

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
  image_gcs_key TEXT,
  series      TEXT[] NOT NULL DEFAULT '{}',
  pop_number  INTEGER,
  owned           BOOLEAN NOT NULL DEFAULT false,
  in_transit      BOOLEAN NOT NULL DEFAULT false,
  has_duplicates  BOOLEAN NOT NULL DEFAULT false,
  quantity        INTEGER NOT NULL DEFAULT 0,
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

async function seedFunkoCategories(): Promise<void> {
  for (const def of FUNKO_CATEGORY_DEFS) {
    await pool.query(
      `INSERT INTO funko_categories (slug, name, sort_order)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (SELECT 1 FROM funko_categories WHERE slug = $1)`,
      [def.slug, def.name, def.sortOrder],
    )
  }
}

let ensured = false

export async function ensureFunkoSchema(): Promise<void> {
  if (ensured) return
  await pool.query(FUNKO_DDL)
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'funko_items' AND column_name = 'want'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'funko_items' AND column_name = 'in_transit'
      ) THEN
        ALTER TABLE funko_items RENAME COLUMN want TO in_transit;
      END IF;
    END $$;
    ALTER TABLE funko_items ADD COLUMN IF NOT EXISTS in_transit BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE funko_items ADD COLUMN IF NOT EXISTS has_duplicates BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE funko_items ADD COLUMN IF NOT EXISTS image_gcs_key TEXT;
  `)
  await pool.query(ANIMATION_CATEGORY_SQL)
  await seedFunkoCategories()
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
