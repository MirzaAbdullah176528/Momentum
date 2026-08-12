"use client";

import { useState } from "react";
import { Check, Plus, Trash2, Loader2 } from "lucide-react";
import type { SeasonFinalGoalDTO } from "@momentum/shared-types";
import { FINAL_GOAL_TEXT_MAX, FINAL_GOALS_MAX } from "@momentum/shared-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FinalGoalsSectionProps {
  seasonId: string;
  goals: SeasonFinalGoalDTO[];
  onAdd: (text: string) => Promise<void>;
  onToggle: (goalId: string, completed: boolean) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}

/**
 * Standalone final-goals checklist. These are free-text, user-defined items
 * set up during Start Challenge and checked off manually anytime during the
 * season. They are NOT scored by the rating engine — just done/not-done — so
 * this section is visually and logically separate from the rating system.
 */
export function FinalGoalsSection({
  seasonId,
  goals,
  onAdd,
  onToggle,
  onDelete
}: FinalGoalsSectionProps) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedCount = goals.filter((g) => g.completed).length;
  const totalCount = goals.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setAdding(true);
    setError(null);
    try {
      await onAdd(text);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add goal.");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (goal: SeasonFinalGoalDTO) => {
    setPendingId(goal.id);
    setError(null);
    try {
      await onToggle(goal.id, !goal.completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update goal.");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (goalId: string) => {
    setPendingId(goalId);
    setError(null);
    try {
      await onDelete(goalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete goal.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section
      className="liquid-glass p-6 space-y-4"
      aria-labelledby={`final-goals-heading-${seasonId}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2
            id={`final-goals-heading-${seasonId}`}
            className="text-lg font-semibold text-liquid-text"
          >
            Final Goals
          </h2>
          <p className="text-xs text-liquid-text-subtle">
            Your own checklist — tracked as done/not-done, not scored by ratings.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-liquid-text tabular-nums">
            {completedCount}
            <span className="text-liquid-text-subtle">/{totalCount}</span>
          </div>
          <div className="text-[10px] text-liquid-text-subtle uppercase tracking-wide">
            completed
          </div>
        </div>
      </div>

      <div
        className="h-2 rounded-full bg-white/[0.06] overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completedCount} of ${totalCount} final goals completed`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-liquid-success to-emerald-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-liquid-text-subtle py-2">
          No final goals yet. Add one below to track your season finish line.
        </p>
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => {
            const busy = pendingId === goal.id;
            return (
              <li
                key={goal.id}
                className="liquid-glass-subtle p-3 rounded-xl flex items-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(goal)}
                  disabled={busy}
                  aria-pressed={goal.completed}
                  aria-label={
                    goal.completed
                      ? `Mark "${goal.text}" as not done`
                      : `Mark "${goal.text}" as done`
                  }
                  className={cn(
                    "w-6 h-6 rounded-md border flex items-center justify-center transition-all shrink-0",
                    goal.completed
                      ? "bg-liquid-success border-liquid-success text-white"
                      : "border-liquid-border text-transparent hover:border-liquid-accent",
                    busy && "opacity-50"
                  )}
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                </button>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    goal.completed
                      ? "text-liquid-text-subtle line-through"
                      : "text-liquid-text"
                  )}
                >
                  {goal.text}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(goal.id)}
                  disabled={busy}
                  aria-label={`Delete goal "${goal.text}"`}
                  className="text-liquid-text-subtle hover:text-liquid-danger transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a final goal…"
          maxLength={FINAL_GOAL_TEXT_MAX}
          disabled={adding || goals.length >= FINAL_GOALS_MAX}
          className="flex-1"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={adding || !draft.trim() || goals.length >= FINAL_GOALS_MAX}
        >
          {adding ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="w-4 h-4" aria-hidden="true" />
          )}
          Add
        </Button>
      </form>

      {goals.length >= FINAL_GOALS_MAX && (
        <p className="text-xs text-liquid-text-subtle">
          Final goals limit ({FINAL_GOALS_MAX}) reached.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-liquid-danger">
          {error}
        </p>
      )}
    </section>
  );
}
