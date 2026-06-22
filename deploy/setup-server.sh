#!/usr/bin/env bash
# Однократная настройка VPS (Ubuntu/Debian). Запускать от root:
#   curl -fsSL ... | bash
# или:
#   bash deploy/setup-server.sh https://github.com/USER/REPO.git your.domain.com
set -euo pipefail

REPO_URL="${1:-}"
DOMAIN="${2:-_}"
APP_DIR="/var/www/dashboard"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

if [[ $EUID -ne 0 ]]; then
  echo "Запусти от root: sudo bash deploy/setup-server.sh <git-url> [domain]"
  exit 1
fi

if [[ -z "$REPO_URL" ]]; then
  echo "Использование: bash deploy/setup-server.sh <git-url> [domain]"
  exit 1
fi

echo "==> System packages"
apt-get update -qq
apt-get install -y -qq git curl nginx ufw

echo "==> Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

echo "==> PM2"
npm install -g pm2
sudo -u "$DEPLOY_USER" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" 2>/dev/null | grep -v 'sudo env' | bash || true

echo "==> Deploy user (для GitHub Actions SSH)"
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
usermod -aG www-data "$DEPLOY_USER" 2>/dev/null || true

echo "==> App directory"
mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
else
  echo "Репозиторий уже есть в $APP_DIR — пропускаю clone"
fi

chmod +x "$APP_DIR/deploy/deploy.sh" "$APP_DIR/deploy/cron-refresh-warehouse.sh" 2>/dev/null || true

echo "==> Nginx"
sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/dashboard
ln -sf /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/dashboard
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Cron (складские статусы каждые 6 ч)"
cp "$APP_DIR/deploy/cron-dashboard" /etc/cron.d/dashboard
chmod 644 /etc/cron.d/dashboard

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

cat <<EOF

Готово. Дальше вручную:

1. Создай $APP_DIR/.env (см. .env.local.example)
2. Первый деплой:
     cd $APP_DIR && sudo -u $DEPLOY_USER bash deploy/deploy.sh
3. Добавь SSH-ключ для GitHub Actions (от root на сервере):
     ssh-keygen -t ed25519 -C github-actions -f /root/.ssh/github_actions -N ""
     mkdir -p /home/$DEPLOY_USER/.ssh
     cat /root/.ssh/github_actions.pub >> /home/$DEPLOY_USER/.ssh/authorized_keys
     chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
     chmod 700 /home/$DEPLOY_USER/.ssh
     chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
     # приватный ключ → GitHub Secrets → SSH_PRIVATE_KEY
4. GitHub Secrets:
     SSH_HOST=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
     SSH_USER=$DEPLOY_USER
     SSH_PRIVATE_KEY=<содержимое /root/.ssh/github_actions>
     APP_DIR=$APP_DIR

EOF
