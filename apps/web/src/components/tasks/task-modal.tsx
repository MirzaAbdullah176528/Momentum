"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import {
  TASK_UNITS,
  TASK_IMPORTANCE_WEIGHT_MIN,
  TASK_IMPORTANCE_WEIGHT_MAX,
  type TaskDTO,
  type TaskUnit,
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
        setImportanceWeight(String(task.importanceWeight));
        setScheduledStart(task.scheduledStart);
        setScheduledEnd(task.scheduledEnd);
      } else {
        setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
        setTitle("");
        setTargetValue("");
        setUnit("count");
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
          <p
            role="alert"
            className="text-sm text-liquid-danger bg-liquid-danger/10 border border-liquid-danger/20 rounded-lg px-3 py-2"
          >
            {error}
          </p>
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
