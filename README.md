# Dashboard Vitaly

Next.js dashboard + Telegram-бот. Прод на VPS, разработка локально.

## Быстрый старт (локально)

```bash
cp .env.local.example .env.local
npm install
npm run db:setup          # локальный Postgres
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## Локально + облако

```
┌─────────────┐    git push     ┌────────┐    SSH deploy    ┌─────────────────────┐
│  Mac (dev)  │ ──────────────► │ GitHub │ ───────────────► │ VPS 135.106.161.215 │
│ npm run dev │                 │  main  │                  │ PM2 + nginx + cron  │
│ .env.local  │                 └────────┘                  │ .env (прод)         │
└─────────────┘                                             └─────────────────────┘
```

| | Локально | VPS (прод) |
|--|----------|------------|
| Код | эта папка | `/var/www/dashboard` |
| Env | `.env.local` | `.env` |
| БД | `npm run db:setup` | PostgreSQL на сервере |
| Запуск | `npm run dev` | PM2 `dashboard` |
| Telegram proxy | не нужен | `TELEGRAM_PROXY_URL=127.0.0.1:8118` |

### БД: два режима

**Своя локальная** (безопасно):
```bash
npm run db:setup
```

**Туннель к проду** (реальные данные, осторожно):
```bash
npm run db:tunnel          # терминал 1
# в .env.local: DATABASE_URL=...@127.0.0.1:5433/...
npm run dev                # терминал 2
```

### GitHub + автодеплой

1. Создай пустой репозиторий на GitHub
2. Привяжи и запушь:
   ```bash
   ./scripts/link-github.sh YOUR_GITHUB_USER dashboard-vitaly
   ```
3. GitHub → Settings → Secrets → Actions:
   - `SSH_HOST` = `135.106.161.215`
   - `SSH_USER` = `root`
   - `SSH_PRIVATE_KEY` = приватный SSH-ключ
   - `APP_DIR` = `/var/www/dashboard`

После `git push origin main` — GitHub Actions деплоит на VPS.

## Прод (VPS)

Стек: Node 22, PM2, nginx, PostgreSQL, privoxy (Telegram).

```bash
pm2 status
pm2 logs dashboard
tail -f /var/log/dashboard-cron.log
```

Первичная настройка сервера: `deploy/setup-server.sh` (см. `deploy/`).
