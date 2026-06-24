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
Mac → git push main → GitHub → Actions → VPS (135.106.161.215)
```

- Репозиторий: https://github.com/traglodit22/dashboard-vitaly
- Прод: https://plansolo.ru (также http://135.106.161.215)
- Деплой: автоматически при push в `main`

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Локальная разработка |
| `npm run db:setup` | Создать локальную БД |
| `npm run db:tunnel` | SSH-туннель к прод-БД |

## VPS

Стек: Node 22, PM2, nginx, PostgreSQL, privoxy (Telegram).

```bash
pm2 list
pm2 logs dashboard
```

Первичная настройка: `deploy/setup-server.sh`
