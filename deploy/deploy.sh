#!/usr/bin/env bash
# Сборка и перезапуск на VPS. Вызывается из GitHub Actions или вручную на сервере.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

RUNTIME="$APP_DIR/runtime/current"
RUNTIME_NEW="$APP_DIR/runtime/current.new"
# Backup outside the repo so `next build` typecheck never scans old bundles.
RUNTIME_BAK="$(dirname "$APP_DIR")/dashboard-runtime.bak"
LOCK_FILE="$APP_DIR/.deploy.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "ERROR: another deploy is already running"
  exit 1
fi

rollback_runtime() {
  if [[ -d "$RUNTIME_BAK" ]]; then
    echo "==> Rollback: restoring previous runtime"
    rm -rf "$RUNTIME"
    mv "$RUNTIME_BAK" "$RUNTIME"
  fi
  if pm2 describe dashboard >/dev/null 2>&1; then
    pm2 restart dashboard --update-env || true
  elif [[ -f "$RUNTIME/server.js" ]]; then
    pm2 delete dashboard 2>/dev/null || true
    pm2 start ecosystem.config.cjs --only dashboard --update-env || true
    pm2 save || true
  fi
}

verify_bundle() {
  local dir="$1"
  [[ -f "$dir/server.js" ]] || return 1
  [[ -f "$dir/.next/server/middleware-manifest.json" ]] || return 1
  return 0
}

trap 'echo "DEPLOY FAILED"; rollback_runtime' ERR

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
mkdir -p uploads/procurement uploads/files runtime

# One-time / recovery: serve from runtime/current (PM2 cwd), not .next/standalone
if [[ ! -d "$RUNTIME" && -f .next/standalone/server.js ]]; then
  echo "==> Bootstrap runtime from existing standalone"
  mkdir -p "$RUNTIME"
  rsync -a .next/standalone/ "$RUNTIME/"
fi

if [[ -d "$RUNTIME" ]]; then
  echo "==> Backup current runtime (app keeps serving during build)"
  rm -rf "$RUNTIME_BAK"
  cp -a "$RUNTIME" "$RUNTIME_BAK"
fi

echo "==> Build Next.js (standalone) in .next/ — runtime untouched"
npm run build

echo "==> Stage new runtime bundle"
rm -rf "$RUNTIME_NEW"
mkdir -p "$RUNTIME_NEW"
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/db
cp -r src/lib/db/migrations .next/standalone/db/migrations
rsync -a .next/standalone/ "$RUNTIME_NEW/"
# Drop stray copies from older broken deploys (must not land in runtime).
rm -rf "$RUNTIME_NEW/src" "$RUNTIME_NEW/runtime"

bash scripts/stage-pdfjs-assets.sh "$RUNTIME_NEW/node_modules/pdfjs-dist"

if ! verify_bundle "$RUNTIME_NEW"; then
  echo "ERROR: incomplete standalone bundle"
  exit 1
fi

echo "==> Swap runtime (atomic)"
if [[ -d "$RUNTIME" ]]; then
  rm -rf "$RUNTIME_BAK"
  mv "$RUNTIME" "$RUNTIME_BAK"
fi
mv "$RUNTIME_NEW" "$RUNTIME"

echo "==> Start PM2"
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

rm -rf "$RUNTIME_BAK"
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

echo "==> GCS bucket CORS (direct browser upload)"
if grep -qE '^GCS_BUCKET=' .env 2>/dev/null; then
  set +e
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  node scripts/configure-gcs-cors.mjs
  cors_rc=$?
  set -e
  if [[ $cors_rc -ne 0 ]]; then
    echo "WARNING: GCS CORS setup exited with code $cors_rc"
  fi
fi

if [[ -f /etc/nginx/sites-available/dashboard ]] && [[ -f deploy/sync-nginx-upload-limits.sh ]]; then
  echo "==> Sync nginx upload limits"
  bash deploy/sync-nginx-upload-limits.sh /etc/nginx/sites-available/dashboard 50M
fi

if [[ -f /etc/nginx/sites-available/dashboard ]] && [[ -f deploy/sync-nginx-security-headers.sh ]]; then
  echo "==> Sync nginx security headers"
  bash deploy/sync-nginx-security-headers.sh /etc/nginx/sites-available/dashboard
fi

echo "==> Deploy finished"
