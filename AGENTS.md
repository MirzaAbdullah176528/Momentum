# Momentum — Repository Notes

## Architecture
- Monorepo (Turborepo): `apps/api` (Hono/Workers + D1), `apps/web` (Next.js/Tailwind, "Liquid Glass" dark UI), `packages/db` (Drizzle schema + scoped.ts), `packages/rating-engine`, `packages/shared-types`.
- Auth: Better-Auth. `requireEmailVerification: false` in local, `autoSignIn: true`. CSRF middleware only checks `Origin` header is in allowed set (no token). Auth routes under `/api/auth/*`.
- API build uses esbuild via wrangler dry-run (does NOT typecheck). `npx tsc --noEmit` shows pre-existing `Context<AppContext,...> not assignable to AppContext` errors across ALL route files (http.ts, analytics.ts, leaderboard.ts, seasons.ts, tasks.ts) — these are pre-existing and do NOT block the wrangler build.

## Commands
- Build all: `npx turbo run build`
- Lint all: `npx turbo run lint`
- Test: `npx turbo run test` (rating-engine uses vitest)
- Local D1 apply migrations: `npx wrangler d1 migrations apply momentum-local --local` (run from apps/api)
- Run D1 query: `npx wrangler d1 execute momentum-local --local --command "..."`
- Dev API: `npx wrangler dev --port 8787` (from apps/api)

## Season / Challenge design (current)
- A season = 28-day (4-week) challenge the user explicitly starts via "Start Challenge". NOT calendar-month aligned.
- `season.includedDays`: 7-bit bitmask, bit N (0=Sun..6=Sat, matching JS `getDay()`) set => day counts. Excluded days never count in averages (not even as 0). `INCLUDED_DAYS_ALL=127`, `INCLUDED_DAYS_MON_FRI=62`.
- Legacy `weekdays_only` migrated: true→62 (Mon-Fri), false→127 (all). Migration `0001_challenge_season.sql`.
- Start-date resolution (`resolveChallengeStartDate` in rating-engine/season-challenge.ts): earliest scheduled_start today; if upcoming OR passed ≤1h ago → start today; if passed >1h ago OR no tasks today → start tomorrow. endDate = start+27d.
- Tables: `season_weekly_reward` (week 1-4, target_rating+reward_text, immutable after start — no edit endpoint), `season_final_goal` (text+completed, standalone checklist, CRUD anytime).
- Week N range: [start+7(N-1), start+7N-1]. Week "concluded" once now > end of week's last PKT day. Until then status=`in_progress`.
- Reward indicators: 5-cell row (Week1-4 + Overall), green when average≥target AND concluded.

## Task immutability + first-day-of-season edit exception
- Tasks are immutable after creation for `targetValue`, `unit`, `importanceWeight` (the only locked fields that exist in this codebase — there is NO `scaleType` field anywhere; if a prompt mentions it, it doesn't apply here).
- EXCEPTION: on the first day of the user's active season — i.e. when `todayPkt === currentSeason.startDate` — those three fields become editable for that one day. Implemented as a QUERY-TIME check in the PATCH /api/tasks/:id handler (no stored flag), so it auto-closes at midnight PKT.
- API impl: `updateTaskSchemaLocked` (locked fields = `z.never()` → sending one yields 403 "immutable", matching the original contract) vs `updateTaskSchemaUnlocked` (locked fields accept real validators + persist). Schema is chosen per-request after looking up `scoped.currentSeason(todayPkt)`.
- `UpdateTaskInputDTO` now includes optional `targetValue/unit/importanceWeight`. `TaskUpdateInput` in db/scoped.ts no longer omits them, so `scoped.updateTask` persists them.
- `CurrentSeasonDTO.canEditLockedFields` (bool) is computed in seasons `/current` as `season.startDate === todayPkt`; web `TaskModal` takes a `canEditLockedFields` prop and unlocks the inputs + sends the fields on PATCH when editing.
- Verification: `scripts/verify-day1-unlock.sh` (needs `wrangler dev` on 8787 + the local D1 sqlite path; manipulates season start_date directly to force day-1 vs day-2 vs no-season). 16/16 checks pass.

## Task units
- `TASK_UNITS` lives in BOTH `packages/shared-types/src/index.ts` (source of truth for API Zod validation + web dropdown) AND `packages/db/src/schema.ts` (Drizzle check constraint `task_unit_valid`). Keep both in sync — there is no single shared constant between them.
- Values: `km, hours, pages, reps, count, calories` (calories added via migration `0002_add_calories_unit.sql`).
- D1 `task.unit` is a plain `text NOT NULL` with a CHECK constraint restricting it to the enum. Changing the enum requires a SQLite table-rebuild migration (drizzle-kit generates `__new_task` + copy + drop + rename) — there is no `ALTER TABLE … DROP CHECK` in SQLite.
- Web dropdown (`task-modal.tsx`) derives options from `TASK_UNITS`, so adding a unit there needs no separate UI edit.
- `@momentum/shared-types` and `@momentum/db` ship a compiled `dist/` (package.json `main`/`exports` point at `dist`); the API worker bundles from dist, so after editing source you MUST rebuild both (`npm run build` in each) before `wrangler dev` picks up the change. `scripts/verify-calories-unit.sh` exercises create+log+score for the calories unit (8/8).

## Pre-existing characteristic (NOT a regression, out of scope to change)
- `computeSeasonRating` divides rating sum by `activeDayCount` = ALL included days across full season range, INCLUDING future unelapsed days. So a "running average" early in a season is dragged toward 0 by future days. This was the behavior before the includedDays change too. The prompt explicitly asked to preserve exact averaging behavior and only generalize day-exclusion.

## Conventions
- `useAsyncData` hook now exposes `setData` (Dispatch<SetStateAction<T|null>>) for optimistic updates, plus `data/loading/error/refetch`.
- Web UI: `liquid-glass`, `liquid-glass-strong`, `liquid-glass-subtle` classes. `RatingBadge`/`RatingCell` in components/ui/rating.tsx. `Button` variants: primary/glass/ghost/danger.
- Import types from `@momentum/shared-types`.
