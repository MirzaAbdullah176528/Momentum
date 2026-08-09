import { describe, it, expect } from "vitest";
import {
  toPktWallClock,
  fromPktWallClockToUtc,
  pktDateString,
  pktWeekday,
  isPktWeekend,
  pktDayStart,
  pktDayEnd,
  pktNextDay,
  pktPreviousDay,
  parsePktDateString,
  isPktDateString,
  eachPktDayInRange,
  countPktDaysInRange,
  comparePktDateStrings,
  nowPktDateString
} from "./pkt.js";

describe("PKT wall-clock conversion", () => {
  it("shifts UTC forward by 5 hours", () => {
    const utc = new Date("2024-01-01T20:00:00Z");
    const pkt = toPktWallClock(utc);
    expect(pkt.toISOString()).toBe("2024-01-02T01:00:00.000Z");
  });

  it("round-trips through fromPktWallClockToUtc", () => {
    const original = new Date("2024-06-15T12:34:56.789Z");
    const roundTrip = fromPktWallClockToUtc(toPktWallClock(original));
    expect(roundTrip.getTime()).toBe(original.getTime());
  });
});

describe("pktDateString", () => {
  it("returns YYYY-MM-DD in PKT wall clock", () => {
    expect(pktDateString(new Date("2024-01-01T20:00:00Z"))).toBe("2024-01-02");
  });

  it("does not roll over before 19:00 UTC the previous day", () => {
    expect(pktDateString(new Date("2024-01-01T18:59:59Z"))).toBe("2024-01-01");
    expect(pktDateString(new Date("2024-01-01T19:00:00Z"))).toBe("2024-01-02");
  });

  it("zero-pads month and day", () => {
    expect(pktDateString(new Date("2024-02-03T00:00:00Z"))).toBe("2024-02-03");
  });
});

describe("pktWeekday and isPktWeekend", () => {
  it("treats Saturday and Sunday in PKT as weekend", () => {
    const saturday = new Date("2024-01-06T03:00:00Z");
    expect(pktDateString(saturday)).toBe("2024-01-06");
    expect(pktWeekday(saturday)).toBe(6);
    expect(isPktWeekend(saturday)).toBe(true);

    const sunday = new Date("2024-01-07T03:00:00Z");
    expect(pktWeekday(sunday)).toBe(0);
    expect(isPktWeekend(sunday)).toBe(true);
  });

  it("treats Monday through Friday in PKT as weekday", () => {
    const monday = new Date("2024-01-01T03:00:00Z");
    expect(pktWeekday(monday)).toBe(1);
    expect(isPktWeekend(monday)).toBe(false);
  });
});

describe("pktDayStart and pktDayEnd", () => {
  it("returns midnight PKT (19:00 UTC the previous day)", () => {
    const start = pktDayStart(new Date("2024-01-02T03:00:00Z"));
    expect(start.toISOString()).toBe("2024-01-01T19:00:00.000Z");
  });

  it("pktDayEnd is one millisecond before the next day start", () => {
    const day = new Date("2024-01-02T03:00:00Z");
    const end = pktDayEnd(day);
    const nextStart = pktNextDay(day);
    expect(end.getTime()).toBe(nextStart.getTime() - 1);
  });

  it("pktNextDay and pktPreviousDay are symmetric", () => {
    const day = new Date("2024-01-15T03:00:00Z");
    const next = pktNextDay(day);
    expect(pktDateString(next)).toBe("2024-01-16");
    expect(pktPreviousDay(next).getTime()).toBe(pktDayStart(day).getTime());
  });
});

describe("parsePktDateString", () => {
  it("returns the UTC instant of midnight PKT for the given date", () => {
    const instant = parsePktDateString("2024-01-02");
    expect(instant.toISOString()).toBe("2024-01-01T19:00:00.000Z");
  });

  it("rejects malformed strings", () => {
    expect(() => parsePktDateString("2024-1-2")).toThrowError(/Invalid PKT/);
    expect(() => parsePktDateString("not-a-date")).toThrowError(/Invalid PKT/);
    expect(() => parsePktDateString("2024-13-01")).toThrowError(/month/);
    expect(() => parsePktDateString("2024-02-30")).toThrowError(/day/);
  });

  it("handles leap years correctly", () => {
    const leap = parsePktDateString("2024-02-29");
    expect(pktDateString(leap)).toBe("2024-02-29");
    expect(() => parsePktDateString("2023-02-29")).toThrowError(/day/);
  });
});

describe("isPktDateString", () => {
  it("accepts valid YYYY-MM-DD strings", () => {
    expect(isPktDateString("2024-01-01")).toBe(true);
    expect(isPktDateString("2024-12-31")).toBe(true);
  });

  it("rejects invalid strings without throwing", () => {
    expect(isPktDateString("2024-1-1")).toBe(false);
    expect(isPktDateString("")).toBe(false);
    expect(isPktDateString("2024-13-01")).toBe(false);
    expect(isPktDateString("hello")).toBe(false);
  });
});

describe("eachPktDayInRange and countPktDaysInRange", () => {
  it("yields inclusive PKT days between two instants", () => {
    const days = eachPktDayInRange(
      new Date("2024-01-01T03:00:00Z"),
      new Date("2024-01-05T03:00:00Z"),
      false
    );
    expect(days.map((d) => pktDateString(d))).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05"
    ]);
    expect(countPktDaysInRange(
      new Date("2024-01-01T03:00:00Z"),
      new Date("2024-01-05T03:00:00Z"),
      false
    )).toBe(5);
  });

  it("skips weekends when weekdaysOnly=true", () => {
    const days = eachPktDayInRange(
      new Date("2024-01-01T03:00:00Z"),
      new Date("2024-01-07T03:00:00Z"),
      true
    );
    expect(days.map((d) => pktDateString(d))).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05"
    ]);
  });

  it("returns an empty list when start is after end", () => {
    const days = eachPktDayInRange(
      new Date("2024-02-01T03:00:00Z"),
      new Date("2024-01-01T03:00:00Z"),
      false
    );
    expect(days).toEqual([]);
  });

  it("handles a 1-day range", () => {
    const days = eachPktDayInRange(
      new Date("2024-03-15T03:00:00Z"),
      new Date("2024-03-15T03:00:00Z"),
      false
    );
    expect(days).toHaveLength(1);
    expect(pktDateString(days[0]!)).toBe("2024-03-15");
  });
});

describe("comparePktDateStrings and nowPktDateString", () => {
  it("compares lexicographically (which equals chronologically for YYYY-MM-DD)", () => {
    expect(comparePktDateStrings("2024-01-01", "2024-01-02")).toBe(-1);
    expect(comparePktDateStrings("2024-01-02", "2024-01-02")).toBe(0);
    expect(comparePktDateStrings("2024-01-03", "2024-01-02")).toBe(1);
  });

  it("produces a stable YYYY-MM-DD for a fixed reference instant", () => {
    expect(nowPktDateString(new Date("2024-01-01T19:00:00.000Z"))).toBe("2024-01-02");
  });
});
