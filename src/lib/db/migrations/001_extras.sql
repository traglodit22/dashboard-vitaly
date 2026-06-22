-- Дополнительные колонки и таблицы (идемпотентно)

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS admin_password_hash TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS site_title TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS favicon_base64 TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS deepseek_api_key TEXT;

CREATE TABLE IF NOT EXISTS balance_providers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  api_url         TEXT NOT NULL,
  panel_url       TEXT NOT NULL DEFAULT '',
  api_key         TEXT NOT NULL DEFAULT '',
  api_header_name TEXT NOT NULL DEFAULT 'Authorization',
  currency        TEXT NOT NULL DEFAULT 'RUB',
  threshold       NUMERIC NOT NULL DEFAULT 0,
  last_balance    NUMERIC,
  last_checked_at TIMESTAMPTZ,
  last_error      TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  extra_params    TEXT NOT NULL DEFAULT 'action=balance',
  response_type   TEXT NOT NULL DEFAULT 'json',
  response_path   TEXT NOT NULL DEFAULT 'balance',
  request_method  TEXT NOT NULL DEFAULT 'POST',
  key_param_name  TEXT NOT NULL DEFAULT 'key',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
