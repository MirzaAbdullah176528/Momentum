"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Rocket, Trophy, X } from "lucide-react";
import type { StartChallengeInputDTO } from "@momentum/shared-types";
import {
  INCLUDED_DAYS_MON_FRI,
  WEEKLY_REWARD_TEXT_MAX,
  FINAL_GOAL_TEXT_MAX,
  FINAL_GOALS_MAX
} from "@momentum/shared-types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { IncludedDaysPicker } from "@/components/season/included-days-picker";

interface StartChallengeFormProps {
  onSubmit: (input: StartChallengeInputDTO) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
}

interface WeeklyRewardDraft {
  targetRating: string;
  rewardText: string;
}

interface FinalGoalDraft {
  text: string;
}

const DEFAULT_WEEKLY: WeeklyRewardDraft[] = [1, 2, 3, 4].map(() => ({
  targetRating: "8.0",
  rewardText: ""
}));

/**
 * The single Start Challenge setup flow. Collects, in one form: which weekdays
 * count toward the challenge, the overall target rating + reward, the 4 weekly
 * targets/rewards (decided upfront, not editable once the season starts), and
 * the standalone final-goals checklist. On submit the backend resolves the
 * 28-day start date from the user's tasks.
 */
export function StartChallengeForm({
  onSubmit,
  onCancel,
  submitting = false,
  error = null
}: StartChallengeFormProps) {
  const [includedDays, setIncludedDays] = useState<number>(INCLUDED_DAYS_MON_FRI);
  const [targetRating, setTargetRating] = useState("8.0");
  const [rewardText, setRewardText] = useState("");
  const [weekly, setWeekly] = useState<WeeklyRewardDraft[]>(DEFAULT_WEEKLY);
  const [finalGoals, setFinalGoals] = useState<FinalGoalDraft[]>([
    { text: "" }
  ]);
  const [localError, setLocalError] = useState<string | null>(null);

  const updateWeekly = (idx: number, patch: Partial<WeeklyRewardDraft>) => {
    setWeekly((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, ...patch } : w))
    );
  };

  const updateFinalGoal = (idx: number, text: string) => {
    setFinalGoals((prev) =>
      prev.map((g, i) => (i === idx ? { text } : g))
    );
  };

  const addFinalGoal = () => {
    setFinalGoals((prev) =>
      prev.length < FINAL_GOALS_MAX ? [...prev, { text: "" }] : prev
    );
  };

  const removeFinalGoal = (idx: number) => {
    setFinalGoals((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (includedDays === 0) {
      setLocalError("Select at least one weekday to include.");
      return;
    }

    const overallTarget = Number(targetRating);
    if (!Number.isFinite(overallTarget) || overallTarget < 0 || overallTarget > 10) {
      setLocalError("Overall target rating must be between 0 and 10.");
      return;
    }
    if (!rewardText.trim()) {
      setLocalError("Add an overall reward for completing the challenge.");
      return;
    }

    const weeklyRewards = weekly.map((w, i) => {
      const t = Number(w.targetRating);
      if (!Number.isFinite(t) || t < 0 || t > 10) {
        throw new Error(`Week ${i + 1} target rating must be between 0 and 10.`);
      }
      if (!w.rewardText.trim()) {
        throw new Error(`Add a reward for Week ${i + 1}.`);
      }
      return {
        weekNumber: i + 1,
        targetRating: t,
        rewardText: w.rewardText.trim()
      };
    });

    const cleanGoals = finalGoals
      .map((g) => g.text.trim())
      .filter((t) => t.length > 0);

    onSubmit({
      includedDays,
      targetRating: overallTarget,
      rewardText: rewardText.trim(),
      weeklyRewards,
      finalGoals: cleanGoals.map((text) => ({ text }))
    });
  };

  const displayError = localError ?? error;

  return (
    <form
      onSubmit={handleSubmit}
      className="liquid-glass-strong p-6 space-y-6"
      aria-labelledby="start-challenge-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="start-challenge-heading" className="text-xl font-bold text-liquid-text">
            Start a 4-Week Challenge
          </h2>
          <p className="text-sm text-liquid-text-muted">
            A 28-day season starts on the next eligible day based on your tasks.
            Configure everything below before you begin — weekly rewards can&apos;t be
            edited once the challenge starts.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="text-liquid-text-subtle hover:text-liquid-text"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Included days */}
      <fieldset className="space-y-3">
        <div>
          <legend className="text-sm font-medium text-liquid-text-secondary">
            Which days count toward the challenge?
          </legend>
          <p className="text-xs text-liquid-text-subtle mt-0.5">
            Excluded days never count toward your average (not even as a zero).
          </p>
        </div>
        <IncludedDaysPicker value={includedDays} onChange={setIncludedDays} />
      </fieldset>

      {/* Overall reward */}
      <fieldset className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-liquid-accent" aria-hidden="true" />
          <h3 className="text-sm font-medium text-liquid-text-secondary">
            Overall challenge reward
          </h3>
        </div>
        <Input
          label="Overall target rating (0–10)"
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={targetRating}
          onChange={(e) => setTargetRating(e.target.value)}
          required
          hint="Average you need across all 28 days."
        />
        <Textarea
          label="Overall reward"
          value={rewardText}
          onChange={(e) => setRewardText(e.target.value)}
          placeholder="e.g. A full weekend off"
          required
          maxLength={500}
          rows={2}
        />
      </fieldset>

      {/* Weekly rewards */}
      <fieldset className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-liquid-text-secondary">
            Weekly targets &amp; rewards
          </h3>
          <p className="text-xs text-liquid-text-subtle mt-0.5">
            Each week&apos;s average must hit its target to go green. Set all four now.
          </p>
        </div>
        <div className="space-y-3">
          {weekly.map((w, idx) => (
            <div
              key={idx}
              className="liquid-glass-subtle p-3 rounded-xl space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-liquid-text-muted uppercase tracking-wide">
                  Week {idx + 1}
                </span>
                <span className="text-[10px] text-liquid-text-subtle">
                  Days {idx * 7 + 1}–{(idx + 1) * 7}
                </span>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={w.targetRating}
                  onChange={(e) => updateWeekly(idx, { targetRating: e.target.value })}
                  required
                  aria-label={`Week ${idx + 1} target rating`}
                />
                <Input
                  type="text"
                  value={w.rewardText}
                  onChange={(e) => updateWeekly(idx, { rewardText: e.target.value })}
                  placeholder={`Week ${idx + 1} reward`}
                  maxLength={WEEKLY_REWARD_TEXT_MAX}
                  required
                  aria-label={`Week ${idx + 1} reward`}
                />
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {/* Final goals */}
      <fieldset className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-liquid-text-secondary">
            Final goals checklist
          </h3>
          <p className="text-xs text-liquid-text-subtle mt-0.5">
            Standalone to-dos for the season. Tracked as done/not-done — not
            scored by ratings.
          </p>
        </div>
        <div className="space-y-2">
          {finalGoals.map((g, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                type="text"
                value={g.text}
                onChange={(e) => updateFinalGoal(idx, e.target.value)}
                placeholder={`Final goal ${idx + 1}`}
                maxLength={FINAL_GOAL_TEXT_MAX}
                aria-label={`Final goal ${idx + 1}`}
                className="flex-1"
              />
              {finalGoals.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFinalGoal(idx)}
                  aria-label={`Remove final goal ${idx + 1}`}
                  className="text-liquid-text-subtle hover:text-liquid-danger transition-colors p-2"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
        {finalGoals.length < FINAL_GOALS_MAX && (
          <Button type="button" variant="ghost" size="sm" onClick={addFinalGoal}>
            + Add final goal
          </Button>
        )}
      </fieldset>

      {displayError && (
        <p role="alert" className="text-sm text-liquid-danger">
          {displayError}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Rocket className="w-4 h-4" aria-hidden="true" />
          )}
          Start Challenge
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
