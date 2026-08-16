"use client";

import { INCLUDED_DAYS_ALL, INCLUDED_DAYS_MON_FRI } from "@momentum/shared-types";
import { cn } from "@/lib/utils";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
] as const;

/** Bit N (0 = Sunday .. 6 = Saturday, matching Date#getDay()) is set when that
 * weekday counts toward the challenge. Excluded days never count toward the
 * average. 0 means "no days" and is not a valid challenge config. */
export function isWeekdayIncluded(includedDays: number, dayIndex: number): boolean {
  return ((includedDays >> dayIndex) & 1) === 1;
}

export function toggleWeekday(includedDays: number, dayIndex: number): number {
  const bit = 1 << dayIndex;
  return includedDays ^ bit;
}

interface IncludedDaysPickerProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function IncludedDaysPicker({
  value,
  onChange,
  className
}: IncludedDaysPickerProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="group"
        aria-label="Included weekdays"
        className="grid grid-cols-7 gap-1.5"
      >
        {WEEKDAY_LABELS.map((label, idx) => {
          const included = isWeekdayIncluded(value, idx);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={included}
              aria-label={`${WEEKDAY_LONG_LABELS[idx]} ${included ? "included" : "excluded"}`}
              onClick={() => onChange(toggleWeekday(value, idx))}
              className={cn(
                "h-10 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-liquid-accent",
                included
                  ? "bg-liquid-accent/85 text-white shadow-sm shadow-liquid-accent/30"
                  : "liquid-glass-subtle text-liquid-text-muted hover:text-liquid-text"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => onChange(INCLUDED_DAYS_ALL)}
          className="liquid-glass-subtle px-2.5 py-1 rounded-md text-liquid-text-muted hover:text-liquid-text"
        >
          Every day
        </button>
        <button
          type="button"
          onClick={() => onChange(INCLUDED_DAYS_MON_FRI)}
          className="liquid-glass-subtle px-2.5 py-1 rounded-md text-liquid-text-muted hover:text-liquid-text"
        >
          Mon–Fri
        </button>
        <button
          type="button"
          onClick={() => onChange(0b0111100)}
          className="liquid-glass-subtle px-2.5 py-1 rounded-md text-liquid-text-muted hover:text-liquid-text"
        >
          Mon–Thu
        </button>
        <button
          type="button"
          onClick={() => onChange(0b1111100)}
          className="liquid-glass-subtle px-2.5 py-1 rounded-md text-liquid-text-muted hover:text-liquid-text"
        >
          Mon–Sat
        </button>
      </div>
    </div>
  );
}

export function describeIncludedDays(includedDays: number): string {
  if (includedDays === INCLUDED_DAYS_ALL) return "Every day";
  const included = WEEKDAY_LABELS.filter((_, idx) =>
    isWeekdayIncluded(includedDays, idx)
  );
  if (included.length === 0) return "No days";
  return included.join("·");
}
