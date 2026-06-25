-- Funko: «Хочу» → «В пути», метка дублей

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

CREATE INDEX IF NOT EXISTS funko_items_in_transit_idx
  ON funko_items (category_id, in_transit)
  WHERE in_transit = true;
