#!/usr/bin/env bash
# Сборка и перезапуск на VPS. Вызывается из GitHub Actions или вручную на сервере.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

rollback_standalone() {
  if [[ -d .next/standalone.bak ]]; then
    echo "==> Rollback: restoring previous standalone bundle"
    rm -rf .next/standalone
    mv .next/standalone.bak .next/standalone
  fi
  if pm2 describe dashboard >/dev/null 2>&1; then
    pm2 restart dashboard --update-env || true
  elif [[ -f .next/standalone/server.js ]]; then
    pm2 start ecosystem.config.cjs --only dashboard --update-env || true
    pm2 save || true
  fi
}

trap 'echo "DEPLOY FAILED"; rollback_standalone' ERR

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

echo "==> Ensure upload directories"
mkdir -p uploads/procurement

if [[ -f .next/standalone/server.js ]]; then
  echo "==> Backup current standalone (for rollback)"
  rm -rf .next/standalone.bak
  cp -a .next/standalone .next/standalone.bak
fi

echo "==> Build Next.js (standalone) — app keeps running until build succeeds"
npm run build

echo "==> Copy static assets into standalone bundle"
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/db
cp -r src/lib/db/migrations .next/standalone/db/migrations

echo "==> Start PM2 (fresh — ensures standalone server.js, not next start)"
pm2 delete dashboard 2>/dev/null || true
pm2 start ecosystem.config.cjs --only dashboard --update-env
pm2 save

echo "==> Health check"
for i in $(seq 1 15); do
  code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/auth/me || true)"
  if [[ "$code" == "401" || "$code" == "200" ]]; then
    echo "App is up (HTTP $code)"
    break
  fi
  if [[ "$i" -eq 15 ]]; then
    echo "ERROR: app did not become healthy"
    pm2 logs dashboard --lines 30 --nostream || true
    exit 1
  fi
  sleep 2
done

rm -rf .next/standalone.bak
trap - ERR

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
