import { PKT_UTC_OFFSET_HOURS, type PktDateString } from "@momentum/shared-types";

const PKT_OFFSET_MS = PKT_UTC_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PKT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function countPktDaysInRange(
  startInclusive: Date,
  endInclusive: Date,
  weekdaysOnly = false
): number {
  return eachPktDayInRange(startInclusive, endInclusive, weekdaysOnly).length;
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
