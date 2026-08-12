import type { PktDateString, HhMmString } from "@momentum/shared-types";
import {
  SEASON_CHALLENGE_LENGTH_DAYS,
  SEASON_CHALLENGE_WEEKS,
  SEASON_WEEK_LENGTH_DAYS
} from "@momentum/shared-types";
import {
  addPktDays,
  addPktDaysToDate,
  parsePktDateString,
  pktDateString,
  pktDayEnd,
  pktDayStart,
  toPktWallClock
} from "./pkt.js";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const START_GRACE_PERIOD_MS = 1 * MS_PER_HOUR;
const HH_MM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ScheduledTaskStart {
  readonly scheduledStart: HhMmString;
}

/**
 * Resolves the start date for a new 28-day challenge, in PKT.
 *
 * Algorithm (documented for review — the "more than 1 hour ago" and "no tasks
 * today" branches were inferred, not explicitly specified):
 * 1. Collect the `scheduled_start` ("HH:mm", PKT wall clock) of every task the
 *    user has scheduled for today.
 * 2. Take the earliest of those.
 * 3. If that earliest start is still upcoming today, OR has already passed but
 *    by no more than 1 hour → startDate = today.
 * 4. Otherwise (it passed more than 1 hour ago, or there are no tasks
 *    scheduled for today at all) → startDate = tomorrow.
 *
 * `endDate` = startDate + (SEASON_CHALLENGE_LENGTH_DAYS - 1) days, i.e. a full
 * 28-day / 4-week span (startDate is day 1).
 *
 * `nowUtc` is accepted as a parameter so the threshold logic is deterministic
 * and unit-testable without touching the system clock.
 */
export function resolveChallengeStartDate(
  todayPkt: PktDateString,
  scheduledStartsToday: readonly ScheduledTaskStart[],
  nowUtc: Date = new Date()
): { startDate: PktDateString; endDate: PktDateString } {
  const startOfDayUtc = pktDayStart(parsePktDateString(todayPkt));
  const startOfNextDayUtc = addPktDays(parsePktDateString(todayPkt), 1);

  const valid = scheduledStartsToday
    .map((t) => t.scheduledStart)
    .filter((value): value is string => HH_MM_PATTERN.test(value))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const earliest = valid[0];

  let useToday: boolean;
  if (earliest === undefined) {
    // No task scheduled for today → start tomorrow.
    useToday = false;
  } else {
    const [hStr = "0", mStr = "0"] = earliest.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    const startUtcMs =
      startOfDayUtc.getTime() + (h * MS_PER_HOUR + m * MS_PER_MINUTE);
    const elapsedMs = nowUtc.getTime() - startUtcMs;

    if (elapsedMs <= START_GRACE_PERIOD_MS) {
      // Upcoming today, or passed by no more than 1 hour → today.
      useToday = true;
    } else {
      // Passed more than 1 hour ago → tomorrow.
      useToday = false;
    }
  }

  const startDateInstant = useToday ? startOfDayUtc : startOfNextDayUtc;
  const startDate = pktDateString(startDateInstant);
  const endDate = addPktDaysToDate(
    startDate,
    SEASON_CHALLENGE_LENGTH_DAYS - 1
  );
  return { startDate, endDate };
}

/** Convenience helper used by tests/inspectors. */
export function startGracePeriodMs(): number {
  return START_GRACE_PERIOD_MS;
}

/**
 * Returns the inclusive [startDate, endDate] PKT date range for challenge week
 * `weekNumber` (1-based, 1..SEASON_CHALLENGE_WEEKS). Week N covers
 * [startDate + 7*(N-1), startDate + 7*N - 1].
 */
export function challengeWeekRange(
  seasonStartDate: PktDateString,
  weekNumber: number
): { startDate: PktDateString; endDate: PktDateString } {
  if (
    !Number.isInteger(weekNumber) ||
    weekNumber < 1 ||
    weekNumber > SEASON_CHALLENGE_WEEKS
  ) {
    throw new Error(
      `challengeWeekRange: weekNumber must be in 1..${SEASON_CHALLENGE_WEEKS}, got ${weekNumber}.`
    );
  }
  const offset = (weekNumber - 1) * SEASON_WEEK_LENGTH_DAYS;
  return {
    startDate: addPktDaysToDate(seasonStartDate, offset),
    endDate: addPktDaysToDate(seasonStartDate, offset + SEASON_WEEK_LENGTH_DAYS - 1)
  };
}

/**
 * A week is "concluded" once the current PKT instant is past the end of the
 * week's last day. Until then the week is in progress and must be shown as
 * such. The week start is not needed for this check.
 */
export function isWeekConcluded(
  weekEndDate: PktDateString,
  nowUtc: Date = new Date()
): boolean {
  const weekEndInstant = pktDayEnd(parsePktDateString(weekEndDate));
  return nowUtc.getTime() > weekEndInstant.getTime();
}

/**
 * A season is "concluded" once its end date has fully elapsed.
 */
export function isSeasonConcluded(
  seasonEndDate: PktDateString,
  nowUtc: Date = new Date()
): boolean {
  return isWeekConcluded(seasonEndDate, nowUtc);
}

export {
  SEASON_CHALLENGE_LENGTH_DAYS,
  SEASON_CHALLENGE_WEEKS,
  SEASON_WEEK_LENGTH_DAYS,
  toPktWallClock
};
