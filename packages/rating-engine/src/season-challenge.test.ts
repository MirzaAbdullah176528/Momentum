import { describe, it, expect } from "vitest";
import {
  resolveChallengeStartDate,
  challengeWeekRange,
  isWeekConcluded,
  isSeasonConcluded
} from "./season-challenge.js";
import { SEASON_CHALLENGE_LENGTH_DAYS } from "@momentum/shared-types";

const MS_PER_HOUR = 60 * 60 * 1000;

describe("resolveChallengeStartDate", () => {
  // todayPkt = 2026-08-12. 2026-08-12 in PKT starts at 2026-08-11T19:00:00Z.
  const todayPkt = "2026-08-12";
  const startOfPktTodayUtc = new Date("2026-08-11T19:00:00Z").getTime();

  it("starts today when the earliest scheduled_start is still upcoming today", () => {
    // Earliest task scheduled for 18:00 PKT — still upcoming at 17:00 PKT.
    const now = new Date(startOfPktTodayUtc + 17 * MS_PER_HOUR);
    const result = resolveChallengeStartDate(todayPkt, [{ scheduledStart: "18:00" }], now);
    expect(result.startDate).toBe("2026-08-12");
    expect(result.endDate).toBe("2026-09-08"); // +27 days
  });

  it("starts today when a task started 40 minutes ago (within 1-hour grace)", () => {
    // Earliest task scheduled for 06:00 PKT; now is 06:40 PKT (40 min later).
    const earliestStart = startOfPktTodayUtc + 6 * MS_PER_HOUR;
    const now = new Date(earliestStart + 40 * 60 * 1000);
    const result = resolveChallengeStartDate(todayPkt, [{ scheduledStart: "06:00" }], now);
    expect(result.startDate).toBe("2026-08-12");
    expect(result.endDate).toBe("2026-09-08");
  });

  it("starts tomorrow when a task started 3 hours ago (beyond 1-hour grace)", () => {
    // Earliest task scheduled for 06:00 PKT; now is 09:00 PKT (3 hours later).
    const earliestStart = startOfPktTodayUtc + 6 * MS_PER_HOUR;
    const now = new Date(earliestStart + 3 * MS_PER_HOUR);
    const result = resolveChallengeStartDate(todayPkt, [{ scheduledStart: "06:00" }], now);
    expect(result.startDate).toBe("2026-08-13");
    expect(result.endDate).toBe("2026-09-09");
  });

  it("starts tomorrow when there are no tasks scheduled for today at all", () => {
    const now = new Date(startOfPktTodayUtc + 3 * MS_PER_HOUR);
    const result = resolveChallengeStartDate(todayPkt, [], now);
    expect(result.startDate).toBe("2026-08-13");
  });

  it("uses the earliest scheduled_start among several tasks for today", () => {
    // Tasks at 09:00, 06:00, 21:00. Earliest = 06:00.
    // now = 06:40 → 06:00 passed by 40 min → within grace → today.
    const earliestStart = startOfPktTodayUtc + 6 * MS_PER_HOUR;
    const now = new Date(earliestStart + 40 * 60 * 1000);
    const result = resolveChallengeStartDate(
      todayPkt,
      [{ scheduledStart: "09:00" }, { scheduledStart: "06:00" }, { scheduledStart: "21:00" }],
      now
    );
    expect(result.startDate).toBe("2026-08-12");
  });

  it("ignores malformed scheduled_start values", () => {
    const now = new Date(startOfPktTodayUtc + 17 * MS_PER_HOUR);
    const result = resolveChallengeStartDate(
      todayPkt,
      [{ scheduledStart: "not-a-time" }, { scheduledStart: "18:00" }],
      now
    );
    expect(result.startDate).toBe("2026-08-12");
  });

  it("produces a 28-day span (endDate = startDate + 27 days)", () => {
    const result = resolveChallengeStartDate(todayPkt, [], new Date());
    const dayDiffMs =
      new Date(result.endDate + "T00:00:00Z").getTime() -
      new Date(result.startDate + "T00:00:00Z").getTime();
    const days = dayDiffMs / (24 * MS_PER_HOUR);
    expect(days).toBe(SEASON_CHALLENGE_LENGTH_DAYS - 1);
  });
});

describe("challengeWeekRange", () => {
  const seasonStart = "2026-08-12";

  it("week 1 starts on the season start date", () => {
    const w1 = challengeWeekRange(seasonStart, 1);
    expect(w1.startDate).toBe("2026-08-12");
    expect(w1.endDate).toBe("2026-08-18"); // +6 days
  });

  it("week 4 ends on the season end date (start + 27)", () => {
    const w4 = challengeWeekRange(seasonStart, 4);
    expect(w4.startDate).toBe("2026-09-02"); // +21 days
    expect(w4.endDate).toBe("2026-09-08"); // +27 days (season end)
  });

  it("weeks are contiguous and cover the full season without gaps", () => {
    const weeks = [1, 2, 3, 4].map((n) => challengeWeekRange(seasonStart, n));
    for (let i = 0; i < weeks.length - 1; i++) {
      const cur = weeks[i];
      const next = weeks[i + 1];
      if (!cur || !next) throw new Error("missing week");
      // Week N ends on the day before week N+1 starts (contiguous, no gaps).
      expect(cur.endDate < next.startDate).toBe(true);
    }
  });

  it("throws for weekNumber outside 1..4", () => {
    expect(() => challengeWeekRange(seasonStart, 0)).toThrow();
    expect(() => challengeWeekRange(seasonStart, 5)).toThrow();
  });
});

describe("isWeekConcluded / isSeasonConcluded", () => {
  it("marks a week as concluded once the current instant is past its last day's end", () => {
    const weekEnd = "2026-08-18";
    // 2026-08-18 PKT ends at 2026-08-18T23:59:59.999 PKT = 2026-08-18T18:59:59.999Z.
    const justBefore = new Date("2026-08-18T18:59:59.999Z");
    const justAfter = new Date("2026-08-18T19:00:00.001Z");
    expect(isWeekConcluded(weekEnd, justBefore)).toBe(false);
    expect(isWeekConcluded(weekEnd, justAfter)).toBe(true);
  });

  it("isSeasonConcluded mirrors isWeekConcluded for the season's last day", () => {
    const seasonEnd = "2026-09-08";
    const before = new Date("2026-09-08T18:59:59.999Z");
    const after = new Date("2026-09-08T19:00:00.001Z");
    expect(isSeasonConcluded(seasonEnd, before)).toBe(false);
    expect(isSeasonConcluded(seasonEnd, after)).toBe(true);
  });
});
