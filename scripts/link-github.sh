#!/usr/bin/env bash
# Привязка репозитория к GitHub и настройка автодеплоя на VPS.
#
# Использование:
#   ./scripts/link-github.sh YOUR_GITHUB_USER dashboard-vitaly
#
# Перед запуском создай пустой репозиторий на github.com (без README).
set -euo pipefail

GITHUB_USER="${1:-}"
REPO_NAME="${2:-dashboard-vitaly}"
VPS_HOST="${VPS_HOST:-135.106.161.215}"
VPS_APP_DIR="${VPS_APP_DIR:-/var/www/dashboard}"

if [[ -z "$GITHUB_USER" ]]; then
  echo "Использование: $0 <github-user> [repo-name]"
  exit 1
fi

REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
else
  git remote set-url origin "$REPO_URL"
fi

echo "==> Remote: $REPO_URL"
echo "==> Коммит и push (если есть изменения)..."
git add -A
if git diff --cached --quiet; then
  echo "Нет изменений для коммита"
else
  git commit -m "Setup local + cloud workflow"
fi

git push -u origin main 2>/dev/null || git push -u origin master 2>/dev/null || {
  echo ""
  echo "Push не удался. Создай репозиторий на GitHub и повтори:"
  echo "  git push -u origin main"
  exit 1
}

echo ""
echo "==> GitHub Secrets (Settings → Actions → Secrets):"
echo "  SSH_HOST=$VPS_HOST"
echo "  SSH_USER=root"
echo "  SSH_PRIVATE_KEY=<приватный ключ>"
echo "  APP_DIR=$VPS_APP_DIR"
echo ""
echo "==> На VPS привяжи тот же remote:"
echo "  ssh root@$VPS_HOST"
echo "  cd $VPS_APP_DIR && git remote set-url origin $REPO_URL"
echo ""
echo "Готово. Дальше: правки локально → git push → автодеплой на VPS."
