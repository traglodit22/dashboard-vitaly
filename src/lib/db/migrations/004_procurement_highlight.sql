-- Цвет подсветки строки: red | yellow | green | NULL (авто по статусу)

ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS highlight_color TEXT;
