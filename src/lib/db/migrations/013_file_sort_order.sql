-- Порядок сортировки папок и файлов (drag-and-drop).

ALTER TABLE file_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE file_folders ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (
    PARTITION BY category_id, folder_id
    ORDER BY created_at ASC
  ) * 10)::INTEGER AS so
  FROM file_items
)
UPDATE file_items fi
SET sort_order = numbered.so
FROM numbered
WHERE fi.id = numbered.id AND fi.sort_order = 0;

WITH numbered AS (
  SELECT id, (ROW_NUMBER() OVER (
    PARTITION BY category_id, parent_id
    ORDER BY created_at ASC, name ASC
  ) * 10)::INTEGER AS so
  FROM file_folders
)
UPDATE file_folders ff
SET sort_order = numbered.so
FROM numbered
WHERE ff.id = numbered.id AND ff.sort_order = 0;

CREATE INDEX IF NOT EXISTS file_items_folder_sort_idx
  ON file_items (category_id, folder_id, sort_order);

CREATE INDEX IF NOT EXISTS file_folders_parent_sort_idx
  ON file_folders (category_id, parent_id, sort_order);
