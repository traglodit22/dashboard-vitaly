#!/usr/bin/env bash
# Запускай на Mac из корня репозитория:
#   bash scripts/prepare-cloud-secrets.sh
#
# Скрипт читает локальные gitignored-файлы и выводит инструкцию,
# что вставить в Cursor Dashboard → Cloud Agents → Secrets.
# Сами секреты в Dashboard добавляет только владелец аккаунта (API нет).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SSH_KEY="${HOME}/.ssh/id_ed25519"
CONTEXT_FILE="$ROOT/.local/CONTEXT.md"
ENV_FILE="$ROOT/.env.local"

echo "=============================================="
echo " Cursor Cloud Agents — подготовка секретов"
echo " https://cursor.com/dashboard → Cloud Agents → Secrets"
echo "=============================================="
echo ""

missing=0

if [[ -f "$SSH_KEY" ]]; then
  echo "✓ DEPLOY_SSH_PRIVATE_KEY (Runtime Secret)"
  echo "  Скопируй содержимое файла:"
  echo "  $SSH_KEY"
  echo ""
  if command -v pbcopy >/dev/null 2>&1; then
    read -r -p "  Скопировать SSH-ключ в буфер? [y/N] " ans
    if [[ "${ans,,}" == "y" ]]; then
      pbcopy < "$SSH_KEY"
      echo "  → SSH-ключ в буфере. Вставь в Secret DEPLOY_SSH_PRIVATE_KEY"
    fi
  fi
else
  echo "✗ DEPLOY_SSH_PRIVATE_KEY — файл не найден: $SSH_KEY"
  missing=$((missing + 1))
fi

echo ""

if [[ -f "$CONTEXT_FILE" ]]; then
  echo "✓ PROJECT_CONTEXT (Runtime Secret)"
  echo "  Файл: $CONTEXT_FILE ($(wc -c < "$CONTEXT_FILE" | tr -d ' ') байт)"
  if command -v pbcopy >/dev/null 2>&1; then
    read -r -p "  Скопировать CONTEXT.md в буфер? [y/N] " ans
    if [[ "${ans,,}" == "y" ]]; then
      pbcopy < "$CONTEXT_FILE"
      echo "  → CONTEXT в буфере. Вставь в Secret PROJECT_CONTEXT"
    fi
  fi
else
  echo "✗ PROJECT_CONTEXT — файл не найден: $CONTEXT_FILE"
  missing=$((missing + 1))
fi

echo ""

if [[ -f "$ENV_FILE" ]]; then
  echo "✓ ENV_LOCAL_CONTENT (Runtime Secret)"
  echo "  Файл: $ENV_FILE"
  if command -v pbcopy >/dev/null 2>&1; then
    read -r -p "  Скопировать .env.local в буфер? [y/N] " ans
    if [[ "${ans,,}" == "y" ]]; then
      pbcopy < "$ENV_FILE"
      echo "  → .env.local в буфере. Вставь в Secret ENV_LOCAL_CONTENT"
    fi
  fi
else
  echo "✗ ENV_LOCAL_CONTENT — файл не найден: $ENV_FILE"
  missing=$((missing + 1))
fi

echo ""
echo "Опционально (Environment Variable, не секретные):"
echo "  DEPLOY_HOST=135.106.161.215"
echo "  DEPLOY_USER=root"
echo "  DEPLOY_APP_DIR=/var/www/dashboard"
echo ""
echo "Сеть: в Cloud Environment разреши egress на 135.106.161.215:22"
echo "После добавления секретов — сохрани snapshot окружения."
echo ""

if [[ $missing -gt 0 ]]; then
  echo "Не хватает $missing файлов — проверь пути выше."
  exit 1
fi

echo "Готово."
