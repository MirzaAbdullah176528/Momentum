import { PKT_UTC_OFFSET_HOURS, type PktDateString } from "@momentum/shared-types";

const PKT_OFFSET_MS = PKT_UTC_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PKT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_BITMASK = 0b1111111;

export function toPktWallClock(date: Date): Date {
  return new Date(date.getTime() + PKT_OFFSET_MS);
}

export function fromPktWallClockToUtc(pktWallClock: Date): Date {
  return new Date(pktWallClock.getTime() - PKT_OFFSET_MS);
}

export function pktDateString(date: Date): PktDateString {
  const pkt = toPktWallClock(date);
  const year = pkt.getUTCFullYear();
  const month = String(pkt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(pkt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function pktWeekday(date: Date): number {
  return toPktWallClock(date).getUTCDay();
}

export function isPktWeekend(date: Date): boolean {
  const day = pktWeekday(date);
  return day === 0 || day === 6;
}

/**
 * True when the weekday of `date` (in PKT) is set in the `includedDays`
 * 7-bit bitmask (bit N = `Date#getDay()`, 0 = Sunday .. 6 = Saturday).
 * An excluded day never counts toward an average.
 */
export function isPktDayIncluded(date: Date, includedDays: number): boolean {
  return ((includedDays & WEEK_BITMASK) >> pktWeekday(date)) % 2 === 1;
}

/** Normalizes any included-days value into a valid 7-bit bitmask. */
export function normalizeIncludedDays(includedDays: number): number {
  const value = Number.isFinite(includedDays) ? Math.trunc(includedDays) : 0;
  if (value < 0) return 0;
  if (value > WEEK_BITMASK) return WEEK_BITMASK;
  return value;
}

export function pktDayStart(date: Date): Date {
  const pkt = toPktWallClock(date);
  const startOfPktDayUtcMs = Date.UTC(
    pkt.getUTCFullYear(),
    pkt.getUTCMonth(),
    pkt.getUTCDate()
  );
  return new Date(startOfPktDayUtcMs - PKT_OFFSET_MS);
}

export function pktDayEnd(date: Date): Date {
  return new Date(pktDayStart(date).getTime() + DAY_MS - 1);
}

export function pktNextDay(date: Date): Date {
  return new Date(pktDayStart(date).getTime() + DAY_MS);
}

export function pktPreviousDay(date: Date): Date {
  return new Date(pktDayStart(date).getTime() - DAY_MS);
}

/** Returns the PKT day that is `days` calendar days after `date` (can be negative). */
export function addPktDays(date: Date, days: number): Date {
  return new Date(pktDayStart(date).getTime() + days * DAY_MS);
}

/** Adds `days` calendar days to a PKT date string, returning a new PKT date string. */
export function addPktDaysToDate(dateString: PktDateString, days: number): PktDateString {
  return pktDateString(addPktDays(parsePktDateString(dateString), days));
}

export function parsePktDateString(dateString: string): Date {
  const match = PKT_DATE_PATTERN.exec(dateString);
  if (!match) {
    throw new Error(
      `Invalid PKT date string: "${dateString}". Expected format YYYY-MM-DD.`
    );
  }
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid PKT month in "${dateString}": ${month}.`);
  }
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error(
      `Invalid PKT day in "${dateString}": ${day} (month ${month} has ${maxDay} days).`
    );
  }

  const startOfPktDayUtcMs = Date.UTC(year, month - 1, day);
  return new Date(startOfPktDayUtcMs - PKT_OFFSET_MS);
}

export function isPktDateString(value: string): value is PktDateString {
  if (!PKT_DATE_PATTERN.test(value)) return false;
  try {
    parsePktDateString(value);
    return true;
  } catch {
    return false;
  }
}

export function eachPktDayInRange(
  startInclusive: Date,
  endInclusive: Date,
  weekdaysOnly = false
): Date[] {
  const days: Date[] = [];
  const startInstant = pktDayStart(startInclusive).getTime();
  const endInstant = pktDayStart(endInclusive).getTime();

  if (startInstant > endInstant) {
    return days;
  }

  for (let t = startInstant; t <= endInstant; t += DAY_MS) {
    const current = new Date(t);
    if (!weekdaysOnly || !isPktWeekend(current)) {
      days.push(current);
    }
  }
  return days;
}


export function eachPktDayInRangeWithIncludedDays(
  startInclusive: Date,
  endInclusive: Date,
  includedDays: number
): Date[] {
  const mask = normalizeIncludedDays(includedDays);
  const days: Date[] = [];
  const startInstant = pktDayStart(startInclusive).getTime();
  const endInstant = pktDayStart(endInclusive).getTime();

  if (startInstant > endInstant) {
    return days;
  }

  for (let t = startInstant; t <= endInstant; t += DAY_MS) {
    const current = new Date(t);
    if (isPktDayIncluded(current, mask)) {
      days.push(current);
    }
  }
  return days;
}

export function countPktDaysInRange(
  startInclusive: Date,
  endInclusive: Date,
  weekdaysOnly = false
): number {
  return eachPktDayInRange(startInclusive, endInclusive, weekdaysOnly).length;
}

export function countPktDaysInRangeWithIncludedDays(
  startInclusive: Date,
  endInclusive: Date,
  includedDays: number
): number {
  return eachPktDayInRangeWithIncludedDays(
    startInclusive,
    endInclusive,
    includedDays
  ).length;
}

export function comparePktDateStrings(a: PktDateString, b: PktDateString): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function nowPktDateString(now: Date = new Date()): PktDateString {
  return pktDateString(now);
}

export function todayPktStart(now: Date = new Date()): Date {
  return pktDayStart(now);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap =
      (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  const thirtyDayMonths = [4, 6, 9, 11];
  return thirtyDayMonths.includes(month) ? 30 : 31;
}
