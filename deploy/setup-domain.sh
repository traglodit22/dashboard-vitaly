#!/usr/bin/env bash
# Настройка домена и SSL на уже работающем VPS.
# Запуск от root: bash deploy/setup-domain.sh [domain]
set -euo pipefail

DOMAIN="${1:-plansolo.ru}"
APP_DIR="${APP_DIR:-/var/www/dashboard}"
NGINX_CONF="/etc/nginx/sites-available/dashboard"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ $EUID -ne 0 ]]; then
  echo "Запусти от root: sudo bash deploy/setup-domain.sh [$DOMAIN]"
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "App dir not found: $APP_DIR"
  exit 1
fi

echo "==> DNS check for $DOMAIN"
resolved="$(dig +short "$DOMAIN" A | head -1)"
if [[ -z "$resolved" ]]; then
  echo "WARNING: $DOMAIN has no A record yet"
else
  echo "    $DOMAIN -> $resolved"
fi

echo "==> Nginx config"
mkdir -p /var/www/certbot
cp "$APP_DIR/deploy/nginx.conf" "$NGINX_CONF"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/dashboard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Certbot"
if ! command -v certbot >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq certbot python3-certbot-nginx
fi

certbot_args=(--nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --agree-tos --non-interactive)
if [[ -n "$CERTBOT_EMAIL" ]]; then
  certbot_args+=(--email "$CERTBOT_EMAIL")
else
  certbot_args+=(--register-unsafely-without-email)
fi

if certbot "${certbot_args[@]}"; then
  echo "==> SSL installed"
else
  echo "WARNING: certbot failed — HTTP still works on port 80"
fi

echo "==> HTTPS_ONLY in .env"
ENV_FILE="$APP_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^HTTPS_ONLY=' "$ENV_FILE"; then
    sed -i 's/^HTTPS_ONLY=.*/HTTPS_ONLY=true/' "$ENV_FILE"
  else
    echo 'HTTPS_ONLY=true' >> "$ENV_FILE"
  fi
  if grep -q '^GCS_CORS_ORIGINS=' "$ENV_FILE"; then
    sed -i 's|^GCS_CORS_ORIGINS=.*|GCS_CORS_ORIGINS=https://plansolo.ru,https://www.plansolo.ru,http://135.106.161.215,https://135.106.161.215|' "$ENV_FILE"
  else
    echo 'GCS_CORS_ORIGINS=https://plansolo.ru,https://www.plansolo.ru,http://135.106.161.215,https://135.106.161.215' >> "$ENV_FILE"
  fi
fi

echo "==> Restart app"
if command -v pm2 >/dev/null; then
  cd "$APP_DIR"
  pm2 start ecosystem.config.cjs --only dashboard --update-env 2>/dev/null || \
    pm2 restart dashboard --update-env 2>/dev/null || true
  pm2 save 2>/dev/null || true
fi

echo "==> GCS CORS"
if [[ -f "$ENV_FILE" ]] && grep -qE '^GCS_BUCKET=' "$ENV_FILE"; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  (cd "$APP_DIR" && node scripts/configure-gcs-cors.mjs) || true
fi

echo ""
echo "Готово. Проверь:"
echo "  https://$DOMAIN/login"
echo "  https://www.$DOMAIN/login"
