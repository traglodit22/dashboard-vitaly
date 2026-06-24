# Dashboard Vitaly

Next.js dashboard. Прод на VPS, разработка локально.

## Локально

```bash
cp .env.local.example .env.local
npm install
npm run db:setup
npm run dev
```

## Деплой

```bash
git add -A && git commit -m "..." && npm run deploy
```

- Прод: https://plansolo.ru
- GitHub: https://github.com/traglodit22/dashboard-vitaly (бэкап кода)
- Быстрый деплой: `npm run deploy:fast`

Контекст, доступы, логика продукта — `.local/CONTEXT.md` (не в git).

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Локальная разработка |
| `npm run deploy` | Деплой на VPS |
| `npm run deploy:fast` | Rsync + деплой, push в фоне |
| `npm run db:setup` | Локальная БД |
| `npm run db:tunnel` | Туннель к прод-БД (осторожно) |

## VPS

```bash
pm2 list
pm2 logs dashboard
```

Первичная настройка сервера: `deploy/setup-server.sh`
