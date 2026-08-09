"use client";

import { useMemo } from "react";
import { useAsyncData } from "@/hooks/use-async-data";
import { api } from "@/lib/api";
import { nowPktDateString } from "@momentum/rating-engine";
import { RatingBadge, RatingCell } from "@/components/ui/rating";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Trophy, Target, CalendarDays } from "lucide-react";

export default function SeasonPage() {
  const today = useMemo(() => nowPktDateString(), []);
  const seasonData = useAsyncData(() => api.seasons.current(), []);

  const season = seasonData.data;

  const calendarWeeks = useMemo(() => {
    if (!season) return [];
    const days = season.dailyRatings;
    if (days.length === 0) return [];

    const firstDay = days[0];
    if (!firstDay) return [];
    const firstDate = new Date(firstDay.pktDate + "T00:00:00Z");
    const startWeekday = firstDate.getUTCDay();

    const cells: (typeof firstDay | null)[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    cells.push(...days);

    const weeks: (typeof firstDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [season]);

  if (seasonData.loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (seasonData.error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <ErrorState
          title="Couldn't load season"
          message={seasonData.error}
          onRetry={seasonData.refetch}
        />
      </div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <EmptyState
          icon={<CalendarDays className="w-6 h-6 text-liquid-accent" />}
          title="No active season"
          message="Create a season in Settings to start tracking your daily ratings over time and work toward a reward."
        />
      </div>
    );
  }

  const progressPct = Math.min(
    100,
    (season.runningAverage / season.targetRating) * 100
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-liquid-text-muted">
          {season.season.startDate} → {season.season.endDate}
        </p>
        <h1 className="text-2xl font-bold text-liquid-text">Season Overview</h1>
      </header>

      <section
        className="liquid-glass-strong p-6 space-y-4"
        aria-labelledby="season-summary"
      >
        <h2 id="season-summary" className="sr-only">
          Season summary
        </h2>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-liquid-text-muted uppercase tracking-wide">
              Running Average
            </p>
            <RatingBadge rating={season.runningAverage} size="lg" showLabel />
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-liquid-text-muted" aria-hidden="true" />
              <span className="text-sm text-liquid-text-muted">
                Target: {season.targetRating.toFixed(1)}
              </span>
            </div>
            <Badge tone={season.rewardAchieved ? "success" : "neutral"}>
              <Trophy className="w-3 h-3" aria-hidden="true" />
              {season.rewardAchieved ? "Reward earned!" : "In progress"}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div
            className="h-3 rounded-full bg-white/[0.06] overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Season progress: ${progressPct.toFixed(1)}% of target rating`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-liquid-accent to-sky-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-liquid-text-subtle">
            <span>{progressPct.toFixed(1)}% of target</span>
            <span>{season.daysRemaining} days remaining</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="liquid-glass-subtle p-3 text-center">
            <div className="text-2xl font-bold text-liquid-text tabular-nums">
              {season.activeDayCount}
            </div>
            <div className="text-xs text-liquid-text-subtle">Active days</div>
          </div>
          <div className="liquid-glass-subtle p-3 text-center">
            <div className="text-2xl font-bold text-liquid-success tabular-nums">
              {season.loggedDayCount}
            </div>
            <div className="text-xs text-liquid-text-subtle">Logged</div>
          </div>
          <div className="liquid-glass-subtle p-3 text-center">
            <div className="text-2xl font-bold text-liquid-warning tabular-nums">
              {season.missedDayCount}
            </div>
            <div className="text-xs text-liquid-text-subtle">Missed</div>
          </div>
        </div>
      </section>

      <section
        className="liquid-glass p-6 space-y-4"
        aria-labelledby="calendar-heading"
      >
        <div className="flex items-center justify-between">
          <h2
            id="calendar-heading"
            className="text-lg font-semibold text-liquid-text"
          >
            Daily Ratings
          </h2>
          <div className="text-sm text-liquid-text-muted">
            Reward: {season.season.rewardText}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[280px]">
            <div
              className="grid grid-cols-7 gap-1 mb-2"
              role="row"
              aria-hidden="true"
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs text-liquid-text-subtle font-medium py-1"
                >
                  {d}
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-7 gap-1"
              role="grid"
              aria-label="Daily ratings calendar"
            >
              {calendarWeeks.flat().map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="aspect-square"
                      aria-hidden="true"
                    />
                  );
                }
                const isToday = day.pktDate === today;
                const dayNum = Number(day.pktDate.slice(-2));
                return (
                  <div key={day.pktDate} className="relative">
                    <RatingCell
                      rating={day.rating}
                      date={day.pktDate}
                      className={isToday ? "ring-2 ring-liquid-accent" : ""}
                    />
                    <span
                      className="absolute top-1 left-1 text-[10px] text-liquid-text-subtle pointer-events-none"
                      aria-hidden="true"
                    >
                      {dayNum}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
