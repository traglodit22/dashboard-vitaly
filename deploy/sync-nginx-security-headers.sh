#!/usr/bin/env bash
# Добавляет security-заголовки в nginx (в location / и HSTS на HTTPS-блок).
set -euo pipefail

CONF="${1:-/etc/nginx/sites-available/dashboard}"

if [[ ! -f "$CONF" ]]; then
  echo "nginx config not found: $CONF"
  exit 0
fi

tmp="$(mktemp)"
cp "$CONF" "$tmp"

LOCATION_HEADERS='        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;'

if ! grep -q 'X-Frame-Options' "$tmp"; then
  awk -v headers="$LOCATION_HEADERS" '
    /location \/ \{/ { in_loc=1 }
    in_loc && /proxy_pass/ && !done {
      print
      print headers
      done=1
      next
    }
    { print }
  ' "$tmp" > "${tmp}.new" && mv "${tmp}.new" "$tmp"
fi

if ! grep -q 'Strict-Transport-Security' "$tmp"; then
  awk '
    /listen[[:space:]]+443/ && !done {
      print
      print "    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;"
      done=1
      next
    }
    { print }
  ' "$tmp" > "${tmp}.new" && mv "${tmp}.new" "$tmp"
fi

if ! cmp -s "$tmp" "$CONF"; then
  cp "$tmp" "$CONF"
  nginx -t
  systemctl reload nginx
  echo "nginx security headers updated in $CONF"
else
  echo "nginx security headers already up to date"
fi

rm -f "$tmp"
