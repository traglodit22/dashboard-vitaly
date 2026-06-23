-- Папки внутри категорий файлов (локально и GCS).

CREATE TABLE IF NOT EXISTS file_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES file_categories(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES file_folders(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS file_folders_category_idx
  ON file_folders (category_id, parent_id, name);

ALTER TABLE file_items
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES file_folders(id) ON DELETE SET NULL;
