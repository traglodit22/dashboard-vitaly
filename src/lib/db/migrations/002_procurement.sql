-- Закупки для Китая (категории и позиции)

CREATE TABLE IF NOT EXISTS procurement_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID NOT NULL REFERENCES procurement_categories(id) ON DELETE CASCADE,
  group_name     TEXT,
  name           TEXT NOT NULL,
  need_qty       INTEGER NOT NULL DEFAULT 0,
  have_qty       INTEGER NOT NULL DEFAULT 0,
  in_transit_qty INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  link           TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS procurement_items_category_idx
  ON procurement_items (category_id, sort_order);

-- Начальные позиции «Отель» заливаются один раз при старте приложения
-- (ensureHotelProcurement), только если категория пуста.
