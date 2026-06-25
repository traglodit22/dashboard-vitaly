CREATE TABLE IF NOT EXISTS vps_backup_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stamp           TEXT NOT NULL,
  database_key    TEXT,
  files_key       TEXT,
  database_bytes  BIGINT,
  files_bytes     BIGINT,
  status          TEXT NOT NULL DEFAULT 'ok',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vps_backup_runs_created_idx
  ON vps_backup_runs (created_at DESC);
