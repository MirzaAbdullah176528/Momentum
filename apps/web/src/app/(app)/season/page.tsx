"use client";

import { useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/use-async-data";
import { api } from "@/lib/api";
import { nowPktDateString } from "@momentum/rating-engine";
import type { StartChallengeInputDTO } from "@momentum/shared-types";
import { RatingBadge, RatingCell } from "@/components/ui/rating";
import { Badge } from "@/components/ui/badge";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { StartChallengeForm } from "@/components/season/start-challenge-form";
import { RewardIndicatorRow } from "@/components/season/reward-indicator-row";
import { FinalGoalsSection } from "@/components/season/final-goals-section";
import { describeIncludedDays } from "@/components/season/included-days-picker";
import { Trophy, Target, CalendarDays, Rocket } from "lucide-react";

export default function SeasonPage() {
  const today = useMemo(() => nowPktDateString(), []);
  const seasonData = useAsyncData(() => api.seasons.current(), []);
  const [showStartForm, setShowStartForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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

  const handleStartChallenge = async (input: StartChallengeInputDTO) => {
    setSubmitting(true);
    setStartError(null);
    try {
      await api.seasons.startChallenge(input);
      await seasonData.refetch();
      setShowStartForm(false);
    } catch (err) {
      setStartError(
        err instanceof Error ? err.message : "Could not start the challenge."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFinalGoal = async (text: string) => {
    if (!season) return;
    await api.seasons.addFinalGoal(season.season.id, { text });
    await seasonData.refetch();
  };

  const handleToggleFinalGoal = async (goalId: string, completed: boolean) => {
    if (!season) return;
    await api.seasons.updateFinalGoal(season.season.id, goalId, completed);
    await seasonData.refetch();
  };

  const handleDeleteFinalGoal = async (goalId: string) => {
    if (!season) return;
    await api.seasons.deleteFinalGoal(season.season.id, goalId);
    await seasonData.refetch();
  };

  if (seasonData.loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // if (seasonData.error) {
  //   return (
  //     <div className="max-w-5xl mx-auto px-4 py-6">
  //       <ErrorState
  //         title="Couldn't load season"
  //         message={seasonData.error}
  //         onRetry={seasonData.refetch}
  //       />
  //     </div>
  //   );
  // }

  // No active season → show the Start Challenge flow.
  if (!season) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-liquid-text">Season</h1>
          <p className="text-sm text-liquid-text-muted">
            No active challenge. Start a 28-day challenge to begin tracking.
          </p>
        </header>

        {!showStartForm ? (
          <section className="liquid-glass-strong p-8 space-y-4 text-center">
            <EmptyState
              icon={<CalendarDays className="w-6 h-6 text-liquid-accent" />}
              title="No active challenge"
              message="Pick your days, set 4 weekly targets, an overall goal, and a final-goals checklist — then begin."
            />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setStartError(null);
                  setShowStartForm(true);
                }}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-base font-medium bg-liquid-accent text-white shadow-lg shadow-liquid-accent/30 hover:bg-liquid-accent/90 active:scale-[0.98] transition-all"
              >
                <Rocket className="w-4 h-4" aria-hidden="true" />
                Start Challenge
              </button>
            </div>
          </section>
        ) : (
          <StartChallengeForm
            onSubmit={handleStartChallenge}
            onCancel={() => {
              setShowStartForm(false);
              setStartError(null);
            }}
            submitting={submitting}
            error={startError}
          />
        )}
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
          {season.season.startDate} → {season.season.endDate} ·{" "}
          {describeIncludedDays(season.season.includedDays)}
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

      {/* 5-indicator reward row: Week 1, Week 2, Week 3, Week 4, Overall */}
      <section
        className="liquid-glass p-6 space-y-4"
        aria-labelledby="rewards-heading"
      >
        <div className="flex items-center justify-between">
          <h2
            id="rewards-heading"
            className="text-lg font-semibold text-liquid-text"
          >
            Rewards
          </h2>
          <span className="text-xs text-liquid-text-subtle">
            Overall reward: {season.season.rewardText}
          </span>
        </div>
        <RewardIndicatorRow
          weeklyIndicators={season.weeklyRewardIndicators}
          monthlyIndicator={season.monthlyRewardIndicator}
        />
      </section>

      {/* Standalone final goals checklist */}
      <FinalGoalsSection
        seasonId={season.season.id}
        goals={season.finalGoals}
        onAdd={handleAddFinalGoal}
        onToggle={handleToggleFinalGoal}
        onDelete={handleDeleteFinalGoal}
      />

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

