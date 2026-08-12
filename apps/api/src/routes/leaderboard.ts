import { Hono } from "hono";
import { createDb, fetchLeaderboard } from "@momentum/db";
import { nowPktDateString } from "@momentum/rating-engine";
import { INCLUDED_DAYS_ALL } from "@momentum/shared-types";
import type {
  LeaderboardResponseDTO,
  LeaderboardEntryDTO,
  ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, validationError } from "../lib/http.js";
import { LEADERBOARD_RATE_LIMIT } from "../middleware/rate-limit.js";

const PKT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_OFFSET = 10000;

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min) return min;
  if (n > max) return max;
  return n;
}

export const leaderboard = new Hono<AppContext>();

leaderboard.get("/", LEADERBOARD_RATE_LIMIT, async (c) => {
  const todayPkt = nowPktDateString();
  const startDate = c.req.query("startDate") ?? todayPkt.slice(0, 8) + "01";
  const endDate = c.req.query("endDate") ?? todayPkt;

  if (!PKT_DATE_REGEX.test(startDate) || !PKT_DATE_REGEX.test(endDate)) {
    return validationError(c, "startDate and endDate must be YYYY-MM-DD.", {
      startDate,
      endDate
    });
  }

  if (startDate > endDate) {
    return validationError(c, "startDate must not be after endDate.", {
      startDate,
      endDate
    });
  }

  const limit = clampInt(c.req.query("limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);
  const offset = clampInt(c.req.query("offset"), 0, MAX_OFFSET, 0);

  const db = createDb(c.env.DB);
  const result = await fetchLeaderboard(db, {
    seasonStartDate: startDate,
    seasonEndDate: endDate,
    // Each season row carries its own includedDays; this default is used only
    // if a row is missing the value (legacy data).
    includedDays: INCLUDED_DAYS_ALL,
    limit,
    offset
  });

  const entries: LeaderboardEntryDTO[] = result.entries.map((entry, index) => ({
    rank: offset + index + 1,
    username: entry.username,
    seasonRating: Number(entry.seasonRating.toFixed(4))
  }));

  const dto: LeaderboardResponseDTO = {
    entries,
    total: result.total,
    limit,
    offset,
    seasonStartDate: startDate,
    seasonEndDate: endDate
  };

  return ok(c, dto);
});

export type LeaderboardRoute = typeof leaderboard;
export type { ApiResponse, LeaderboardResponseDTO, LeaderboardEntryDTO };
