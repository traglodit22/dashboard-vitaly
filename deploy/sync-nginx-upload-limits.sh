#!/usr/bin/env bash
# Обновляет лимиты загрузки в существующем nginx-конфиге (не требует server_name).
set -euo pipefail

CONF="${1:-/etc/nginx/sites-available/dashboard}"
MAX_BODY="${2:-500M}"

if [[ ! -f "$CONF" ]]; then
  echo "nginx config not found: $CONF"
  exit 0
fi

tmp="$(mktemp)"
cp "$CONF" "$tmp"

if grep -q 'client_max_body_size' "$tmp"; then
  sed -i "s/client_max_body_size[[:space:]]*[^;]*;/client_max_body_size ${MAX_BODY};/" "$tmp"
else
  sed -i "/^[[:space:]]*server[[:space:]]*{/a\\    client_max_body_size ${MAX_BODY};" "$tmp"
fi

if grep -q 'client_body_timeout' "$tmp"; then
  sed -i 's/client_body_timeout[[:space:]]*[^;]*;/client_body_timeout 300s;/' "$tmp"
else
  sed -i "/client_max_body_size/a\\    client_body_timeout 300s;" "$tmp"
fi

if grep -q 'proxy_read_timeout' "$tmp"; then
  sed -i 's/proxy_read_timeout[[:space:]]*[^;]*;/proxy_read_timeout 300s;/' "$tmp"
else
  sed -i '/proxy_pass/a\        proxy_read_timeout 300s;' "$tmp"
fi

if grep -q 'proxy_send_timeout' "$tmp"; then
  sed -i 's/proxy_send_timeout[[:space:]]*[^;]*;/proxy_send_timeout 300s;/' "$tmp"
else
  sed -i '/proxy_read_timeout/a\        proxy_send_timeout 300s;' "$tmp"
fi

if ! cmp -s "$tmp" "$CONF"; then
  cp "$tmp" "$CONF"
  nginx -t
  systemctl reload nginx
  echo "nginx upload limits updated in $CONF"
else
  echo "nginx upload limits already up to date"
fi

rm -f "$tmp"
