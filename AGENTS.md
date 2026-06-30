<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a Next.js 16 (Turbopack, React 19) dashboard backed by PostgreSQL 16. Russian-language UI. There are no automated tests; `npm run lint` currently reports pre-existing errors in the repo (mostly `react-hooks/set-state-in-effect`), so lint failures are not necessarily caused by your changes.

The update script only runs `npm install`. The following are NOT done by the update script and must be handled per session/once:

- **Start PostgreSQL** (the cluster does not auto-start on boot): `sudo pg_ctlcluster 16 main start`. The local DB `dashboard_db` (user/pass `dashboard`/`dashboard`) and its schema/data persist in the VM snapshot.
- **`.env.local` is gitignored** and already present in the VM. If it is missing, copy `.env.local.example` to `.env.local` and set `DATABASE_URL=postgresql://dashboard:dashboard@127.0.0.1:5432/dashboard_db`, `SESSION_SECRET=local-dev-secret-change-me`, `HTTPS_ONLY=false`, `ADMIN_EMAIL=admin@localhost`. The app reads `.env.local` only; `.env` is for prod.
- **Local dev login**: `admin@localhost` / `dashboard123` (seeded in `dashboard_users`). To (re)seed: `DATABASE_URL=... ADMIN_EMAIL=admin@localhost node scripts/reset-dashboard-password.mjs admin@localhost dashboard123`. Passwords use bcrypt or legacy sha256; both are accepted by `verifyPassword`.
- **First-time DB setup** (only if the DB is empty): apply `src/lib/db/schema.sql` then every file in `src/lib/db/migrations/*.sql` in sorted order via `psql`. `scripts/setup-local-db.sh` assumes macOS/Homebrew, so on this Linux VM apply them with `psql` directly instead of `npm run db:setup`.

Run/lint/build commands are the standard ones in `package.json`: `npm run dev` (port 3000), `npm run lint`, `npm run build`. The `deploy:*` scripts target the production VPS — do not run them here.
