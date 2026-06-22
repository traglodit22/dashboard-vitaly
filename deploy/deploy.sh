#!/usr/bin/env bash
# Сборка и перезапуск на VPS. Вызывается из GitHub Actions или вручную на сервере.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> Install dependencies"
npm ci

echo "==> Database migrations"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null; then
  for f in src/lib/db/migrations/*.sql; do
    echo "    $f"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
else
  echo "    skip (no DATABASE_URL or psql)"
fi

echo "==> Build Next.js (standalone)"
npm run build

echo "==> Copy static assets into standalone bundle"
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/static

echo "==> Reload PM2 processes"
if pm2 describe dashboard >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.cjs --only dashboard --update-env
else
  pm2 start ecosystem.config.cjs --only dashboard
  pm2 save
fi

echo "==> Deploy finished"
