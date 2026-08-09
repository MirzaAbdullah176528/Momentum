"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Check } from "lucide-react";
import type { TaskDTO, TaskBreakdownDTO } from "@momentum/shared-types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkeletonRow } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { ratingTier } from "@/components/ui/rating";

interface DailyTaskTableProps {
  date: string;
  tasks: TaskDTO[];
  breakdown: TaskBreakdownDTO[] | null;
  onLogUpdated: () => void;
  onReorder: () => void;
}

interface LogInputProps {
  taskId: string;
  date: string;
  initialActual: number | null;
  targetValue: number;
  unit: string;
  onSaved: (actualValue: number | null, taskScore: number) => void;
  announceLive: (message: string) => void;
}

function LogInput({
  taskId,
  date,
  initialActual,
  targetValue,
  unit,
  onSaved,
  announceLive
}: LogInputProps) {
  const [value, setValue] = useState(
    initialActual !== null ? String(initialActual) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null)[0];
  const lastSavedRef = useState<string | null>(null)[0];
  const setLastSavedRef = useState<string | null>(null)[1];
  const setDebounceRef = useState<ReturnType<typeof setTimeout> | null>(null)[1];

  useEffect(() => {
    setValue(initialActual !== null ? String(initialActual) : "");
  }, [initialActual]);

  const save = async (rawValue: string) => {
    setSaving(true);
    setError(null);
    const trimmed = rawValue.trim();
    const actualValue =
      trimmed === "" ? null : Number(trimmed);

    if (actualValue !== null && (!Number.isFinite(actualValue) || actualValue < 0)) {
      setError("Enter a valid number.");
      setSaving(false);
      return;
    }

    const last = lastSavedRef;
    const current = actualValue === null ? "null" : String(actualValue);
    if (last === current) {
      setSaving(false);
      return;
    }

    try {
      const result = await api.taskLogs.upsert({
        taskId,
        date,
        actualValue
      });
      onSaved(actualValue, result.taskScore ?? 0);
      setLastSavedRef(current);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      const score = result.taskScore ?? 0;
      const capped = score >= (targetValue > 0 ? 5 : 0);
      announceLive(
        `Logged ${actualValue ?? 0} ${unit} for task. Score: ${score.toFixed(2)}${capped ? " (capped at weight)" : ""}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save log.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setSaved(false);
    if (debounceRef) clearTimeout(debounceRef);
    const timer = setTimeout(() => save(newValue), 1000);
    setDebounceRef(timer);
  };

  const handleBlur = () => {
    if (debounceRef) clearTimeout(debounceRef);
    save(value);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="—"
          className="w-24 text-center tabular-nums"
          aria-label={`Log actual value for task (target: ${targetValue} ${unit})`}
          aria-invalid={error ? true : undefined}
        />
        {saved && (
          <Check
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-liquid-success"
            aria-hidden="true"
          />
        )}
        {saving && (
          <Loader2
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-liquid-accent animate-spin"
            aria-hidden="true"
          />
        )}
      </div>
      <span className="text-xs text-liquid-text-subtle w-12" aria-hidden="true">
        {unit}
      </span>
      {error && (
        <span className="sr-only" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

interface SortableTaskRowProps {
  task: TaskDTO;
  breakdown: TaskBreakdownDTO | undefined;
  date: string;
  onLogUpdated: (actualValue: number | null, taskScore: number) => void;
  announceLive: (message: string) => void;
}

function SortableTaskRow({
  task,
  breakdown,
  date,
  onLogUpdated,
  announceLive
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const score = breakdown?.taskScore ?? 0;
  const tier = ratingTier(score);
  const capped = breakdown?.capped ?? false;
  const missed = breakdown?.missed ?? true;
  const actualValue = breakdown?.actualValue ?? null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "liquid-glass-subtle p-4 flex items-center gap-3 transition-shadow",
        isDragging && "dnd-dragging"
      )}
    >
      <button
        type="button"
        className="dnd-drag-handle focus-ring text-liquid-text-subtle hover:text-liquid-text"
        aria-label={`Reorder task: ${task.title}. Press space to grab, arrow keys to move, space to drop.`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" aria-hidden="true" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-liquid-text truncate">
            {task.title}
          </span>
          {capped && (
            <Badge tone="accent" aria-label="Score capped at importance weight">
              capped
            </Badge>
          )}
          {missed && actualValue === null && (
            <Badge tone="warning" aria-label="No log yet">
              missed
            </Badge>
          )}
        </div>
        <div className="text-xs text-liquid-text-subtle mt-0.5">
          {task.scheduledStart}–{task.scheduledEnd} · target {task.targetValue}{" "}
          {task.unit} · weight {task.importanceWeight}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <LogInput
          taskId={task.id}
          date={date}
          initialActual={actualValue}
          targetValue={task.targetValue}
          unit={task.unit}
          onSaved={onLogUpdated}
          announceLive={announceLive}
        />
        <div className="text-right">
          <span
            className={cn("text-sm font-semibold tabular-nums", `rating-tier-${tier}`)}
            aria-hidden="true"
          >
            {score.toFixed(2)}
          </span>
          <span className="text-xs text-liquid-text-subtle ml-1">
            / {task.importanceWeight}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DailyTaskTable({
  date,
  tasks,
  breakdown,
  onLogUpdated,
  onReorder
}: DailyTaskTableProps) {
  const [orderedTasks, setOrderedTasks] = useState<TaskDTO[]>(tasks);
  const [reordering, setReordering] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    setOrderedTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setReordering(true);
    const oldIndex = orderedTasks.findIndex((t) => t.id === active.id);
    const newIndex = orderedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      setReordering(false);
      return;
    }

    const reordered = arrayMove(orderedTasks, oldIndex, newIndex);
    setOrderedTasks(reordered);

    const movedTask = reordered[newIndex];
    if (movedTask) {
      setLiveMessage(
        `Moved ${movedTask.title} to position ${newIndex + 1} of ${reordered.length}.`
      );
    }

    try {
      const projectId = reordered[0]?.projectId;
      if (!projectId) {
        setReordering(false);
        return;
      }
      await api.tasks.reorder({
        projectId,
        taskIds: reordered.map((t) => t.id)
      });
      onReorder();
    } catch {
      setOrderedTasks(tasks);
      setLiveMessage("Reorder failed. Restored original order.");
    } finally {
      setReordering(false);
    }
  };

  const announceLive = (message: string) => {
    setLiveMessage(message);
  };

  const handleLogUpdated = (_actualValue: number | null, _taskScore: number) => {
    onLogUpdated();
  };

  if (orderedTasks.length === 0) {
    return (
      <EmptyState
        title="No tasks yet"
        message="Create your first task to start tracking your daily momentum."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {orderedTasks.map((task) => {
              const taskBreakdown = breakdown?.find((b) => b.taskId === task.id);
              return (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  breakdown={taskBreakdown}
                  date={date}
                  onLogUpdated={handleLogUpdated}
                  announceLive={announceLive}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {reordering && (
        <div className="flex items-center justify-center gap-2 text-sm text-liquid-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Saving order…
        </div>
      )}
    </div>
  );
}

export function DailyTaskTableSkeleton() {
  return (
    <div className="space-y-2">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

export function DailyTaskTableError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Couldn't load tasks"
      message="We couldn't fetch your tasks for today. Please try again."
      onRetry={onRetry}
    />
  );
}
