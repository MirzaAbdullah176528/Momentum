import { describe, it, expect } from "vitest";
import {
  computeTaskScore,
  computeDailyRating,
  computeDailyRatingForTasks,
  computeSeasonRating
} from "./rating.js";

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
      weekdaysOnly: false
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
      weekdaysOnly: false
    });
    expect(result.activeDayCount).toBe(7);
    expect(result.loggedDayCount).toBe(0);
    expect(result.missedDayCount).toBe(7);
    expect(result.rating).toBe(0);
  });

  it("counts only weekdays when weekdaysOnly=true", () => {
    const result = computeSeasonRating({
      dailyRatings: [
        { pktDate: "2024-01-01", rating: 10 },
        { pktDate: "2024-01-02", rating: 8 }
      ],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-07",
      weekdaysOnly: true
    });
    expect(result.activeDayCount).toBe(5);
    expect(result.loggedDayCount).toBe(2);
    expect(result.missedDayCount).toBe(3);
    expect(result.rating).toBeCloseTo((10 + 8) / 5, 5);
  });

  it("treats an out-of-range daily rating as a missed day (does not contribute)", () => {
    const result = computeSeasonRating({
      dailyRatings: [
        { pktDate: "2024-01-01", rating: 10 },
        { pktDate: "2024-12-31", rating: 10 }
      ],
      startPktDate: "2024-01-01",
      endPktDate: "2024-01-03",
      weekdaysOnly: false
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
      weekdaysOnly: false
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
        weekdaysOnly: false
      })
    ).toThrowError(/must not be after end/);
  });
});
