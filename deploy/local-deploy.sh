#!/usr/bin/env bash
# Быстрый деплой с Mac напрямую на VPS (без ожидания GitHub Actions).
# GitHub — бэкап кода: push делается до или после деплоя.
#
# Использование:
#   npm run deploy              # git push + SSH pull + deploy.sh
#   npm run deploy:fast         # rsync + deploy.sh, push в GitHub в фоне
#   bash deploy/local-deploy.sh --no-backup   # только VPS, без push
#   bash deploy/local-deploy.sh --backup-only # только push в GitHub
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Cursor Cloud Agent: секреты → .local/ перед деплоем
if [[ ! -f "$ROOT/.local/GITHUB_ACTIONS_SSH_PRIVATE_KEY" ]] \
  && [[ -n "${DEPLOY_SSH_PRIVATE_KEY:-}" || -n "${SSH_PRIVATE_KEY:-}" ]]; then
  bash "$ROOT/deploy/setup-cloud-secrets.sh"
fi

MODE="git"
BACKUP_GIT=true
BACKUP_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --fast) MODE="rsync" ;;
    --no-backup) BACKUP_GIT=false ;;
    --backup-only) BACKUP_ONLY=true ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Неизвестный аргумент: $arg (см. --help)"
      exit 1
      ;;
  esac
done

# deploy/deploy.env.local или .local/deploy.env (gitignored)
for env_file in "$ROOT/deploy/deploy.env.local" "$ROOT/.local/deploy.env"; do
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    source "$env_file"
    break
  fi
done

DEPLOY_HOST="${DEPLOY_HOST:-135.106.161.215}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_APP_DIR="${DEPLOY_APP_DIR:-/var/www/dashboard}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -p "$DEPLOY_PORT")
if [[ -n "${DEPLOY_KEY:-}" && -f "${DEPLOY_KEY}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_KEY")
elif [[ -f "$ROOT/.local/GITHUB_ACTIONS_SSH_PRIVATE_KEY" ]]; then
  SSH_OPTS+=(-i "$ROOT/.local/GITHUB_ACTIONS_SSH_PRIVATE_KEY")
fi

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"

remote_deploy() {
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s -- "$DEPLOY_APP_DIR" <<'REMOTE'
set -euo pipefail
APP_DIR="$1"
cd "$APP_DIR"
git fetch origin main
git checkout main 2>/dev/null || git checkout -B main origin/main
git reset --hard origin/main
bash deploy/deploy.sh
REMOTE
}

git_backup_push() {
  echo "==> Бэкап в GitHub (origin main)"
  git push origin main
}

if $BACKUP_ONLY; then
  git_backup_push
  echo "Готово: только push в GitHub."
  exit 0
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  echo "ERROR: деплой только с ветки main (сейчас: $branch)"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: есть незакоммиченные изменения. Закоммить или git stash."
  git status --short
  exit 1
fi

if ! $BACKUP_GIT && [[ "$MODE" == "git" ]]; then
  echo "ERROR: режим git требует push в GitHub. Используй --fast или убери --no-backup."
  exit 1
fi

echo "==> Деплой на $SSH_TARGET:$DEPLOY_APP_DIR"

if [[ "$MODE" == "rsync" ]]; then
  echo "==> Rsync на сервер"
  RSYNC_SSH="ssh ${SSH_OPTS[*]}"
  rsync -az --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude runtime \
    --exclude uploads \
    --exclude .git \
    --exclude .local \
    --exclude .env \
    --exclude .env.local \
    --exclude .deploy.lock \
    -e "$RSYNC_SSH" \
    ./ "${SSH_TARGET}:${DEPLOY_APP_DIR}/"

  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "cd '$DEPLOY_APP_DIR' && bash deploy/deploy.sh"

  if $BACKUP_GIT; then
    (git_backup_push && echo "==> Бэкап в GitHub завершён") &
    echo "==> Push в GitHub запущен в фоне"
  fi
else
  if $BACKUP_GIT; then
    git_backup_push
  fi
  remote_deploy
fi

echo ""
echo "Готово: https://plansolo.ru"
