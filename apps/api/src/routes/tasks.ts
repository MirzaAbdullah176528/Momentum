import { Hono } from "hono";
import { z } from "zod";
import { createScopedDb } from "@momentum/db";
import {
  TASK_UNITS,
  TASK_IMPORTANCE_WEIGHT_MIN,
  TASK_IMPORTANCE_WEIGHT_MAX,
  type TaskDTO,
  type CreateTaskInputDTO,
  type UpdateTaskInputDTO,
  type ReorderTasksInputDTO,
  type TaskUnit,
  type ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, notFound, validationError, forbidden } from "../lib/http.js";
import { toIso } from "../lib/date.js";
import { MUTATING_ENDPOINT_RATE_LIMIT } from "../middleware/rate-limit.js";

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(280),
  targetValue: z.number().positive(),
  unit: z.enum(TASK_UNITS),
  importanceWeight: z
    .number()
    .int()
    .min(TASK_IMPORTANCE_WEIGHT_MIN)
    .max(TASK_IMPORTANCE_WEIGHT_MAX),
  sortOrder: z.number().int().optional(),
  scheduledStart: z.string().regex(HH_MM_REGEX),
  scheduledEnd: z.string().regex(HH_MM_REGEX)
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(280).optional(),
    sortOrder: z.number().int().optional(),
    scheduledStart: z.string().regex(HH_MM_REGEX).optional(),
    scheduledEnd: z.string().regex(HH_MM_REGEX).optional(),
    targetValue: z.never().optional(),
    unit: z.never().optional(),
    importanceWeight: z.never().optional(),
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
  const parsed = updateTaskSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const attemptedImmutable = issues.find(
      (i) => i.code === "invalid_type" && i.path.length > 0
    );
    if (attemptedImmutable) {
      const field = attemptedImmutable.path[0];
      return forbidden(
        c,
        `Field '${field}' is immutable and cannot be changed after task creation.`
      );
    }
    return validationError(c, "Invalid update payload.", parsed.error.flatten());
  }

  const input: UpdateTaskInputDTO = parsed.data;
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");

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
