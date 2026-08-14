import { Hono } from "hono";
import { z } from "zod";
import { createScopedDb } from "@momentum/db";
import {
  computeSeasonRating,
  computeDailyRating,
  eachPktDayInRangeWithIncludedDays,
  parsePktDateString,
  pktDateString,
  nowPktDateString,
  resolveChallengeStartDate,
  challengeWeekRange,
  isWeekConcluded,
  isSeasonConcluded,
  normalizeIncludedDays
} from "@momentum/rating-engine";
import {
  INCLUDED_DAYS_ALL,
  WEEKLY_REWARD_TEXT_MAX,
  FINAL_GOAL_TEXT_MAX,
  WEEKLY_REWARD_WEEK_MIN,
  WEEKLY_REWARD_WEEK_MAX,
  FINAL_GOALS_MAX
} from "@momentum/shared-types";
import type {
  SeasonDTO,
  CreateSeasonInputDTO,
  UpdateSeasonInputDTO,
  SeasonRatingDTO,
  DailyRatingDTO,
  CurrentSeasonDTO,
  WeeklyRewardDTO,
  WeeklyRewardIndicatorDTO,
  MonthlyRewardIndicatorDTO,
  RewardIndicatorStatus,
  SeasonFinalGoalDTO,
  StartChallengeInputDTO,
  StartChallengeResultDTO,
  StartChallengeEligibilityDTO,
  ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, notFound, validationError, conflict } from "../lib/http.js";
import { toIso } from "../lib/date.js";
import { MUTATING_ENDPOINT_RATE_LIMIT } from "../middleware/rate-limit.js";

const PKT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSeasonSchema = z.object({
  startDate: z.string().regex(PKT_DATE_REGEX),
  endDate: z.string().regex(PKT_DATE_REGEX),
  targetRating: z.number().min(0).max(10),
  rewardText: z.string().min(1).max(500),
  includedDays: z.number().int().min(0).max(127)
});

const updateSeasonSchema = z.object({
  targetRating: z.number().min(0).max(10).optional(),
  rewardText: z.string().min(1).max(500).optional(),
  includedDays: z.number().int().min(0).max(127).optional()
});

const weeklyRewardInputSchema = z.object({
  weekNumber: z.number().int().min(WEEKLY_REWARD_WEEK_MIN).max(WEEKLY_REWARD_WEEK_MAX),
  targetRating: z.number().min(0).max(10),
  rewardText: z.string().min(1).max(WEEKLY_REWARD_TEXT_MAX)
});

const finalGoalInputSchema = z.object({
  text: z.string().min(1).max(FINAL_GOAL_TEXT_MAX)
});

const startChallengeSchema = z.object({
  includedDays: z.number().int().min(1).max(127),
  targetRating: z.number().min(0).max(10),
  rewardText: z.string().min(1).max(500),
  weeklyRewards: z.array(weeklyRewardInputSchema).length(4),
  finalGoals: z.array(finalGoalInputSchema).max(FINAL_GOALS_MAX)
});

function rowToDto(row: {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  targetRating: number;
  rewardText: string;
  includedDays: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}): SeasonDTO {
  return {
    id: row.id,
    userId: row.userId,
    startDate: row.startDate,
    endDate: row.endDate,
    targetRating: row.targetRating,
    rewardText: row.rewardText,
    includedDays: normalizeIncludedDays(row.includedDays ?? INCLUDED_DAYS_ALL),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

function weeklyRewardRowToDto(row: {
  id: string;
  seasonId: string;
  weekNumber: number;
  targetRating: number;
  rewardText: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): WeeklyRewardDTO {
  return {
    id: row.id,
    seasonId: row.seasonId,
    weekNumber: row.weekNumber,
    targetRating: row.targetRating,
    rewardText: row.rewardText,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

function finalGoalRowToDto(row: {
  id: string;
  seasonId: string;
  text: string;
  completed: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}): SeasonFinalGoalDTO {
  return {
    id: row.id,
    seasonId: row.seasonId,
    text: row.text,
    completed: row.completed,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

export const seasons = new Hono<AppContext>();

seasons.get("/", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const rows = await scoped.seasons();
  return ok(c, rows.map(rowToDto));
});

seasons.get("/current", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const todayPkt = nowPktDateString();
  const season = await scoped.currentSeason(todayPkt);

  // No active season is a normal state (the UI shows the Start Challenge
  // flow), not an error — return null so the frontend doesn't treat it as one.
  if (!season) return ok<CurrentSeasonDTO | null>(c, null);

  const dailyRatings = await computeDailyRatingsForRange(
    scoped,
    season.startDate,
    season.endDate,
    season.includedDays
  );

  const computed = computeSeasonRating({
    dailyRatings: dailyRatings.map((dr) => ({
      pktDate: dr.pktDate,
      rating: dr.rating
    })),
    startPktDate: season.startDate,
    endPktDate: season.endDate,
    includedDays: season.includedDays
  });

  const weeklyRewards = await scoped.weeklyRewardsForSeason(season.id);
  const weeklyRewardIndicators = computeWeeklyRewardIndicators(
    season.startDate,
    season.includedDays,
    dailyRatings,
    weeklyRewards
  );
  const monthlyRewardIndicator: MonthlyRewardIndicatorDTO = {
    status: resolveRewardStatus(
      isSeasonConcluded(season.endDate),
      computed.rating,
      season.targetRating
    ),
    averageRating: computed.rating,
    targetRating: season.targetRating,
    rewardText: season.rewardText
  };

  const finalGoals = await scoped.finalGoalsForSeason(season.id);

  const todayInstant = parsePktDateString(todayPkt);
  const activeDays = eachPktDayInRangeWithIncludedDays(
    parsePktDateString(season.startDate),
    parsePktDateString(season.endDate),
    season.includedDays
  );
  const remainingDays = activeDays.filter(
    (d) => d.getTime() >= todayInstant.getTime()
  ).length;

  const result: CurrentSeasonDTO = {
    season: rowToDto(season),
    dailyRatings,
    weeklyRewards: weeklyRewards.map(weeklyRewardRowToDto),
    weeklyRewardIndicators,
    monthlyRewardIndicator,
    finalGoals: finalGoals.map(finalGoalRowToDto),
    runningAverage: computed.rating,
    activeDayCount: computed.activeDayCount,
    loggedDayCount: computed.loggedDayCount,
    missedDayCount: computed.missedDayCount,
    targetRating: season.targetRating,
    rewardAchieved: computed.rating >= season.targetRating,
    daysRemaining: remainingDays,
    canEditLockedFields: season.startDate === todayPkt
  };

  return ok(c, result);
});

seasons.get("/start-eligibility", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const todayPkt = nowPktDateString();
  const existing = await scoped.findActiveOrUpcomingSeason(todayPkt);
  const eligibility: StartChallengeEligibilityDTO = existing
    ? {
      canStart: false,
      reason:
        "An active or upcoming season already exists. Finish or delete it before starting a new challenge."
    }
    : { canStart: true };
  return ok(c, eligibility);
});

seasons.get("/:id", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const row = await scoped.seasonById(c.req.param("id"));
  if (!row) return notFound(c, `Season ${c.req.param("id")} not found.`);
  return ok(c, rowToDto(row));
});

seasons.post("/", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const parsed = createSeasonSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(c, "Invalid season payload.", parsed.error.flatten());
  }
  const input: CreateSeasonInputDTO = parsed.data;

  if (input.startDate > input.endDate) {
    return validationError(c, "startDate must not be after endDate.", {
      startDate: input.startDate,
      endDate: input.endDate
    });
  }

  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const created = await scoped.insertSeason(input);
  return ok(c, rowToDto(created), 201);
});

seasons.post(
  "/start",
  MUTATING_ENDPOINT_RATE_LIMIT,
  async (c) => {
    const parsed = startChallengeSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return validationError(
        c,
        "Invalid start-challenge payload. Provide includedDays, targetRating, rewardText, exactly 4 weeklyRewards, and up to 50 finalGoals.",
        parsed.error.flatten()
      );
    }
    const input: StartChallengeInputDTO = parsed.data;

    // The 4 weekly rewards must cover weeks 1..4 exactly once.
    const weekNumbers = new Set(input.weeklyRewards.map((w) => w.weekNumber));
    const expectedWeeks = new Set([1, 2, 3, 4]);
    if (weekNumbers.size !== 4 || ![...expectedWeeks].every((w) => weekNumbers.has(w))) {
      return validationError(c, "weeklyRewards must cover weeks 1 through 4 exactly once.");
    }

    const scoped = await createScopedDb(c.env.DB, c.get("userId"));
    const todayPkt = nowPktDateString();

    // Guard: only when no active/upcoming season exists.
    const existing = await scoped.findActiveOrUpcomingSeason(todayPkt);
    if (existing) {
      return conflict(
        c,
        "An active or upcoming season already exists. Finish or delete it before starting a new challenge."
      );
    }

    // Resolve start date from the user's tasks (PKT), with the 1-hour grace.
    const scheduledStarts = await scoped.scheduledStartsForPktDate(todayPkt);
    const { startDate, endDate } = resolveChallengeStartDate(
      todayPkt,
      scheduledStarts
        .filter((s): s is { scheduledStart: string } => HH_MM_REGEX.test(s.scheduledStart ?? ""))
        .map((s) => ({ scheduledStart: s.scheduledStart }))
    );

    const season = await scoped.insertSeason({
      startDate,
      endDate,
      targetRating: input.targetRating,
      rewardText: input.rewardText,
      includedDays: input.includedDays
    });

    const weeklyRewards = await scoped.insertWeeklyRewards(
      season.id,
      input.weeklyRewards.map((w) => ({
        weekNumber: w.weekNumber,
        targetRating: w.targetRating,
        rewardText: w.rewardText
      }))
    );

    const finalGoals = await scoped.insertFinalGoals(
      season.id,
      input.finalGoals.map((g) => ({ text: g.text, completed: false }))
    );

    const result: StartChallengeResultDTO = {
      season: rowToDto(season),
      weeklyRewards: weeklyRewards.map(weeklyRewardRowToDto),
      finalGoals: finalGoals.map(finalGoalRowToDto)
    };

    return ok(c, result, 201);
  }
);

seasons.get("/:id/challenge", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");
  const season = await scoped.seasonById(id);
  if (!season) return notFound(c, `Season ${id} not found.`);

  const dailyRatings = await computeDailyRatingsForRange(
    scoped,
    season.startDate,
    season.endDate,
    season.includedDays
  );
  const computed = computeSeasonRating({
    dailyRatings: dailyRatings.map((dr) => ({
      pktDate: dr.pktDate,
      rating: dr.rating
    })),
    startPktDate: season.startDate,
    endPktDate: season.endDate,
    includedDays: season.includedDays
  });
  const weeklyRewards = await scoped.weeklyRewardsForSeason(season.id);
  const weeklyRewardIndicators = computeWeeklyRewardIndicators(
    season.startDate,
    season.includedDays,
    dailyRatings,
    weeklyRewards
  );
  const monthlyRewardIndicator: MonthlyRewardIndicatorDTO = {
    status: resolveRewardStatus(
      isSeasonConcluded(season.endDate),
      computed.rating,
      season.targetRating
    ),
    averageRating: computed.rating,
    targetRating: season.targetRating,
    rewardText: season.rewardText
  };
  const finalGoals = await scoped.finalGoalsForSeason(season.id);

  return ok(c, {
    season: rowToDto(season),
    weeklyRewards: weeklyRewards.map(weeklyRewardRowToDto),
    weeklyRewardIndicators,
    monthlyRewardIndicator,
    finalGoals: finalGoals.map(finalGoalRowToDto),
    runningAverage: computed.rating,
    activeDayCount: computed.activeDayCount,
    loggedDayCount: computed.loggedDayCount,
    missedDayCount: computed.missedDayCount
  });
});

seasons.patch("/:id", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const parsed = updateSeasonSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(c, "Invalid update payload.", parsed.error.flatten());
  }
  const input: UpdateSeasonInputDTO = parsed.data;
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");

  const existing = await scoped.seasonById(id);
  if (!existing) return notFound(c, `Season ${id} not found.`);

  const updated = await scoped.updateSeason(id, input);
  if (!updated) return notFound(c, `Season ${id} not found after update.`);
  return ok(c, rowToDto(updated));
});

seasons.delete("/:id", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");
  const existing = await scoped.seasonById(id);
  if (!existing) return notFound(c, `Season ${id} not found.`);
  await scoped.deleteSeason(id);
  return ok(c, { id });
});

// --- Final goals (standalone checklist) ---

seasons.post(
  "/:id/final-goals",
  MUTATING_ENDPOINT_RATE_LIMIT,
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = z
      .object({ text: z.string().min(1).max(FINAL_GOAL_TEXT_MAX) })
      .safeParse(body);
    if (!parsed.success) {
      return validationError(c, "Invalid final goal payload.", parsed.error.flatten());
    }
    const scoped = await createScopedDb(c.env.DB, c.get("userId"));
    const id = c.req.param("id");
    const season = await scoped.seasonById(id);
    if (!season) return notFound(c, `Season ${id} not found.`);

    const existing = await scoped.finalGoalsForSeason(id);
    if (existing.length >= FINAL_GOALS_MAX) {
      return validationError(c, `Final goals limit (${FINAL_GOALS_MAX}) reached.`);
    }

    const created = await scoped.insertFinalGoals(id, [{ text: parsed.data.text }]);
    const goal = created[0];
    if (!goal) return notFound(c, "Final goal was not persisted.");
    return ok(c, finalGoalRowToDto(goal), 201);
  }
);

seasons.patch(
  "/:id/final-goals/:goalId",
  MUTATING_ENDPOINT_RATE_LIMIT,
  async (c) => {
    const parsed = z
      .object({ completed: z.boolean() })
      .safeParse(await c.req.json());
    if (!parsed.success) {
      return validationError(c, "Invalid payload.", parsed.error.flatten());
    }
    const scoped = await createScopedDb(c.env.DB, c.get("userId"));
    const goalId = c.req.param("goalId");
    const updated = await scoped.updateFinalGoalCompleted(goalId, parsed.data.completed);
    if (!updated) return notFound(c, `Final goal ${goalId} not found.`);
    return ok(c, finalGoalRowToDto(updated));
  }
);

seasons.delete(
  "/:id/final-goals/:goalId",
  MUTATING_ENDPOINT_RATE_LIMIT,
  async (c) => {
    const scoped = await createScopedDb(c.env.DB, c.get("userId"));
    const goalId = c.req.param("goalId");
    await scoped.deleteFinalGoal(goalId);
    return ok(c, { id: goalId });
  }
);

seasons.get("/:id/rating", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");
  const season = await scoped.seasonById(id);
  if (!season) return notFound(c, `Season ${id} not found.`);

  const dailyRatings = await computeDailyRatingsForRange(
    scoped,
    season.startDate,
    season.endDate,
    season.includedDays
  );

  const computed = computeSeasonRating({
    dailyRatings: dailyRatings.map((dr) => ({
      pktDate: dr.pktDate,
      rating: dr.rating
    })),
    startPktDate: season.startDate,
    endPktDate: season.endDate,
    includedDays: season.includedDays
  });

  const result: SeasonRatingDTO = {
    seasonId: season.id,
    rating: computed.rating,
    activeDayCount: computed.activeDayCount,
    loggedDayCount: computed.loggedDayCount,
    missedDayCount: computed.missedDayCount,
    dailyRatings
  };

  return ok(c, result);
});

// --- Helpers ---

/**
 * Computes the daily rating for every included day in `[startPktDate,
 * endPktDate]`. Excluded days are omitted entirely (never counted, not even as
 * a 0), matching the generalized included-days rule.
 */
async function computeDailyRatingsForRange(
  scoped: Awaited<ReturnType<typeof createScopedDb>>,
  startPktDate: string,
  endPktDate: string,
  includedDays: number
): Promise<DailyRatingDTO[]> {
  const activeDays = eachPktDayInRangeWithIncludedDays(
    parsePktDateString(startPktDate),
    parsePktDateString(endPktDate),
    includedDays
  );

  const dailyRatings: DailyRatingDTO[] = [];
  for (const dayInstant of activeDays) {
    const dateKey = pktDateString(dayInstant);
    const tasksWithLogs = await scoped.tasksWithLogsForDate(dateKey);
    const result = computeDailyRating(
      tasksWithLogs.map(({ task, log }) => ({
        actualValue: log?.actualValue ?? null,
        targetValue: task.targetValue,
        importanceWeight: task.importanceWeight
      })),
      dateKey
    );
    dailyRatings.push({
      pktDate: dateKey,
      rating: result.rating,
      taskCount: result.taskCount,
      totalWeight: result.totalWeight,
      totalScore: result.totalScore
    });
  }
  return dailyRatings;
}

/**
 * Computes one indicator per week (1..4). A week is "in progress" until every
 * included day within its range has concluded; only then is its average
 * compared to its target to yield "achieved" / "not_achieved". The average is
 * computed from that week's daily ratings (excluded days never count).
 */
function computeWeeklyRewardIndicators(
  seasonStartDate: string,
  includedDays: number,
  dailyRatings: DailyRatingDTO[],
  weeklyRewards: { weekNumber: number; targetRating: number; rewardText: string }[]
): WeeklyRewardIndicatorDTO[] {
  const ratingByDate = new Map(dailyRatings.map((dr) => [dr.pktDate, dr.rating]));
  const byWeek = new Map(weeklyRewards.map((w) => [w.weekNumber, w]));

  const indicators: WeeklyRewardIndicatorDTO[] = [];
  for (let week = 1; week <= 4; week++) {
    const wr = byWeek.get(week);
    const range = challengeWeekRange(seasonStartDate, week);
    const weekDays = eachPktDayInRangeWithIncludedDays(
      parsePktDateString(range.startDate),
      parsePktDateString(range.endDate),
      includedDays
    );
    const rated = weekDays
      .map((d) => ({ date: pktDateString(d), rating: ratingByDate.get(pktDateString(d)) }))
      .filter((d): d is { date: string; rating: number } => d.rating !== undefined);

    const activeDayCount = weekDays.length;
    const loggedDayCount = rated.length;
    const averageRating =
      activeDayCount === 0
        ? 0
        : rated.reduce((sum, r) => sum + r.rating, 0) / activeDayCount;

    const concluded = isWeekConcluded(range.endDate);
    const target = wr?.targetRating ?? 0;
    indicators.push({
      weekNumber: week,
      targetRating: target,
      rewardText: wr?.rewardText ?? "",
      status: resolveRewardStatus(concluded, averageRating, target),
      averageRating,
      activeDayCount,
      loggedDayCount,
      startDate: range.startDate,
      endDate: range.endDate
    });
  }
  return indicators;
}

function resolveRewardStatus(
  concluded: boolean,
  averageRating: number,
  targetRating: number
): RewardIndicatorStatus {
  if (!concluded) return "in_progress";
  return averageRating >= targetRating ? "achieved" : "not_achieved";
}

export type SeasonsRoute = typeof seasons;
export type {
  ApiResponse,
  SeasonDTO,
  SeasonRatingDTO,
  CurrentSeasonDTO,
  WeeklyRewardDTO,
  WeeklyRewardIndicatorDTO,
  MonthlyRewardIndicatorDTO,
  SeasonFinalGoalDTO,
  StartChallengeInputDTO,
  StartChallengeResultDTO,
  StartChallengeEligibilityDTO
};
