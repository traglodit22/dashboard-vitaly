-- Фото товара в закупках (файл на диске, метаданные в БД)

ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS image_mime TEXT;

ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ;
