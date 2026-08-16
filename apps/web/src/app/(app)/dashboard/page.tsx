"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, FolderPlus } from "lucide-react";
import { useAsyncData } from "@/hooks/use-async-data";
import { api } from "@/lib/api";
import { nowPktDateString } from "@momentum/rating-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingBadge, ratingTier } from "@/components/ui/rating";
import { LiveRegion } from "@/components/ui/live-region";
import {
  DailyTaskTable,
  DailyTaskTableSkeleton,
  DailyTaskTableError
} from "@/components/tasks/daily-task-table";
import { TaskModal } from "@/components/tasks/task-modal";
import { ProjectModal } from "@/components/tasks/project-modal";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const today = useMemo(() => nowPktDateString(), []);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const projectsData = useAsyncData(
    () => api.projects.list(),
    [refreshKey]
  );
  const tasksData = useAsyncData(
    () => api.tasks.list(),
    [refreshKey]
  );
  const ratingData = useAsyncData(
    () => api.taskLogs.dailyRating(today),
    [refreshKey]
  );

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleLogUpdated = useCallback(() => {
    ratingData.refetch();
    setLiveMessage("Rating updated.");
  }, [ratingData]);

  const projects = projectsData.data ?? [];
  const tasks = tasksData.data ?? [];
  const rating = ratingData.data;
  const loading =
    projectsData.loading || tasksData.loading || ratingData.loading;
  const error = projectsData.error ?? tasksData.error ?? ratingData.error;

  const canCreateTask = projects.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2 animate-fade-rise">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-liquid-text-muted">{today}</p>
            <h1 className="text-2xl font-bold text-liquid-text tracking-tight">Today</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="glass"
              size="sm"
              onClick={() => setProjectModalOpen(true)}
            >
              <FolderPlus className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">New project</span>
              <span className="sr-only">Create new project</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setTaskModalOpen(true)}
              disabled={!canCreateTask}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">New task</span>
              <span className="sr-only">Create new task</span>
            </Button>
          </div>
        </div>
      </header>

      <LiveRegion message={liveMessage} />

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <DailyTaskTableSkeleton />
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load dashboard"
          message={error}
          onRetry={refresh}
        />
      ) : (
        <>
          <section
            className="liquid-glass-strong p-6 flex items-center justify-between gap-6 animate-fade-rise"
            aria-labelledby="rating-heading"
          >
            <div className="space-y-1.5">
              <h2
                id="rating-heading"
                className="text-sm font-medium text-liquid-text-muted uppercase tracking-wide"
              >
                Daily Rating
              </h2>
              {rating ? (
                <RatingBadge rating={rating.rating} size="xl" showLabel />
              ) : (
                <RatingBadge rating={0} size="xl" />
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {rating && rating.taskCount > 0 ? (
                  <>
                    <Badge tone="neutral">
                      {rating.taskCount} task{rating.taskCount === 1 ? "" : "s"}
                    </Badge>
                    <Badge tone="neutral">
                      Σ weight {rating.totalWeight.toFixed(1)}
                    </Badge>
                    <Badge tone="neutral">
                      Σ score {rating.totalScore.toFixed(2)}
                    </Badge>
                  </>
                ) : (
                  <Badge tone="neutral">No tasks logged</Badge>
                )}
              </div>
            </div>
            <div
              className="hidden sm:flex flex-col items-center justify-center w-32 h-32 rounded-full liquid-glass-subtle"
              aria-hidden="true"
            >
              <div
                className={`text-5xl font-bold tabular-nums rating-tier-${
                  rating ? ratingTier(rating.rating) : "f"
                }`}
              >
                {rating ? rating.rating.toFixed(0) : "0"}
              </div>
              <div className="text-xs text-liquid-text-subtle mt-1">out of 10</div>
            </div>
          </section>

          <section aria-labelledby="tasks-heading" className="animate-fade-rise">
            <div className="flex items-center justify-between mb-3">
              <h2
                id="tasks-heading"
                className="text-lg font-semibold text-liquid-text"
              >
                Tasks
              </h2>
              {!canCreateTask && (
                <p className="text-xs text-liquid-text-subtle">
                  Create a project first
                </p>
              )}
            </div>

            {tasksData.loading ? (
              <DailyTaskTableSkeleton />
            ) : tasksData.error ? (
              <DailyTaskTableError onRetry={tasksData.refetch} />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={<Plus className="w-6 h-6 text-liquid-accent" />}
                title="No tasks yet"
                message="Create your first task to start tracking your daily momentum. Each task contributes to your daily 0.0–10.0 rating."
                action={{
                  label: "Create task",
                  onClick: () => setTaskModalOpen(true)
                }}
              />
            ) : (
              <DailyTaskTable
                date={today}
                tasks={tasks}
                breakdown={rating?.tasks ?? null}
                onLogUpdated={handleLogUpdated}
                onReorder={refresh}
              />
            )}
          </section>
        </>
      )}

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSaved={refresh}
        projects={projects}
        defaultProjectId={projects[0]?.id}
      />
      <ProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
