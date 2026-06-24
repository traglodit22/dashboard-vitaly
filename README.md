# Dashboard Vitaly

Next.js dashboard. Прод на VPS, разработка локально, синхронизация через GitHub.

## Локально

```bash
cp .env.local.example .env.local
npm install
npm run db:setup    # локальный Postgres
npm run dev
```

## Синхронизация с продом

```
Mac → npm run deploy → VPS (сразу)
         └─ git push → GitHub (бэкап кода)
```

- Репозиторий: https://github.com/traglodit22/dashboard-vitaly
- Прод: https://plansolo.ru
- **Деплой:** `npm run deploy` с Mac (прямой SSH, без ожидания Actions)
- **Быстрее:** `npm run deploy:fast` — rsync + деплой, push в GitHub в фоне
- GitHub Actions: только ручной запуск (резервный путь)

Первый раз: скопируй `deploy/deploy.env.example` → `deploy/deploy.env.local`, настрой SSH-ключ.

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Локальная разработка |
| `npm run deploy` | Деплой на VPS (push + SSH) |
| `npm run deploy:fast` | Rsync на VPS, push в GitHub в фоне |
| `npm run db:setup` | Создать локальную БД |
| `npm run db:tunnel` | SSH-туннель к прод-БД |

## VPS

Стек: Node 22, PM2, nginx, PostgreSQL, privoxy (Telegram).

```bash
pm2 list
pm2 logs dashboard
```

Первичная настройка: `deploy/setup-server.sh`
