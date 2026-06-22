#!/usr/bin/env bash
# Вызов cron-эндпоинта с сервера. Логи: /var/log/dashboard-cron.log
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dashboard}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
LOG_FILE="${LOG_FILE:-/var/log/dashboard-cron.log}"
PORT="${PORT:-3000}"

log() {
  echo "$(date -Iseconds) $*" >> "$LOG_FILE"
}

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR: missing $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
  log "ERROR: CRON_SECRET is not set in $ENV_FILE"
  exit 1
fi

response=$(curl -sS -w "\n%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://127.0.0.1:${PORT}/api/cron/refresh-warehouse") || {
  log "ERROR: curl failed"
  exit 1
}

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" =~ ^2 ]]; then
  log "OK ($http_code) $body"
else
  log "FAIL ($http_code) $body"
  exit 1
fi
