<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Cloud Agent стартует из `.cursor/environment.json`. При каждом запуске выполняется `npm ci` и `.cursor/setup-cloud-secrets.sh`, который создаёт gitignored-файлы из Cursor Secrets.

### Secrets (cursor.com → Dashboard → Cloud Agents → Secrets)

| Secret | Тип | Назначение |
|--------|-----|------------|
| `DEPLOY_SSH_PRIVATE_KEY` | Runtime Secret | Приватный SSH-ключ для VPS (содержимое `~/.ssh/id_ed25519`) |
| `PROJECT_CONTEXT` | Runtime Secret | Текст `.local/CONTEXT.md` — доступы, логика продукта |
| `ENV_LOCAL_CONTENT` | Runtime Secret | Полное содержимое `.env.local` (удобнее, чем по одной переменной) |
| `DATABASE_URL` | Env var | Альтернатива: отдельные переменные для сборки |
| `SESSION_SECRET` | Env var | Сессии |
| `ANTHROPIC_API_KEY` | Runtime Secret | AI-функции |
| `TELEGRAM_BOT_TOKEN` | Runtime Secret | Бот |
| `DEPLOY_HOST` | Env var | По умолчанию `135.106.161.215` |
| `DEPLOY_USER` | Env var | По умолчанию `root` |
| `DEPLOY_APP_DIR` | Env var | По умолчанию `/var/www/dashboard` |

Скрипт создаёт:
- `.local/GITHUB_ACTIONS_SSH_PRIVATE_KEY` — ключ для `deploy/local-deploy.sh`
- `deploy/deploy.env.local` — хост и путь деплоя
- `.local/CONTEXT.md` — если задан `PROJECT_CONTEXT`
- `.env.local` — если задан `ENV_LOCAL_CONTENT` или `DATABASE_URL`

### Деплой из облака

1. Перед деплоем прочитай `.local/CONTEXT.md` (если есть).
2. Убедись, что `npm run build` проходит.
3. Закоммить и запушить изменения.
4. `npm run deploy:fast` работает только с ветки `main`. Для feature-веток: смержить PR в `main`, затем `git checkout main && git pull && npm run deploy:fast`.
5. Проверка: `ssh root@135.106.161.215 "cd /var/www/dashboard && git log -1 --oneline"`.
6. Прод: https://plansolo.ru

### Сеть

В настройках Cloud Environment разреши egress на `135.106.161.215:22` (SSH).

### Без SSH-секрета

Агент может писать код и открывать PR, но не деплоить на VPS. Сообщи пользователю, что нужно добавить `DEPLOY_SSH_PRIVATE_KEY` в Secrets.
