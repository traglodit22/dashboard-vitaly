#!/usr/bin/env bash
# Синхронизирует cron из репозитория и убирает устаревший дубликат в root crontab.
set -euo pipefail

APP_DIR="${1:-/var/www/dashboard}"

if [[ -f "$APP_DIR/deploy/cron-dashboard" ]] && [[ -d /etc/cron.d ]]; then
  chmod +x "$APP_DIR/deploy/cron-refresh-warehouse.sh" "$APP_DIR/deploy/cron-vps-backup.sh" 2>/dev/null || true
  cp "$APP_DIR/deploy/cron-dashboard" /etc/cron.d/dashboard
  chmod 644 /etc/cron.d/dashboard
  echo "cron.d/dashboard updated"
fi

if crontab -l >/dev/null 2>&1; then
  if crontab -l | grep -qE 'dashboard-cron\.sh|cron-refresh-warehouse\.sh'; then
    crontab -l | grep -vE 'dashboard-cron\.sh|cron-refresh-warehouse\.sh' | crontab -
    echo "removed legacy root crontab dashboard cron entry"
  fi
fi
