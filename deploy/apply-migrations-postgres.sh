#!/usr/bin/env bash
# Миграции, требующие владельца таблиц (system_settings у postgres).
# На VPS запускается из deploy.sh; локально — если есть sudo + postgres.
set -euo pipefail

APP_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
MIGRATIONS_DIR="$APP_DIR/src/lib/db/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "migrations dir not found: $MIGRATIONS_DIR"
  exit 0
fi

db_name() {
  local env_file="$APP_DIR/.env"
  [[ -f "$env_file" ]] || return 0
  local url
  url="$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//')"
  [[ -n "$url" ]] || return 0
  echo "$url" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|'
}

DB="$(db_name)"
if [[ -z "${DB:-}" ]]; then
  echo "skip postgres migrations (DATABASE_URL not found)"
  exit 0
fi

if ! command -v psql >/dev/null || ! id postgres >/dev/null 2>&1; then
  echo "skip postgres migrations (postgres user or psql missing)"
  exit 0
fi

for file in "$MIGRATIONS_DIR"/*.sql; do
  [[ -f "$file" ]] || continue
  echo "    postgres: $(basename "$file")"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$file"
done

echo "postgres migrations applied to $DB"
