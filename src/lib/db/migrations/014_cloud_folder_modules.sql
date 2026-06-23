-- Модули папок в облаке: текст и галерея.

ALTER TABLE file_folders
  ADD COLUMN IF NOT EXISTS module_text_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS module_gallery_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS folder_text TEXT NOT NULL DEFAULT '';

ALTER TABLE file_items
  ADD COLUMN IF NOT EXISTS in_gallery BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gallery_sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS file_items_gallery_idx
  ON file_items (folder_id, in_gallery, gallery_sort_order)
  WHERE in_gallery = true;
