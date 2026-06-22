#!/usr/bin/env bash
# Сборка и перезапуск на VPS. Вызывается из GitHub Actions или вручную на сервере.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> Install dependencies"
npm ci

echo "==> Database migrations"
set +e
node scripts/run-migrations.mjs
migrate_rc=$?
set -e
if [[ $migrate_rc -ne 0 ]]; then
  echo "WARNING: migrations exited with code $migrate_rc (deploy continues)"
fi

echo "==> Build Next.js (standalone)"
npm run build

echo "==> Copy static assets into standalone bundle"
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/db
cp -r src/lib/db/migrations .next/standalone/db/migrations

echo "==> Reload PM2 processes"
if pm2 describe dashboard >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.cjs --only dashboard --update-env
else
  pm2 start ecosystem.config.cjs --only dashboard
  pm2 save
fi

echo "==> Database migrations (via running app)"
env_val() {
  local key="$1"
  [[ -f .env ]] || return 0
  grep -E "^${key}=" .env | head -1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//'
}
CRON_SECRET="$(env_val CRON_SECRET)"
if [[ -n "${CRON_SECRET:-}" ]]; then
  sleep 2
  curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
    "http://127.0.0.1:3000/api/cron/migrate-db" || \
    echo "WARNING: migrate-db request failed"
else
  echo "WARNING: CRON_SECRET not set, skip migrate-db"
fi

echo "==> Deploy finished"
