import { Hono } from "hono";
import { z } from "zod";
import { createScopedDb } from "@momentum/db";
import {
  computeSeasonRating,
  computeDailyRating,
  eachPktDayInRange,
  parsePktDateString,
  pktDateString,
  nowPktDateString
} from "@momentum/rating-engine";
import type {
  SeasonDTO,
  CreateSeasonInputDTO,
  UpdateSeasonInputDTO,
  SeasonRatingDTO,
  DailyRatingDTO,
  CurrentSeasonDTO,
  ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, notFound, validationError } from "../lib/http.js";
import { toIso } from "../lib/date.js";
import { MUTATING_ENDPOINT_RATE_LIMIT } from "../middleware/rate-limit.js";

const PKT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createSeasonSchema = z.object({
  startDate: z.string().regex(PKT_DATE_REGEX),
  endDate: z.string().regex(PKT_DATE_REGEX),
  targetRating: z.number().min(0).max(10),
  rewardText: z.string().min(1).max(500),
  weekdaysOnly: z.boolean()
});

const updateSeasonSchema = z.object({
  targetRating: z.number().min(0).max(10).optional(),
  rewardText: z.string().min(1).max(500).optional(),
  weekdaysOnly: z.boolean().optional()
});

function rowToDto(row: {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  targetRating: number;
  rewardText: string;
  weekdaysOnly: boolean;
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
    weekdaysOnly: row.weekdaysOnly,
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
  if (!season) return notFound(c, "No active season for today's date.");

  const activeDays = eachPktDayInRange(
    parsePktDateString(season.startDate),
    parsePktDateString(season.endDate),
    season.weekdaysOnly
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

  const computed = computeSeasonRating({
    dailyRatings: dailyRatings.map((dr) => ({
      pktDate: dr.pktDate,
      rating: dr.rating
    })),
    startPktDate: season.startDate,
    endPktDate: season.endDate,
    weekdaysOnly: season.weekdaysOnly
  });

  const todayInstant = parsePktDateString(todayPkt);
  const remainingDays = activeDays.filter(
    (d) => d.getTime() >= todayInstant.getTime()
  ).length;

  const result: CurrentSeasonDTO = {
    season: rowToDto(season),
    dailyRatings,
    runningAverage: computed.rating,
    activeDayCount: computed.activeDayCount,
    loggedDayCount: computed.loggedDayCount,
    missedDayCount: computed.missedDayCount,
    targetRating: season.targetRating,
    rewardAchieved: computed.rating >= season.targetRating,
    daysRemaining: remainingDays
  };

  return ok(c, result);
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

seasons.get("/:id/rating", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");
  const season = await scoped.seasonById(id);
  if (!season) return notFound(c, `Season ${id} not found.`);

  const activeDays = eachPktDayInRange(
    parsePktDateString(season.startDate),
    parsePktDateString(season.endDate),
    season.weekdaysOnly
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

  const computed = computeSeasonRating({
    dailyRatings: dailyRatings.map((dr) => ({
      pktDate: dr.pktDate,
      rating: dr.rating
    })),
    startPktDate: season.startDate,
    endPktDate: season.endDate,
    weekdaysOnly: season.weekdaysOnly
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

export type SeasonsRoute = typeof seasons;
export type { ApiResponse, SeasonDTO, SeasonRatingDTO, CurrentSeasonDTO };
