import { describe, it, expect } from "vitest";
import {
  computeTaskScore,
  computeDailyRating,
  computeDailyRatingForTasks,
  computeSeasonRating
} from "./rating.js";
import { INCLUDED_DAYS_ALL, INCLUDED_DAYS_MON_FRI } from "@momentum/shared-types";

describe("computeTaskScore", () => {
  it("scores a normal partial-completion task", () => {
    const score = computeTaskScore({
      actualValue: 5,
      targetValue: 10,
      importanceWeight: 2
    });
    expect(score).toBe(1);
  });

  it("scores a fully-completed task at the weight", () => {
    const score = computeTaskScore({
      actualValue: 10,
      targetValue: 10,
      importanceWeight: 2
    });
    expect(score).toBe(2);
  });

  it("caps the score at importanceWeight (no overachievement bonus)", () => {
    const score = computeTaskScore({
      actualValue: 20,
      targetValue: 10,
      importanceWeight: 2
    });
    expect(score).toBe(2);
  });

  it("caps even when actual far exceeds target", () => {
    const score = computeTaskScore({
      actualValue: 1_000,
      targetValue: 1,
      importanceWeight: 4
    });
    expect(score).toBe(4);
  });

  it("returns 0 when actualValue is null", () => {
    const score = computeTaskScore({
      actualValue: null,
      targetValue: 10,
      importanceWeight: 2
    });
    expect(score).toBe(0);
  });

  it("returns 0 when actualValue is exactly 0", () => {
    const score = computeTaskScore({
      actualValue: 0,
      targetValue: 10,
      importanceWeight: 2
    });
    expect(score).toBe(0);
  });

  it("returns 0 when actualValue is negative", () => {
    const score = computeTaskScore({
      actualValue: -5,
      targetValue: 10,
      importanceWeight: 2
    });
    expect(score).toBe(0);
  });

  it("returns 0 when importanceWeight is 0 (no contribution)", () => {
    const score = computeTaskScore({
      actualValue: 5,
      targetValue: 10,
      importanceWeight: 0
    });
    expect(score).toBe(0);
  });

  it("returns 0 when targetValue is 0 (avoids divide-by-zero)", () => {
    const score = computeTaskScore({
      actualValue: 5,
      targetValue: 0,
      importanceWeight: 2
    });
    expect(score).toBe(0);
  });

  it("handles fractional completion proportionally", () => {
    const score = computeTaskScore({
      actualValue: 7.5,
      targetValue: 10,
      importanceWeight: 3
    });
    expect(score).toBeCloseTo(2.25, 5);
  });
});

describe("computeTaskScore — limit scale (calories)", () => {
  // The exact case from the spec: target 2000, weight 5, 100 over must reduce
  // the score visibly — it must NOT be silently rounded away to the full 5.
  it("reduces points for a small overage (2000 target, 2100 actual, weight 5 → 4.75)", () => {
    const score = computeTaskScore({
      actualValue: 2100,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBeCloseTo(4.75, 5);
    expect(score).not.toBe(5);
    expect(score).toBeLessThan(5);
    expect(score).toBeGreaterThan(0);
  });

  it("derives the limit scale from unit=calories even without an explicit scaleType", () => {
    // overageRatio = (2100 - 2000) / 2000 = 0.05 → 5 * (1 - 0.05) = 4.75
    const score = computeTaskScore({
      actualValue: 2100,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBeCloseTo(4.75, 5);
  });

  it("earns the full weight when meeting the target exactly", () => {
    const score = computeTaskScore({
      actualValue: 2000,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBe(5);
  });

  it("earns the full weight when coming in under the limit", () => {
    const score = computeTaskScore({
      actualValue: 1500,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBe(5);
  });

  it("scales the reduction with a larger overage (3000 over a 2000 target → 2.5)", () => {
    // overageRatio = 1000/2000 = 0.5 → 5 * 0.5 = 2.5
    const score = computeTaskScore({
      actualValue: 3000,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBeCloseTo(2.5, 5);
  });

  it("scores 0 when the intake doubles the limit (overageRatio = 1)", () => {
    const score = computeTaskScore({
      actualValue: 4000,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBe(0);
  });

  it("never goes below 0 for an extreme overage", () => {
    const score = computeTaskScore({
      actualValue: 10_000,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBe(0);
  });

  it("scores 0 when nothing is logged (unlogged day)", () => {
    const score = computeTaskScore({
      actualValue: null,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "calories"
    });
    expect(score).toBe(0);
  });

  it("does not treat a non-calories unit as limit-scale by default", () => {
    // A "km" task with the same numbers stays target-scale: capped at the
    // weight, so 2100/2000 * 5 = 5.25 → capped to 5 (no overage reduction).
    const score = computeTaskScore({
      actualValue: 2100,
      targetValue: 2000,
      importanceWeight: 5,
      unit: "km"
    });
    expect(score).toBe(5);
  });

  it("honors an explicit scaleType='limit' regardless of unit", () => {
    const score = computeTaskScore({
      actualValue: 2100,
      targetValue: 2000,
      importanceWeight: 5,
      scaleType: "limit"
    });
    expect(score).toBeCloseTo(4.75, 5);
  });
});

describe("computeTaskScore — avoid scale", () => {
  // An avoid-scale task: full weight when the user avoided the thing that day,
  // 0 when they slipped. A common inversion bug is to swap these — these tests
  // pin the semantics: avoided (actualValue === 0) = full, slipped (> 0) = 0.
  it("scores the full importance weight when avoided (actualValue === 0)", () => {
    const score = computeTaskScore({
      actualValue: 0,
      targetValue: 1,
      importanceWeight: 4,
      scaleType: "avoid"
    });
    expect(score).toBe(4);
  });

  it("scores 0 when slipped (actualValue > 0)", () => {
    const score = computeTaskScore({
      actualValue: 1,
      targetValue: 1,
      importanceWeight: 4,
      scaleType: "avoid"
    });
    expect(score).toBe(0);
  });

  it("scores 0 when slipped by any positive amount (not just the target)", () => {
    const score = computeTaskScore({
      actualValue: 3,
      targetValue: 1,
      importanceWeight: 4,
      scaleType: "avoid"
    });
    expect(score).toBe(0);
  });

  it("scores 0 when unlogged / end-of-day with no log (actualValue === null)", () => {
    const score = computeTaskScore({
      actualValue: null,
      targetValue: 1,
      importanceWeight: 4,
      scaleType: "avoid"
    });
    expect(score).toBe(0);
  });

  it("does not invert: avoided ≠ 0 and slipped ≠ full weight", () => {
    const avoided = computeTaskScore({
      actualValue: 0,
      targetValue: 1,
      importanceWeight: 4,
      scaleType: "avoid"
    });
    const slipped = computeTaskScore({
      actualValue: 1,
      targetValue: 1,
      importanceWeight: 4,
      scaleType: "avoid"
    });
    expect(avoided).toBe(4);
    expect(slipped).toBe(0);
    expect(avoided).toBeGreaterThan(slipped);
  });
});

describe("computeTaskScore — restriction scale (count unit)", () => {
  // "check phone at most once a day" — a count-based restriction. Strict
  // pass/fail: at or under the cap ⇒ full weight; over by even one ⇒ 0 (no
  // partial credit). Meeting the cap exactly is a PASS, not a fail.
  const restrictionCount = (actualValue: number | null) =>
    computeTaskScore({
      actualValue,
      targetValue: 1,
      importanceWeight: 4,
      unit: "count",
      scaleType: "restriction"
    });

  it("scores the full weight when exactly at the limit (boundary)", () => {
    expect(restrictionCount(1)).toBe(4);
  });

  it("scores the full weight when under the limit", () => {
    expect(restrictionCount(0)).toBe(4);
  });

  it("scores exactly 0 when over the limit by one (no partial credit)", () => {
    expect(restrictionCount(2)).toBe(0);
  });

  it("scores exactly 0 when over the limit by more", () => {
    expect(restrictionCount(10)).toBe(0);
  });

  it("scores 0 when unlogged (end-of-day, no log)", () => {
    expect(restrictionCount(null)).toBe(0);
  });

  it("scores the full weight for a LOGGED 0 (did zero of the restricted thing)", () => {
    // A logged 0 is a success (well under the cap), not a no-progress value —
    // distinct from an unlogged day, which is 0. This is why the restriction
    // branch runs before the shared null/<=0 guard.
    expect(restrictionCount(0)).toBe(4);
  });
});

describe("computeTaskScore — restriction scale (hours unit)", () => {
  // "restrict social media to at most 1 hour a day" — a duration-based
  // restriction. Graduated partial credit using the same formula as the limit
  // scale: overageRatio = max(0, actual-target)/target; score =
  // weight * clamp(1 - overageRatio, 0, 1). Meeting the cap exactly is full
  // weight, not a fail.
  const restrictionHours = (actualValue: number | null) =>
    computeTaskScore({
      actualValue,
      targetValue: 1,
      importanceWeight: 4,
      unit: "hours",
      scaleType: "restriction"
    });

  it("scores the full weight when exactly at the limit (boundary)", () => {
    expect(restrictionHours(1)).toBe(4);
  });

  it("scores the full weight when under the limit", () => {
    expect(restrictionHours(0.5)).toBe(4);
  });

  it("gives graduated partial credit when over (1.5h over a 1h cap → 2)", () => {
    // overageRatio = 0.5/1 = 0.5 → 4 * (1 - 0.5) = 2
    expect(restrictionHours(1.5)).toBeCloseTo(2, 5);
  });

  it("scores exactly 0 when the overage equals the cap (2h over 1h)", () => {
    // overageRatio = 1/1 = 1 → 4 * 0 = 0
    expect(restrictionHours(2)).toBe(0);
  });

  it("never goes below 0 for an extreme overage", () => {
    expect(restrictionHours(10)).toBe(0);
  });

  it("scores 0 when unlogged (end-of-day, no log)", () => {
    expect(restrictionHours(null)).toBe(0);
  });

  it("matches the limit-scale formula for the same inputs", () => {
    // A restriction task with a non-count unit must behave identically to a
    // limit task with the same numbers — the only difference is the count
    // strict pass/fail path, which this branch does not take.
    const inputs = [0.5, 1, 1.5, 2, 3] as const;
    for (const actual of inputs) {
      const restriction = computeTaskScore({
        actualValue: actual,
        targetValue: 1,
        importanceWeight: 4,
        unit: "hours",
        scaleType: "restriction"
      });
      const limit = computeTaskScore({
        actualValue: actual,
        targetValue: 1,
        importanceWeight: 4,
        scaleType: "limit"
      });
      expect(restriction).toBe(limit);
    }
  });
});

describe("computeTaskScore — restriction scale boundary across branches", () => {
  it("actualValue == targetValue scores full points in both the count and non-count branches", () => {
    const countAtBoundary = computeTaskScore({
      actualValue: 1,
      targetValue: 1,
      importanceWeight: 5,
      unit: "count",
      scaleType: "restriction"
    });
    const hoursAtBoundary = computeTaskScore({
      actualValue: 1,
      targetValue: 1,
      importanceWeight: 5,
      unit: "hours",
      scaleType: "restriction"
    });
    expect(countAtBoundary).toBe(5);
    expect(hoursAtBoundary).toBe(5);
    // Neither branch treats meeting the cap as a fail.
    expect(countAtBoundary).toBeGreaterThan(0);
    expect(hoursAtBoundary).toBeGreaterThan(0);
  });
});

describe("computeDailyRating", () => {
  it("returns 0.0 for an empty (missed) day", () => {
    const result = computeDailyRating([], "2024-01-01");
    expect(result.rating).toBe(0);
    expect(result.taskCount).toBe(0);
    expect(result.totalWeight).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  it("computes 10.0 when every task is fully completed", () => {
    const result = computeDailyRating(
      [
        { actualValue: 10, targetValue: 10, importanceWeight: 2 },
        { actualValue: 5, targetValue: 5, importanceWeight: 3 }
      ],
      "2024-01-01"
    );
    expect(result.rating).toBeCloseTo(10, 5);
    expect(result.taskCount).toBe(2);
    expect(result.totalWeight).toBe(5);
    expect(result.totalScore).toBe(5);
  });

  it("weights tasks by importance_weight in the daily average", () => {
    const result = computeDailyRating(
      [
        { actualValue: 5, targetValue: 10, importanceWeight: 2 },
        { actualValue: 10, targetValue: 10, importanceWeight: 3 }
      ],
      "2024-01-01"
    );
    expect(result.totalScore).toBeCloseTo(1 + 3, 5);
    expect(result.totalWeight).toBe(5);
    expect(result.rating).toBeCloseTo((4 / 5) * 10, 5);
  });

  it("caps each task at its weight before summing", () => {
    const result = computeDailyRating(
      [
        { actualValue: 100, targetValue: 10, importanceWeight: 2 },
        { actualValue: 5, targetValue: 10, importanceWeight: 3 }
      ],
      "2024-01-01"
    );
    expect(result.totalScore).toBeCloseTo(2 + 1.5, 5);
    expect(result.totalWeight).toBe(5);
    expect(result.rating).toBeCloseTo((3.5 / 5) * 10, 5);
  });

  it("treats null actuals as zero contributions", () => {
    const result = computeDailyRating(
      [
        { actualValue: null, targetValue: 10, importanceWeight: 2 },
        { actualValue: 10, targetValue: 10, importanceWeight: 3 }
      ],
      "2024-01-01"
    );
    expect(result.totalScore).toBe(3);
    expect(result.totalWeight).toBe(5);
    expect(result.rating).toBeCloseTo(6, 5);
  });

  it("returns 0.0 when total weight sums to 0", () => {
    const result = computeDailyRating(
      [
        { actualValue: 5, targetValue: 10, importanceWeight: 0 },
        { actualValue: 5, targetValue: 10, importanceWeight: 0 }
      ],
      "2024-01-01"
    );
    expect(result.rating).toBe(0);
    expect(result.totalWeight).toBe(0);
  });

  it("throws when tasks span multiple PKT dates via computeDailyRatingForTasks", () => {
    expect(() =>
      computeDailyRatingForTasks([
        {
          actualValue: 5,
          targetValue: 10,
          importanceWeight: 2,
          scheduledForPktDate: "2024-01-01"
        },
        {
          actualValue: 5,
          targetValue: 10,
          importanceWeight: 2,
          scheduledForPktDate: "2024-01-02"
        }
      ])
    ).toThrowError(/scheduledForPktDate/);
  });
});

describe("computeSeasonRating", () => {
  it("averages daily ratings across all active days, with missed days pulling the average down", () => {
    const result = computeSeasonRating({
      dailyRatings: [
        { pktDate: "2024-01-01", rating: 10 },
        { pktDate: "2024-01-02", rating: 5 },
        { pktDate: "2024-01-04", rating: 7.5 }
      ],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-04",
      includedDays: INCLUDED_DAYS_ALL
    });

    expect(result.activeDayCount).toBe(4);
    expect(result.loggedDayCount).toBe(3);
    expect(result.missedDayCount).toBe(1);
    expect(result.rating).toBeCloseTo((10 + 5 + 0 + 7.5) / 4, 5);
  });

  it("returns 0.0 for a season with no logged days", () => {
    const result = computeSeasonRating({
      dailyRatings: [],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-07",
      includedDays: INCLUDED_DAYS_ALL
    });
    expect(result.activeDayCount).toBe(7);
    expect(result.loggedDayCount).toBe(0);
    expect(result.missedDayCount).toBe(7);
    expect(result.rating).toBe(0);
  });

  it("counts only Mon-Fri when includedDays = Mon-Fri bitmask", () => {
    const result = computeSeasonRating({
      dailyRatings: [
        { pktDate: "2024-01-01", rating: 10 },
        { pktDate: "2024-01-02", rating: 8 }
      ],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-07",
      includedDays: INCLUDED_DAYS_MON_FRI
    });
    expect(result.activeDayCount).toBe(5);
    expect(result.loggedDayCount).toBe(2);
    expect(result.missedDayCount).toBe(3);
    expect(result.rating).toBeCloseTo((10 + 8) / 5, 5);
  });

  it("excludes an arbitrary subset (only Tue/Thu) from the average entirely", () => {
    // 2024-01-01 is Mon, 02 Tue, 03 Wed, 04 Thu, 05 Fri, 06 Sat, 07 Sun.
    // Tue = bit 2, Thu = bit 4 → (1<<2) | (1<<4) = 4 | 16 = 20.
    const tueThu = 20;
    const result = computeSeasonRating({
      dailyRatings: [
        { pktDate: "2024-01-02", rating: 10 },
        { pktDate: "2024-01-04", rating: 6 }
      ],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-07",
      includedDays: tueThu
    });
    expect(result.activeDayCount).toBe(2);
    expect(result.loggedDayCount).toBe(2);
    expect(result.missedDayCount).toBe(0);
    expect(result.rating).toBeCloseTo((10 + 6) / 2, 5);
  });

  it("treats an out-of-range daily rating as a missed day (does not contribute)", () => {
    const result = computeSeasonRating({
      dailyRatings: [
        { pktDate: "2024-01-01", rating: 10 },
        { pktDate: "2024-12-31", rating: 10 }
      ],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-03",
      includedDays: INCLUDED_DAYS_ALL
    });
    expect(result.activeDayCount).toBe(3);
    expect(result.loggedDayCount).toBe(1);
    expect(result.rating).toBeCloseTo(10 / 3, 5);
  });

  it("returns 0 when the season range is empty", () => {
    const result = computeSeasonRating({
      dailyRatings: [],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-01",
      includedDays: INCLUDED_DAYS_ALL
    });
    expect(result.activeDayCount).toBe(1);
    expect(result.loggedDayCount).toBe(0);
    expect(result.rating).toBe(0);
  });

  it("throws when start is after end", () => {
    expect(() =>
      computeSeasonRating({
        dailyRatings: [],
        startPktDate: "2024-02-01",
        endPktDate: "2024-01-01",
        includedDays: INCLUDED_DAYS_ALL
      })
    ).toThrowError(/must not be after end/);
  });
});
