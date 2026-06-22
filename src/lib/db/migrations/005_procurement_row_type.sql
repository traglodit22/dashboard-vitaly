-- Разделители «Тип» в списке закупок (только название, без количеств)

ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS row_type TEXT NOT NULL DEFAULT 'item';

UPDATE procurement_items SET row_type = 'item' WHERE row_type IS NULL;
