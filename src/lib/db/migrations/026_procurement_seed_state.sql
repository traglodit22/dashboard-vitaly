-- Одноразовая заливка закупок: после первого seed категория больше не пересоздаётся.

CREATE TABLE IF NOT EXISTS procurement_seed_state (
  category_name TEXT PRIMARY KEY,
  seeded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO procurement_seed_state (category_name, seeded_at)
SELECT c.name, NOW()
FROM procurement_categories c
WHERE EXISTS (SELECT 1 FROM procurement_items i WHERE i.category_id = c.id)
ON CONFLICT (category_name) DO NOTHING;
