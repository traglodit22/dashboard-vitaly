ALTER TABLE file_items ADD COLUMN IF NOT EXISTS content_hash CHAR(64);
ALTER TABLE file_items ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS file_items_captured_at_idx
  ON file_items (captured_at DESC NULLS LAST)
  WHERE mime_type LIKE 'image/%';

CREATE UNIQUE INDEX IF NOT EXISTS file_items_category_hash_uidx
  ON file_items (category_id, content_hash)
  WHERE content_hash IS NOT NULL;
