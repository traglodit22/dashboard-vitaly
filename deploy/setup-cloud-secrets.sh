#!/usr/bin/env bash
# Материализует Cursor Secrets в .local/ для SSH-деплоя из Cloud Agent.
# Секреты: DEPLOY_SSH_PRIVATE_KEY, DEPLOY_HOST, DEPLOY_USER, DEPLOY_APP_DIR, DEPLOY_PORT
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="$ROOT/.local"

mkdir -p "$LOCAL_DIR"
chmod 700 "$LOCAL_DIR"

KEY_FILE="$LOCAL_DIR/GITHUB_ACTIONS_SSH_PRIVATE_KEY"
KEY_VALUE="${DEPLOY_SSH_PRIVATE_KEY:-${SSH_PRIVATE_KEY:-}}"
if [[ -n "$KEY_VALUE" ]]; then
  printf '%s\n' "$KEY_VALUE" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  echo "==> SSH key: $KEY_FILE"
elif [[ -f "$KEY_FILE" ]]; then
  echo "==> SSH key already present: $KEY_FILE"
else
  echo "WARN: DEPLOY_SSH_PRIVATE_KEY / SSH_PRIVATE_KEY not set and $KEY_FILE missing"
fi

DEPLOY_HOST="${DEPLOY_HOST:-${SSH_HOST:-}}"
DEPLOY_USER="${DEPLOY_USER:-${SSH_USER:-}}"
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-}"
DEPLOY_PORT="${DEPLOY_PORT:-${SSH_PORT:-}}"

if [[ -n "$DEPLOY_HOST" || -n "$DEPLOY_USER" || -n "$DEPLOY_APP_DIR" || -n "$DEPLOY_PORT" ]]; then
  cat >"$LOCAL_DIR/deploy.env" <<EOF
DEPLOY_HOST=${DEPLOY_HOST:-135.106.161.215}
DEPLOY_USER=${DEPLOY_USER:-root}
DEPLOY_APP_DIR=${DEPLOY_APP_DIR:-/var/www/dashboard}
DEPLOY_PORT=${DEPLOY_PORT:-22}
EOF
  chmod 600 "$LOCAL_DIR/deploy.env"
  echo "==> Deploy env: $LOCAL_DIR/deploy.env"
fi
