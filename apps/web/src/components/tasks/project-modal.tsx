"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import type { ProjectDTO } from "@momentum/shared-types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  project?: ProjectDTO | null;
}

const COLOR_PRESETS = [
  "#7c5cff",
  "#38bdf8",
  "#4ade80",
  "#fbbf24",
  "#f87171",
  "#f472b6",
  "#a78bfa",
  "#94a3b8"
];

export function ProjectModal({
  open,
  onClose,
  onSaved,
  project
}: ProjectModalProps) {
  const isEditing = Boolean(project);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLOR_PRESETS[0] ?? "#7c5cff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setColor(project?.color ?? COLOR_PRESETS[0] ?? "#7c5cff");
      setError(null);
    }
  }, [open, project]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing && project) {
        await api.projects.update(project.id, { name, color });
      } else {
        await api.projects.create({ name, color });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit project" : "New project"}
      description="Group related tasks under a project."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning Routine"
          required
          maxLength={120}
          autoFocus
        />

        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-liquid-text-secondary mb-2">
            Color
          </legend>
          <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="Project color">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className="focus-ring w-8 h-8 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? "2px solid white" : "none",
                  outlineOffset: "2px"
                }}
              />
            ))}
          </div>
        </fieldset>

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
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Create project"
            )}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
