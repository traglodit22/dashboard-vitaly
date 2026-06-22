#!/usr/bin/env bash
# SSH-туннель к прод-БД на VPS. Осторожно: локальные правки бьют по проду!
#
# Использование:
#   ./scripts/db-tunnel.sh          # порт 5433 → VPS Postgres
#   DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5433/dashboard_db npm run dev
set -euo pipefail

VPS_HOST="${VPS_HOST:-135.106.161.215}"
VPS_USER="${VPS_USER:-root}"
LOCAL_PORT="${LOCAL_PORT:-5433}"
REMOTE_PORT="${REMOTE_PORT:-5432}"

echo "Туннель: localhost:$LOCAL_PORT → $VPS_HOST:$REMOTE_PORT"
echo "Ctrl+C чтобы закрыть"
echo ""

exec ssh -N -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" "${VPS_USER}@${VPS_HOST}"
