-- Статусы позиций закупок (на категорию) вместо highlight_color.

CREATE TABLE IF NOT EXISTS procurement_statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES procurement_categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color_key   TEXT NOT NULL DEFAULT 'gray',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS procurement_statuses_category_idx
  ON procurement_statuses (category_id, sort_order);

ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES procurement_statuses(id) ON DELETE SET NULL;
