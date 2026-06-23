-- Файловый архив: категории и документы (локально или Google Cloud Storage).

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
