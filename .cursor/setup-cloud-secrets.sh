#!/usr/bin/env bash
# Подготовка gitignored-файлов для Cloud Agent из Cursor Secrets.
# Секреты задаются в cursor.com → Dashboard → Cloud Agents → Secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="$ROOT/.local"
mkdir -p "$LOCAL_DIR"

write_ssh_key() {
  if [[ -z "${DEPLOY_SSH_PRIVATE_KEY:-}" ]]; then
    echo "Cloud setup: DEPLOY_SSH_PRIVATE_KEY не задан — SSH-деплой на VPS недоступен"
    return 0
  fi

  local key_file="$LOCAL_DIR/GITHUB_ACTIONS_SSH_PRIVATE_KEY"
  printf '%s\n' "$DEPLOY_SSH_PRIVATE_KEY" > "$key_file"
  chmod 600 "$key_file"
  echo "Cloud setup: SSH-ключ для деплоя записан в .local/GITHUB_ACTIONS_SSH_PRIVATE_KEY"
}

write_deploy_env() {
  local deploy_env="$ROOT/deploy/deploy.env.local"
  [[ -f "$deploy_env" ]] && return 0

  cat > "$deploy_env" <<EOF
DEPLOY_HOST=${DEPLOY_HOST:-135.106.161.215}
DEPLOY_USER=${DEPLOY_USER:-root}
DEPLOY_APP_DIR=${DEPLOY_APP_DIR:-/var/www/dashboard}
DEPLOY_PORT=${DEPLOY_PORT:-22}
EOF

  if [[ -f "$LOCAL_DIR/GITHUB_ACTIONS_SSH_PRIVATE_KEY" ]]; then
    echo "DEPLOY_KEY=$LOCAL_DIR/GITHUB_ACTIONS_SSH_PRIVATE_KEY" >> "$deploy_env"
  fi

  echo "Cloud setup: deploy/deploy.env.local создан"
}

write_project_context() {
  if [[ -z "${PROJECT_CONTEXT:-}" ]]; then
    return 0
  fi

  printf '%s\n' "$PROJECT_CONTEXT" > "$LOCAL_DIR/CONTEXT.md"
  echo "Cloud setup: .local/CONTEXT.md записан из PROJECT_CONTEXT"
}

write_env_local() {
  if [[ -f "$ROOT/.env.local" ]]; then
    return 0
  fi

  if [[ -n "${ENV_LOCAL_CONTENT:-}" ]]; then
    printf '%s\n' "$ENV_LOCAL_CONTENT" > "$ROOT/.env.local"
    echo "Cloud setup: .env.local записан из ENV_LOCAL_CONTENT"
    return 0
  fi

  # Минимальный .env.local для сборки, если заданы отдельные секреты
  if [[ -n "${DATABASE_URL:-}" || -n "${SESSION_SECRET:-}" ]]; then
    cat > "$ROOT/.env.local" <<EOF
DATABASE_URL=${DATABASE_URL:-postgresql://dashboard:dashboard@127.0.0.1:5432/dashboard_db}
SESSION_SECRET=${SESSION_SECRET:-cloud-agent-dev-secret}
HTTPS_ONLY=${HTTPS_ONLY:-false}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@localhost}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_ALLOWED_USER_IDS=${TELEGRAM_ALLOWED_USER_IDS:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
DOBROPOST_API_URL=${DOBROPOST_API_URL:-https://api.dobropost.com}
DOBROPOST_EMAIL=${DOBROPOST_EMAIL:-}
DOBROPOST_PASSWORD=${DOBROPOST_PASSWORD:-}
DOBROPOST_WEBHOOK_SECRET=${DOBROPOST_WEBHOOK_SECRET:-}
LAS_LEGAS_API_URL=${LAS_LEGAS_API_URL:-https://las-legas.by/api/integrations/dashboard/stats}
LAS_LEGAS_API_KEY=${LAS_LEGAS_API_KEY:-}
EOF
    echo "Cloud setup: .env.local собран из отдельных секретов"
  fi
}

write_ssh_key
write_deploy_env
write_project_context
write_env_local
