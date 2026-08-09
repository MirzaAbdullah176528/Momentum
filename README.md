# Momentum

A task/habit tracker that computes a daily 0.0–10.0 rating from logged tasks.

## Stack

- **Turborepo** monorepo, npm workspaces
- `apps/web` — Next.js (App Router), Vercel
- `apps/api` — Hono on Cloudflare Workers (D1)
- `packages/db` — Drizzle ORM for Cloudflare D1
- `packages/shared-types` — shared TS DTOs
- `packages/rating-engine` — pure rating math + PKT date utils
- `packages/config` — shared TS + ESLint config
- Auth seam (Better-Auth) reserved for a later phase
- UI: Tailwind + shadcn/ui, dark-mode-only "Liquid Glass"

## Getting started

```bash
npm install
npm run build
npm run lint
npm test
```

### Local API with D1 emulation

```bash
cd apps/api
npx wrangler d1 create momentum-local
# paste the database_id into wrangler.toml [env.local] block
npx wrangler d1 migrations apply momentum-local --local
npm run dev
```

## Rating math (summary)

- **Task Score** = `(actual / target) * weight`, capped at `weight`. `actual <= 0` or `null` → `0`.
- **Daily Rating** = `(Σ task_score / Σ weight) * 10`, range `0.0–10.0`. Empty day → `0.0`.
- **Season Rating** = straight average of daily ratings across active days
  (weekdays only if `weekdaysOnly=true`). Missed day → `0.0`.
- All date math is PKT (`Asia/Karachi`, UTC+5, no DST).
