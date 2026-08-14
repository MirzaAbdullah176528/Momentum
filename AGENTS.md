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

## Scoring scales (computeTaskScore in rating-engine/src/rating.ts)
- The per-task scale is now PERSISTED on the `task.scale_type` column (migration `0003_add_task_scale_type.sql`, NOT NULL DEFAULT 'target', CHECK `task_scale_type_valid`). An explicit `scaleType` always wins in `resolveScaleType`; the unit-based fallback (calories ⇒ "limit", else ⇒ "target") is now defense-in-depth only, since every row carries a stored scale. The migration backfills existing rows: `unit='calories'` ⇒ `'limit'`, everything else ⇒ `'target'`, so pre-existing calories tasks keep their limit behavior and no other task's scoring changes.
- `ScaleType = "target" | "limit" | "avoid" | "restriction"` is exported from `@momentum/shared-types` (NOTE: the internal enum was renamed "ascending"→"target" when this column was introduced — "target" is the prompt/user-facing name for the more-is-better scale). `SCALE_TYPES` order is [target, limit, avoid, restriction].
  - **target** (km/hours/pages/reps/count default): `(actual/target) * weight`, capped at `weight`. More is better.
  - **limit** (calories default): target is an upper cap. `actual <= target` ⇒ full `weight`; `actual > target` ⇒ `max(0, weight * (1 - overageRatio))`, `overageRatio = (actual-target)/target`. A small overage is a real reduction (2000/2100/w5 ⇒ 4.75). `null`/`<=0` ⇒ 0.
  - **avoid**: binary toggle. `actualValue === 0` ⇒ full `weight` (avoided); `actualValue > 0` ⇒ 0 (slipped); `null` ⇒ 0. Checked BEFORE the generic `null/<=0 ⇒ 0` guard (0 is the success value here).
  - **restriction**: target is an upper cap whose penalty depends on unit. Use cases: "social media ≤ 1 hour/day" (hours), "check phone ≤ once/day" (count). Checked BEFORE the generic `null/<=0 ⇒ 0` guard, because a LOGGED 0 ("did zero of the restricted thing") is a success — full weight — while an UNLOGGED `null` is 0 (incomplete-task rule). Branching:
    - `unit === "count"`: strict pass/fail — `actualValue <= targetValue` ⇒ full `weight`; over by even one ⇒ 0 (NO partial credit). `actualValue === targetValue` is a PASS (full weight), not a fail.
    - every other unit (hours/km/pages/reps/calories): graduated, identical to the limit formula — `actual <= target` ⇒ full `weight`; else `max(0, weight*(1-overageRatio))`. `actual === target` ⇒ full weight. So restriction+non-count == limit, and restriction+count is the only strict-pass/fail path.
- All production scoring paths pass BOTH `unit` and `scaleType` (the persisted value) so a restriction task scores as restriction regardless of unit: `apps/api/src/routes/task-logs.ts` (PUT upsert + GET daily-rating) and `apps/api/src/routes/analytics.ts` (time-series). The leaderboard path (`packages/db/src/scoped.ts` `computeUserSeasonRatingInDb`) calls `computeTaskScore` directly (db depends on `@momentum/rating-engine`). If you add a new scoring call site, pass `unit` AND `scaleType` rather than re-deriving the formula.
- Task creation/edit UI (`apps/web/src/components/tasks/task-modal.tsx`) offers a "Scoring scale" Select with all four options (target/limit/avoid/restriction) reusing the SAME target/unit/importance-weight fields — no per-scale fields, just a different scoring path. `scaleType` is a LOCKED field (in `LOCKED_TASK_FIELDS`), editable only on season-day-1, like unit/targetValue/importanceWeight.

## Pre-existing characteristic (NOT a regression, out of scope to change)
- `computeSeasonRating` divides rating sum by `activeDayCount` = ALL included days across full season range, INCLUDING future unelapsed days. So a "running average" early in a season is dragged toward 0 by future days. This was the behavior before the includedDays change too. The prompt explicitly asked to preserve exact averaging behavior and only generalize day-exclusion.

## Conventions
- `useAsyncData` hook now exposes `setData` (Dispatch<SetStateAction<T|null>>) for optimistic updates, plus `data/loading/error/refetch`.
- Web UI: `liquid-glass`, `liquid-glass-strong`, `liquid-glass-subtle` classes. `RatingBadge`/`RatingCell` in components/ui/rating.tsx. `Button` variants: primary/glass/ghost/danger.
- Import types from `@momentum/shared-types`.
