"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2, Plus, FolderPlus } from "lucide-react";
import { useAsyncData } from "@/hooks/use-async-data";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ProjectDTO, UpdateSeasonInputDTO } from "@momentum/shared-types";
import { INCLUDED_DAYS_ALL } from "@momentum/shared-types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { IncludedDaysPicker, describeIncludedDays } from "@/components/season/included-days-picker";
import { ProjectModal } from "@/components/tasks/project-modal";

export default function SettingsPage() {
  const { session } = useAuth();
  const projectsData = useAsyncData(() => api.projects.list(), []);
  const seasonData = useAsyncData(() => api.seasons.current(), []);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectDTO | null>(null);

  const refresh = useCallback(() => {
    projectsData.refetch();
    seasonData.refetch();
  }, [projectsData, seasonData]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2 animate-fade-rise">
        <h1 className="text-2xl font-bold text-liquid-text tracking-tight">Settings</h1>
        <p className="text-sm text-liquid-text-muted">
          Manage your profile, season target, and projects.
        </p>
      </header>

      <ProfileSection
        name={session?.user.name ?? ""}
        username={session?.user.username ?? ""}
        timezone={session?.user.timezone ?? ""}
      />

      <SeasonSettingsSection
        season={seasonData.data?.season ?? null}
        loading={seasonData.loading}
        error={seasonData.error}
        onRetry={seasonData.refetch}
        onSaved={refresh}
      />

      <ProjectsSection
        projects={projectsData.data ?? []}
        loading={projectsData.loading}
        error={projectsData.error}
        onRetry={projectsData.refetch}
        onEdit={(p) => {
          setEditingProject(p);
          setProjectModalOpen(true);
        }}
        onNew={() => {
          setEditingProject(null);
          setProjectModalOpen(true);
        }}
        onDeleted={refresh}
      />

      <ProjectModal
        open={projectModalOpen}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSaved={refresh}
        project={editingProject}
      />
    </div>
  );
}

function ProfileSection({
  name,
  username,
  timezone
}: {
  name: string;
  username: string;
  timezone: string;
}) {
  const [editingName, setEditingName] = useState(name);
  const [editingUsername, setEditingUsername] = useState(username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEditingName(name);
    setEditingUsername(username);
  }, [name, username]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.user.update({
        name: editingName,
        username: editingUsername
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="liquid-glass p-6 space-y-4"
      aria-labelledby="profile-heading"
    >
      <h2
        id="profile-heading"
        className="text-lg font-semibold text-liquid-text"
      >
        Profile
      </h2>
      <form onSubmit={handleSave} className="space-y-4">
        <Input
          label="Display name"
          type="text"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          required
          maxLength={120}
        />
        <Input
          label="Username"
          type="text"
          value={editingUsername}
          onChange={(e) => setEditingUsername(e.target.value)}
          required
          hint="Visible on the leaderboard."
        />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-liquid-text-secondary">
            Timezone
          </label>
          <div className="px-4 py-2.5 rounded-xl border border-liquid-border bg-white/[0.02] text-sm text-liquid-text-muted">
            {timezone} (PKT, UTC+5 — fixed)
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-liquid-danger">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save profile"
            )}
          </Button>
          {saved && (
            <span className="text-sm text-liquid-success" role="status">
              Saved
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function SeasonSettingsSection({
  season,
  loading,
  error,
  onRetry,
  onSaved
}: {
  season: { id: string; targetRating: number; rewardText: string; includedDays: number } | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSaved: () => void;
}) {
  const [targetRating, setTargetRating] = useState("8.0");
  const [rewardText, setRewardText] = useState("");
  const [includedDays, setIncludedDays] = useState<number>(INCLUDED_DAYS_ALL);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (season) {
      setTargetRating(String(season.targetRating));
      setRewardText(season.rewardText);
      setIncludedDays(season.includedDays);
    }
  }, [season]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!season) return;
    if (includedDays === 0) {
      setSaveError("Select at least one weekday to include.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input: UpdateSeasonInputDTO = {
        targetRating: Number(targetRating),
        rewardText,
        includedDays
      };
      await api.seasons.update(season.id, input);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save season settings."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="liquid-glass p-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <ErrorState
          title="Couldn't load season"
          message={error}
          onRetry={onRetry}
        />
      </section>
    );
  }

  if (!season) {
    return (
      <section>
        <EmptyState
          title="No active season"
          message="Create a season to set a target rating and reward."
        />
      </section>
    );
  }

  return (
    <section
      className="liquid-glass p-6 space-y-4"
      aria-labelledby="season-settings-heading"
    >
      <h2
        id="season-settings-heading"
        className="text-lg font-semibold text-liquid-text"
      >
        Season Settings
      </h2>
      <form onSubmit={handleSave} className="space-y-4">
        <Input
          label="Target rating (0–10)"
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={targetRating}
          onChange={(e) => setTargetRating(e.target.value)}
          required
          hint="Your daily-average goal for the season."
        />
        <Textarea
          label="Reward"
          value={rewardText}
          onChange={(e) => setRewardText(e.target.value)}
          placeholder="e.g. New mechanical keyboard"
          required
          maxLength={500}
          rows={2}
          hint="Treat yourself when you hit the target."
        />

        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-liquid-text-secondary">
            Schedule ({describeIncludedDays(includedDays)})
          </legend>
          <p className="text-xs text-liquid-text-subtle">
            Pick which weekdays count toward your average. Excluded days never count (not even as a zero).
          </p>
          <IncludedDaysPicker value={includedDays} onChange={setIncludedDays} />
        </fieldset>

        {saveError && (
          <p role="alert" className="text-sm text-liquid-danger">
            {saveError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save season settings"
            )}
          </Button>
          {saved && (
            <span className="text-sm text-liquid-success" role="status">
              Saved
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function ProjectsSection({
  projects,
  loading,
  error,
  onRetry,
  onEdit,
  onNew,
  onDeleted
}: {
  projects: ProjectDTO[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (p: ProjectDTO) => void;
  onNew: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.projects.delete(id);
      onDeleted();
    } catch {
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section
      className="liquid-glass p-6 space-y-4"
      aria-labelledby="projects-heading"
    >
      <div className="flex items-center justify-between">
        <h2
          id="projects-heading"
          className="text-lg font-semibold text-liquid-text"
        >
          Projects
        </h2>
        <Button variant="glass" size="sm" onClick={onNew}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          New
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Couldn't load projects" message={error} onRetry={onRetry} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlus className="w-6 h-6 text-liquid-accent" />}
          title="No projects"
          message="Create a project to group your tasks."
          action={{ label: "New project", onClick: onNew }}
        />
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="liquid-glass-subtle p-3 flex items-center gap-3"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
                aria-hidden="true"
              />
              <span className="flex-1 font-medium text-liquid-text">
                {project.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(project)}
                aria-label={`Edit project ${project.name}`}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(project.id)}
                disabled={deleting === project.id}
                aria-label={`Delete project ${project.name}`}
                className="text-liquid-danger hover:text-liquid-danger"
              >
                {deleting === project.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
