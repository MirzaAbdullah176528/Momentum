"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import {
  TASK_UNITS,
  TASK_IMPORTANCE_WEIGHT_MIN,
  TASK_IMPORTANCE_WEIGHT_MAX,
  type TaskDTO,
  type TaskUnit,
  type ScaleType,
  type ProjectDTO,
  type CreateTaskInputDTO,
  type UpdateTaskInputDTO
} from "@momentum/shared-types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  projects: ProjectDTO[];
  task?: TaskDTO | null;
  defaultProjectId?: string;
  /** When true (and editing), the task's normally-locked fields
   * (target/unit/importanceWeight) become editable. This is the season-day-1
   * unlock window; false on every other day and when there's no active season. */
  canEditLockedFields?: boolean;
}

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Human-readable labels + hints for each scoring scale, shown in the modal's
// scale selector. Order follows SCALE_TYPES (target, limit, avoid, restriction).
const SCALE_OPTIONS = [
  {
    value: "target",
    label: "Target — reach a goal",
    hint: "More is better (e.g. run 5 km)."
  },
  {
    value: "limit",
    label: "Limit — don't exceed",
    hint: "Stay under a cap (e.g. ≤ 2000 cal)."
  },
  {
    value: "avoid",
    label: "Avoid — don't do it",
    hint: "Log 0 to pass; any value fails."
  },
  {
    value: "restriction",
    label: "Restriction — cap with penalty",
    hint: "Count = strict pass/fail; other units = graduated."
  }
] as const satisfies readonly { value: ScaleType; label: string; hint: string }[];

export function TaskModal({
  open,
  onClose,
  onSaved,
  projects,
  task,
  defaultProjectId,
  canEditLockedFields = false
}: TaskModalProps) {
  const isEditing = Boolean(task);
  // Locked fields are only editable when editing an existing task during the
  // season-day-1 unlock window.
  const lockedFieldsEditable = isEditing && canEditLockedFields;
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [title, setTitle] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState<TaskUnit>("count");
  const [scaleType, setScaleType] = useState<ScaleType>("target");
  const [importanceWeight, setImportanceWeight] = useState("3");
  const [scheduledStart, setScheduledStart] = useState("06:00");
  const [scheduledEnd, setScheduledEnd] = useState("07:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (task) {
        setProjectId(task.projectId);
        setTitle(task.title);
        setTargetValue(String(task.targetValue));
        setUnit(task.unit);
        setScaleType(task.scaleType);
        setImportanceWeight(String(task.importanceWeight));
        setScheduledStart(task.scheduledStart);
        setScheduledEnd(task.scheduledEnd);
      } else {
        setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
        setTitle("");
        setTargetValue("");
        setUnit("count");
        setScaleType("target");
        setImportanceWeight("3");
        setScheduledStart("06:00");
        setScheduledEnd("07:00");
      }
      setError(null);
    }
  }, [open, task, defaultProjectId, projects]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing && task) {
        const update: UpdateTaskInputDTO = {
          title,
          scheduledStart,
          scheduledEnd
        };
        if (lockedFieldsEditable) {
          const target = Number(targetValue);
          if (!Number.isFinite(target) || target <= 0) {
            setError("Target value must be a positive number.");
            setSaving(false);
            return;
          }
          update.targetValue = target;
          update.unit = unit;
          update.scaleType = scaleType;
          update.importanceWeight = Number(importanceWeight);
        }
        await api.tasks.update(task.id, update);
      } else {
        const target = Number(targetValue);
        if (!Number.isFinite(target) || target <= 0) {
          setError("Target value must be a positive number.");
          setSaving(false);
          return;
        }
        if (!HH_MM_REGEX.test(scheduledStart) || !HH_MM_REGEX.test(scheduledEnd)) {
          setError("Scheduled times must be in HH:MM format (24-hour).");
          setSaving(false);
          return;
        }
        const input: CreateTaskInputDTO = {
          projectId,
          title,
          targetValue: target,
          unit,
          scaleType,
          importanceWeight: Number(importanceWeight),
          scheduledStart,
          scheduledEnd
        };
        await api.tasks.create(input);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit task" : "New task"}
      description={
        isEditing
          ? "Target, unit, and weight are locked after creation."
          : "Create a task to track in your daily routine."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          disabled={isEditing}
          required
        />

        <Input
          label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Run 5km"
          required
          maxLength={280}
        />

        <Select
          label="Scoring scale"
          value={scaleType}
          onChange={(e) => setScaleType(e.target.value as ScaleType)}
          options={SCALE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          disabled={isEditing && !lockedFieldsEditable}
        />
        <p className="-mt-2 text-xs text-liquid-text-subtle">
          {SCALE_OPTIONS.find((o) => o.value === scaleType)?.hint}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Target value"
            type="number"
            step="0.1"
            min="0.1"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="5"
            disabled={isEditing && !lockedFieldsEditable}
            required={!isEditing || lockedFieldsEditable}
          />
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as TaskUnit)}
            options={TASK_UNITS.map((u) => ({ value: u, label: u }))}
            disabled={isEditing && !lockedFieldsEditable}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Importance weight (1–5)"
            type="number"
            min={TASK_IMPORTANCE_WEIGHT_MIN}
            max={TASK_IMPORTANCE_WEIGHT_MAX}
            step="1"
            value={importanceWeight}
            onChange={(e) => setImportanceWeight(e.target.value)}
            disabled={isEditing && !lockedFieldsEditable}
            required={!isEditing || lockedFieldsEditable}
          />
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-liquid-text-secondary">
              <Lock className="w-3 h-3 inline mr-1" aria-hidden="true" />
              {isEditing
                ? lockedFieldsEditable
                  ? "Editable today"
                  : "Locked"
                : "Set at creation"}
            </span>
            <div className="h-[42px] flex items-center px-4 text-xs text-liquid-text-subtle rounded-xl border border-liquid-border bg-white/[0.02]">
              {isEditing
                ? lockedFieldsEditable
                  ? "Season day 1 — locked fields editable today"
                  : "Immutable after creation"
                : "Choose carefully — cannot change later"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Scheduled start"
            type="time"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
            required
          />
          <Input
            label="Scheduled end"
            type="time"
            value={scheduledEnd}
            onChange={(e) => setScheduledEnd(e.target.value)}
            required
          />
        </div>

        {isEditing && (
          <div className="rounded-xl border border-liquid-border bg-white/[0.02] p-3 space-y-1">
            <p className="text-xs font-medium text-liquid-text-secondary flex items-center gap-1.5">
              <Lock className="w-3 h-3" aria-hidden="true" />
              {lockedFieldsEditable ? "Season day 1" : "Immutable fields"}
            </p>
            <p className="text-xs text-liquid-text-subtle">
              {lockedFieldsEditable
                ? `Target (${task?.targetValue} ${task?.unit}), unit, and importance weight (${task?.importanceWeight}) are editable today only — the first day of your active season.`
                : `Target (${task?.targetValue} ${task?.unit}), unit, and importance weight (${task?.importanceWeight}) are locked. Delete and recreate the task to change them.`}
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2 text-sm text-liquid-danger bg-liquid-danger/10 border border-liquid-danger/30 rounded-lg px-3 py-2.5"
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0">⚠</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="flex-1"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={saving || (!isEditing && projects.length === 0)}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Create task"
            )}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
