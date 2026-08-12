import type { PktDateString } from "@momentum/shared-types";
import {
  eachPktDayInRangeWithIncludedDays,
  normalizeIncludedDays,
  parsePktDateString,
  pktDateString
} from "./pkt.js";

export interface TaskScoreInput {
  readonly actualValue: number | null;
  readonly targetValue: number;
  readonly importanceWeight: number;
}

export interface DailyRatingInput extends TaskScoreInput {
  readonly scheduledForPktDate: PktDateString;
}

export interface DailyRatingResult {
  readonly pktDate: PktDateString;
  readonly rating: number;
  readonly taskCount: number;
  readonly totalWeight: number;
  readonly totalScore: number;
}

export interface SeasonDayRating {
  readonly pktDate: PktDateString;
  readonly rating: number;
}

export interface SeasonRatingInput {
  readonly dailyRatings: readonly SeasonDayRating[];
  readonly startPktDate: PktDateString;
  readonly endPktDate: PktDateString;
  /**
   * 7-bit included-days bitmask (bit N = `Date#getDay()`, 0 = Sunday .. 6 =
   * Saturday). Excluded days are dropped entirely — they never count toward
   * the average (not even as a 0), generalizing the legacy `weekdaysOnly`.
   */
  readonly includedDays: number;
}

export interface SeasonRatingResult {
  readonly rating: number;
  readonly activeDayCount: number;
  readonly loggedDayCount: number;
  readonly missedDayCount: number;
  readonly dailyRatings: readonly DailyRatingResult[];
}

export function computeTaskScore(input: TaskScoreInput): number {
  const { actualValue, targetValue, importanceWeight } = input;

  if (actualValue === null || actualValue <= 0) return 0;
  if (importanceWeight <= 0) return 0;
  if (targetValue <= 0) return 0;

  const raw = (actualValue / targetValue) * importanceWeight;
  return Math.min(raw, importanceWeight);
}

export function computeDailyRating(
  tasks: readonly TaskScoreInput[],
  pktDate?: PktDateString
): DailyRatingResult {
  const taskCount = tasks.length;

  if (taskCount === 0) {
    return {
      pktDate: pktDate ?? "",
      rating: 0,
      taskCount: 0,
      totalWeight: 0,
      totalScore: 0
    };
  }

  let totalScore = 0;
  let totalWeight = 0;
  for (const task of tasks) {
    totalScore += computeTaskScore(task);
    totalWeight += task.importanceWeight;
  }

  if (totalWeight <= 0) {
    return {
      pktDate: pktDate ?? "",
      rating: 0,
      taskCount,
      totalWeight: 0,
      totalScore
    };
  }

  const rating = (totalScore / totalWeight) * 10;

  return {
    pktDate: pktDate ?? "",
    rating,
    taskCount,
    totalWeight,
    totalScore
  };
}

export function computeDailyRatingForTasks(
  tasks: readonly DailyRatingInput[]
): DailyRatingResult {
  if (tasks.length === 0) {
    return {
      pktDate: "",
      rating: 0,
      taskCount: 0,
      totalWeight: 0,
      totalScore: 0
    };
  }

  const firstTask = tasks[0];
  if (!firstTask) {
    return {
      pktDate: "",
      rating: 0,
      taskCount: 0,
      totalWeight: 0,
      totalScore: 0
    };
  }
  const firstDate = firstTask.scheduledForPktDate;
  for (const task of tasks) {
    if (task.scheduledForPktDate !== firstDate) {
      throw new Error(
        `computeDailyRatingForTasks expects all tasks to share the same scheduledForPktDate. ` +
          `Found "${task.scheduledForPktDate}" alongside "${firstDate}".`
      );
    }
  }

  const base = computeDailyRating(tasks, firstDate);
  return base;
}

export function computeSeasonRating(
  input: SeasonRatingInput
): SeasonRatingResult {
  const startInstant = parsePktDateString(input.startPktDate);
  const endInstant = parsePktDateString(input.endPktDate);

  if (startInstant.getTime() > endInstant.getTime()) {
    throw new Error(
      `Season start (${input.startPktDate}) must not be after end (${input.endPktDate}).`
    );
  }

  const activeDays = eachPktDayInRangeWithIncludedDays(
    startInstant,
    endInstant,
    normalizeIncludedDays(input.includedDays)
  );

  const ratingByDate = new Map<PktDateString, number>();
  for (const entry of input.dailyRatings) {
    ratingByDate.set(entry.pktDate, entry.rating);
  }

  const dailyResults: DailyRatingResult[] = [];
  let sum = 0;
  let loggedDayCount = 0;

  for (const day of activeDays) {
    const key = pktDateString(day);
    const rating = ratingByDate.get(key);

    if (rating !== undefined) {
      sum += rating;
      loggedDayCount += 1;
      dailyResults.push({
        pktDate: key,
        rating,
        taskCount: 0,
        totalWeight: 0,
        totalScore: 0
      });
    } else {
      dailyResults.push({
        pktDate: key,
        rating: 0,
        taskCount: 0,
        totalWeight: 0,
        totalScore: 0
      });
    }
  }

  const activeDayCount = activeDays.length;
  const missedDayCount = activeDayCount - loggedDayCount;
  const rating = activeDayCount === 0 ? 0 : sum / activeDayCount;

  return {
    rating,
    activeDayCount,
    loggedDayCount,
    missedDayCount,
    dailyRatings: dailyResults
  };
}
