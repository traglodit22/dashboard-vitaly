#!/usr/bin/env bash
# Сборка и перезапуск на VPS. Вызывается из GitHub Actions или вручную на сервере.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> Install dependencies"
npm ci

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
