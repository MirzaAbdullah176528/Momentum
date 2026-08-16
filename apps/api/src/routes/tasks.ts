import { Hono } from "hono";
import { z } from "zod";
import { createScopedDb } from "@momentum/db";
import { nowPktDateString } from "@momentum/rating-engine";
import {
  TASK_UNITS,
  TASK_IMPORTANCE_WEIGHT_MIN,
  TASK_IMPORTANCE_WEIGHT_MAX,
  SCALE_TYPES,
  type TaskDTO,
  type CreateTaskInputDTO,
  type UpdateTaskInputDTO,
  type ReorderTasksInputDTO,
  type TaskUnit,
  type ScaleType,
  type ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, notFound, validationError, forbidden } from "../lib/http.js";
import { toIso } from "../lib/date.js";
import { MUTATING_ENDPOINT_RATE_LIMIT } from "../middleware/rate-limit.js";

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fields that are immutable after task creation, except on the first day of
 * the user's active season (today == season.startDate in PKT), when they may
 * be edited for that one day. Kept in sync with the unlock check below. */
const LOCKED_TASK_FIELDS = [
  "targetValue",
  "unit",
  "scaleType",
  "importanceWeight"
] as const;

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(280),
  targetValue: z.number().positive(),
  unit: z.enum(TASK_UNITS),
  scaleType: z.enum(SCALE_TYPES).default("target"),
  importanceWeight: z
    .number()
    .int()
    .min(TASK_IMPORTANCE_WEIGHT_MIN)
    .max(TASK_IMPORTANCE_WEIGHT_MAX),
  sortOrder: z.number().int().optional(),
  scheduledStart: z.string().regex(HH_MM_REGEX),
  scheduledEnd: z.string().regex(HH_MM_REGEX)
});

// Always-editable fields. Locked fields are merged in conditionally below.
const editableTaskFields = {
  title: z.string().min(1).max(280).optional(),
  sortOrder: z.number().int().optional(),
  scheduledStart: z.string().regex(HH_MM_REGEX).optional(),
  scheduledEnd: z.string().regex(HH_MM_REGEX).optional()
};

// When the season-day-1 unlock does NOT apply, locked fields are z.never() so
// sending them yields a 403 "immutable" — matching the original contract.
// projectId is never() here too (reassignment is a separate concern).
const updateTaskSchemaLocked = z
  .object({
    ...editableTaskFields,
    targetValue: z.never().optional(),
    unit: z.never().optional(),
    scaleType: z.never().optional(),
    importanceWeight: z.never().optional(),
    projectId: z.never().optional()
  })
  .strict();

// When the season-day-1 unlock DOES apply, locked fields are accepted (same
// validation as creation) and persisted. projectId remains never().
const updateTaskSchemaUnlocked = z
  .object({
    ...editableTaskFields,
    targetValue: z.number().positive().optional(),
    unit: z.enum(TASK_UNITS).optional(),
    scaleType: z.enum(SCALE_TYPES).optional(),
    importanceWeight: z
      .number()
      .int()
      .min(TASK_IMPORTANCE_WEIGHT_MIN)
      .max(TASK_IMPORTANCE_WEIGHT_MAX)
      .optional(),
    projectId: z.never().optional()
  })
  .strict();

const reorderTasksSchema = z.object({
  projectId: z.string().min(1),
  taskIds: z.array(z.string().min(1)).min(1).max(200)
});

function rowToDto(row: {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  targetValue: number;
  unit: string;
  scaleType: string;
  importanceWeight: number;
  sortOrder: number;
  scheduledStart: string;
  scheduledEnd: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): TaskDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    title: row.title,
    targetValue: row.targetValue,
    unit: row.unit as TaskUnit,
    scaleType: row.scaleType as ScaleType,
    importanceWeight: row.importanceWeight,
    sortOrder: row.sortOrder,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

export const tasks = new Hono<AppContext>();

tasks.get("/", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const projectId = c.req.query("projectId");
  const rows = projectId
    ? await scoped.tasksByProjectOrdered(projectId)
    : await scoped.tasksOrderedBySort();
  return ok(c, rows.map(rowToDto));
});

tasks.get("/:id", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const row = await scoped.taskById(c.req.param("id"));
  if (!row) return notFound(c, `Task ${c.req.param("id")} not found.`);
  return ok(c, rowToDto(row));
});

tasks.post("/", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const parsed = createTaskSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(c, "Invalid task payload.", parsed.error.flatten());
  }
  const input: CreateTaskInputDTO = {
    projectId: parsed.data.projectId,
    title: parsed.data.title,
    targetValue: parsed.data.targetValue,
    unit: parsed.data.unit,
    scaleType: parsed.data.scaleType,
    importanceWeight: parsed.data.importanceWeight,
    sortOrder: parsed.data.sortOrder,
    scheduledStart: parsed.data.scheduledStart,
    scheduledEnd: parsed.data.scheduledEnd
  };

  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const project = await scoped.projectById(input.projectId);
  if (!project) {
    return notFound(c, `Project ${input.projectId} not found.`);
  }

  const created = await scoped.insertTask(input);
  return ok(c, rowToDto(created), 201);
});

tasks.patch("/:id", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");

  // Season-day-1 unlock (query-time, not stored): locked task fields
  // (targetValue/unit/importanceWeight) are editable only when today (PKT)
  // equals the active season's startDate. No active season ⇒ always-immutable.
  const todayPkt = nowPktDateString();
  const activeSeason = await scoped.currentSeason(todayPkt);
  const canEditLockedFields = Boolean(
    activeSeason && activeSeason.startDate === todayPkt
  );
  const schema = canEditLockedFields
    ? updateTaskSchemaUnlocked
    : updateTaskSchemaLocked;

  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) {
    const issues = parsed.error.issues;
    // When locked, a present-but-forbidden field surfaces as an invalid_type
    // issue (from z.never()); map that to a 403 "immutable" to match the
    // existing contract. While unlocked, the same fields produce plain
    // validation errors.
    if (!canEditLockedFields) {
      const attemptedImmutable = issues.find(
        (i) =>
          i.code === "invalid_type" &&
          i.path.length > 0 &&
          (LOCKED_TASK_FIELDS as readonly string[]).includes(String(i.path[0]))
      );
      if (attemptedImmutable) {
        const field = attemptedImmutable.path[0];
        return forbidden(
          c,
          `Field '${field}' is immutable and cannot be changed after task creation.`
        );
      }
    }
    return validationError(c, "Invalid update payload.", parsed.error.flatten());
  }

  const input: UpdateTaskInputDTO = parsed.data;
  const existing = await scoped.taskById(id);
  if (!existing) return notFound(c, `Task ${id} not found.`);

  const updated = await scoped.updateTask(id, input);
  if (!updated) return notFound(c, `Task ${id} not found after update.`);
  return ok(c, rowToDto(updated));
});

tasks.delete("/:id", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");
  const existing = await scoped.taskById(id);
  if (!existing) return notFound(c, `Task ${id} not found.`);
  await scoped.deleteTask(id);
  return ok(c, { id });
});

tasks.post("/reorder", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const parsed = reorderTasksSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(
      c,
      "Invalid reorder payload.",
      parsed.error.flatten()
    );
  }
  const input: ReorderTasksInputDTO = parsed.data;
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));

  const project = await scoped.projectById(input.projectId);
  if (!project) {
    return notFound(c, `Project ${input.projectId} not found.`);
  }

  const projectTasks = await scoped.tasksByProjectOrdered(input.projectId);
  const projectTaskIds = new Set(projectTasks.map((t) => t.id));
  for (const taskId of input.taskIds) {
    if (!projectTaskIds.has(taskId)) {
      return forbidden(
        c,
        `Task ${taskId} does not belong to project ${input.projectId}.`
      );
    }
  }

  const updates = input.taskIds.map((taskId, index) => ({
    id: taskId,
    sortOrder: index
  }));
  await scoped.updateTaskSortOrders(updates);

  const reordered = await scoped.tasksByProjectOrdered(input.projectId);
  return ok(c, reordered.map(rowToDto));
});

export type TasksRoute = typeof tasks;
export type { ApiResponse, TaskDTO };
