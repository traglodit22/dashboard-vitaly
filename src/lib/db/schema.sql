CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_description     TEXT NOT NULL,
  number_of_item_pieces INTEGER NOT NULL,
  item_price           NUMERIC NOT NULL,
  item_store_link      TEXT NOT NULL,
  store                TEXT NOT NULL,
  incoming_declaration TEXT,
  total_amount         NUMERIC NOT NULL,
  status               TEXT NOT NULL DEFAULT 'awaiting_track',
  recipient_id         UUID,
  dp_shipment_id       INTEGER,
  dp_track_number      TEXT,
  dp_status_id         INTEGER,
  dp_status_name       TEXT,
  dp_weight_kg         NUMERIC,
  last_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name          TEXT NOT NULL,
  name                 TEXT NOT NULL,
  middle_name          TEXT,
  passport_serial      TEXT NOT NULL,
  passport_number      TEXT NOT NULL,
  passport_issue_date  TEXT NOT NULL,
  birth_date           TEXT,
  inn                  TEXT NOT NULL,
  full_address         TEXT NOT NULL,
  city                 TEXT NOT NULL,
  state                TEXT NOT NULL,
  zip_code             TEXT NOT NULL,
  phone_number         TEXT NOT NULL,
  email                TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT '',
  hourly_rate    NUMERIC NOT NULL DEFAULT 0,
  tracker_email  TEXT NOT NULL,
  telegram_id    TEXT,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_records (
  id           TEXT PRIMARY KEY,
  employee_id  UUID NOT NULL,
  month        TEXT NOT NULL,
  hours        NUMERIC NOT NULL DEFAULT 0,
  hourly_rate  NUMERIC NOT NULL DEFAULT 0,
  bonuses      NUMERIC NOT NULL DEFAULT 0,
  deductions   NUMERIC NOT NULL DEFAULT 0,
  total        NUMERIC NOT NULL DEFAULT 0,
  paid         BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at      TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id                            INTEGER PRIMARY KEY,
  dobropost_email               TEXT,
  dobropost_password            TEXT,
  dobropost_token               TEXT,
  dobropost_token_expires_at    BIGINT,
  auto_check_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  auto_check_interval_hours     INTEGER NOT NULL DEFAULT 12,
  auto_check_last_run_at        TIMESTAMPTZ,
  telegram_notify_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_notify_chat_ids      TEXT[] NOT NULL DEFAULT '{}',
  recipient_rotation_index      INTEGER NOT NULL DEFAULT 0,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS telegram_messages (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    BIGINT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_messages_chat_id_idx ON telegram_messages (chat_id, created_at);
