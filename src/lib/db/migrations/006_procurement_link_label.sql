-- Подпись ссылки (короткий кликабельный текст вместо URL)

ALTER TABLE procurement_items
  ADD COLUMN IF NOT EXISTS link_label TEXT;
