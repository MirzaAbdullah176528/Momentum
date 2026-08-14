import {
  sqliteTable,
  text,
  real,
  integer,
  uniqueIndex,
  index,
  check
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const TASK_UNITS = ["km", "hours", "pages", "reps", "count", "calories"] as const;
export type TaskUnit = (typeof TASK_UNITS)[number];

export const DEFAULT_PROJECT_COLOR = "#808080";
export const DEFAULT_TIMEZONE = "Asia/Karachi";
export const DEFAULT_INCLUDED_DAYS = 0b1111111; // all 7 weekdays
export const SEASON_TARGET_RATING_MIN = 0;
export const SEASON_TARGET_RATING_MAX = 10;
export const TASK_IMPORTANCE_WEIGHT_MIN = 1;
export const TASK_IMPORTANCE_WEIGHT_MAX = 5;
export const WEEKLY_REWARD_WEEK_MIN = 1;
export const WEEKLY_REWARD_WEEK_MAX = 4;
export const WEEKLY_REWARD_TEXT_MAX = 500;
export const FINAL_GOAL_TEXT_MAX = 280;
export const FINAL_GOALS_MAX = 50;
export const SEASON_CHALLENGE_LENGTH_DAYS = 28;

const timestampColumn = (name: string) =>
  integer(name, { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  username: text("username").notNull().unique(),
  timezone: text("timezone")
    .notNull()
    .default(DEFAULT_TIMEZONE),
  createdAt: timestampColumn("created_at"),
  updatedAt: timestampColumn("updated_at")
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [index("idx_session_user").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp"
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp"
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at")
  },
  (table) => [index("idx_account_user").on(table.userId)]
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: timestampColumn("created_at"),
  updatedAt: timestampColumn("updated_at")
});

export const season = sqliteTable(
  "season",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    targetRating: real("target_rating").notNull(),
    rewardText: text("reward_text").notNull(),
    /**
     * 7-bit included-days bitmask (bit N = `Date#getDay()`,
     * 0 = Sunday .. 6 = Saturday). Replaces the legacy `weekdays_only`
     * boolean. Excluded days never count toward a season/weekly average.
     */
    includedDays: integer("included_days")
      .notNull()
      .default(DEFAULT_INCLUDED_DAYS),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at")
  },
  (table) => [
    index("idx_season_user").on(table.userId),
    index("idx_season_dates").on(table.startDate, table.endDate),
    check(
      "season_target_rating_range",
      sql`"target_rating" >= 0 AND "target_rating" <= 10`
    ),
    check(
      "season_included_days_range",
      sql`"included_days" >= 0 AND "included_days" <= 127`
    )
  ]
);

export const seasonWeeklyReward = sqliteTable(
  "season_weekly_reward",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id")
      .notNull()
      .references(() => season.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    targetRating: real("target_rating").notNull(),
    rewardText: text("reward_text").notNull(),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at")
  },
  (table) => [
    uniqueIndex("uniq_weekly_reward_season_week").on(
      table.seasonId,
      table.weekNumber
    ),
    check(
      "weekly_reward_week_number_range",
      sql`${table.weekNumber} >= 1 AND ${table.weekNumber} <= 4`
    ),
    check(
      "weekly_reward_target_rating_range",
      sql`"target_rating" >= 0 AND "target_rating" <= 10`
    )
  ]
);

export const seasonFinalGoal = sqliteTable(
  "season_final_goal",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id")
      .notNull()
      .references(() => season.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at")
  },
  (table) => [index("idx_final_goal_season").on(table.seasonId)]
);

export const project = sqliteTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color")
      .notNull()
      .default(DEFAULT_PROJECT_COLOR),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at")
  },
  (table) => [index("idx_project_user").on(table.userId)]
);

export const task = sqliteTable(
  "task",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    targetValue: real("target_value").notNull(),
    unit: text("unit").notNull(),
    scaleType: text("scale_type").notNull().default("target"),
    importanceWeight: integer("importance_weight").notNull(),
    sortOrder: integer("sort_order")
      .notNull()
      .default(0),
    scheduledStart: text("scheduled_start").notNull(),
    scheduledEnd: text("scheduled_end").notNull(),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at")
  },
  (table) => [
    index("idx_task_user_project_sort").on(
      table.userId,
      table.projectId,
      table.sortOrder
    ),
    check(
      "task_target_value_positive",
      sql`${table.targetValue} > 0`
    ),
    check(
      "task_unit_valid",
      sql`${table.unit} IN ('km', 'hours', 'pages', 'reps', 'count', 'calories')`
    ),
    check(
      "task_scale_type_valid",
      sql`${table.scaleType} IN ('target', 'limit', 'avoid', 'restriction')`
    ),
    check(
      "task_importance_weight_range",
      sql`"importance_weight" >= 1 AND "importance_weight" <= 5`
    )
  ]
);

export const taskLog = sqliteTable(
  "task_log",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    actualValue: real("actual_value"),
    taskScore: real("task_score"),
    createdAt: timestampColumn("created_at"),
    updatedAt: timestampColumn("updated_at")
  },
  (table) => [
    uniqueIndex("uniq_task_log_task_date").on(table.taskId, table.date),
    index("idx_task_log_user_date").on(table.userId, table.date)
  ]
);

export type UserRow = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;
export type SessionRow = typeof session.$inferSelect;
export type SessionInsert = typeof session.$inferInsert;
export type AccountRow = typeof account.$inferSelect;
export type AccountInsert = typeof account.$inferInsert;
export type VerificationRow = typeof verification.$inferSelect;
export type VerificationInsert = typeof verification.$inferInsert;
export type SeasonRow = typeof season.$inferSelect;
export type SeasonInsert = typeof season.$inferInsert;
export type SeasonWeeklyRewardRow = typeof seasonWeeklyReward.$inferSelect;
export type SeasonWeeklyRewardInsert = typeof seasonWeeklyReward.$inferInsert;
export type SeasonFinalGoalRow = typeof seasonFinalGoal.$inferSelect;
export type SeasonFinalGoalInsert = typeof seasonFinalGoal.$inferInsert;
export type ProjectRow = typeof project.$inferSelect;
export type ProjectInsert = typeof project.$inferInsert;
export type TaskRow = typeof task.$inferSelect;
export type TaskInsert = typeof task.$inferInsert;
export type TaskLogRow = typeof taskLog.$inferSelect;
export type TaskLogInsert = typeof taskLog.$inferInsert;
