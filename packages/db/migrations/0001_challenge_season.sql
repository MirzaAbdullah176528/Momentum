-- Season redesign: 28-day challenge with a general included-days bitmask,
-- per-week reward targets, and a standalone final-goals checklist.
--
-- Backfill rule (preserves existing rows' behavior exactly):
--   legacy weekdays_only = 1 (true)  -> included_days = 62  (Mon-Fri)
--   legacy weekdays_only = 0 (false) -> included_days = 127 (all 7 days)
-- Existing Season rows and their historical data are NOT altered or deleted;
-- only the representation of which days count changes, and new tables are
-- added. This migration is additive + a single backfill UPDATE.

-- 1. Add the new included_days column (NOT NULL, default all-7-days = 127).
ALTER TABLE `season` ADD COLUMN `included_days` integer DEFAULT 127 NOT NULL;
--> statement-breakpoint

-- 2. Backfill: legacy weekdays-only rows become Mon-Fri (62).
UPDATE `season` SET `included_days` = 62 WHERE `weekdays_only` = 1;
--> statement-breakpoint

-- 3. Drop the legacy weekdays_only column (SQLite 3.35+ supports DROP COLUMN).
ALTER TABLE `season` DROP COLUMN `weekdays_only`;
--> statement-breakpoint

-- 4. Weekly rewards table (one row per week 1-4 per season).
CREATE TABLE `season_weekly_reward` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`target_rating` real NOT NULL,
	`reward_text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "weekly_reward_week_number_range" CHECK("week_number" >= 1 AND "week_number" <= 4),
	CONSTRAINT "weekly_reward_target_rating_range" CHECK("target_rating" >= 0 AND "target_rating" <= 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_weekly_reward_season_week` ON `season_weekly_reward` (`season_id`,`week_number`);
--> statement-breakpoint

-- 5. Final goals checklist table (free-text item + completed boolean).
CREATE TABLE `season_final_goal` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`text` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_final_goal_season` ON `season_final_goal` (`season_id`);
