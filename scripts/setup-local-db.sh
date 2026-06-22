#!/usr/bin/env bash
# Локальная PostgreSQL для разработки (macOS: brew install postgresql@16)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${DB_NAME:-dashboard_db}"
DB_USER="${DB_USER:-dashboard}"
DB_PASS="${DB_PASS:-dashboard}"

if ! command -v psql >/dev/null; then
  echo "PostgreSQL не найден. Установи: brew install postgresql@16 && brew services start postgresql@16"
  exit 1
fi

echo "==> База: $DB_NAME, пользователь: $DB_USER"

psql postgres -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || psql postgres -v ON_ERROR_STOP=1 -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

psql postgres -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || psql postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

psql "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT/src/lib/db/schema.sql"
psql "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT/src/lib/db/migrations/001_extras.sql"

psql postgres -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
psql "$DB_NAME" -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
echo ""
echo "Готово. Добавь в .env.local:"
echo "DATABASE_URL=$URL"
echo ""
echo "Запуск: npm run dev"
