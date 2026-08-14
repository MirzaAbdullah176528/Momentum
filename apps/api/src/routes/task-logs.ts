import { Hono } from "hono";
import { z } from "zod";
import { createScopedDb } from "@momentum/db";
import { computeTaskScore, computeDailyRating } from "@momentum/rating-engine";
import type {
  TaskLogDTO,
  UpsertTaskLogInputDTO,
  DailyRatingDTO,
  DailyRatingWithBreakdownDTO,
  TaskBreakdownDTO,
  TaskUnit,
  ScaleType,
  ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, notFound, validationError } from "../lib/http.js";
import { toIso } from "../lib/date.js";
import { MUTATING_ENDPOINT_RATE_LIMIT } from "../middleware/rate-limit.js";

const PKT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const upsertTaskLogSchema = z.object({
  taskId: z.string().min(1),
  date: z.string().regex(PKT_DATE_REGEX),
  actualValue: z.number().nullable()
});

function rowToDto(row: {
  id: string;
  taskId: string;
  userId: string;
  date: string;
  actualValue: number | null;
  taskScore: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): TaskLogDTO {
  return {
    id: row.id,
    taskId: row.taskId,
    userId: row.userId,
    date: row.date,
    actualValue: row.actualValue,
    taskScore: row.taskScore,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

export const taskLogs = new Hono<AppContext>();

taskLogs.get("/by-date/:date", async (c) => {
  const date = c.req.param("date");
  if (!PKT_DATE_REGEX.test(date)) {
    return validationError(c, "date must be YYYY-MM-DD.", { date });
  }
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const rows = await scoped.taskLogsByDate(date);
  return ok(c, rows.map(rowToDto));
});

taskLogs.get("/by-task/:taskId", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const taskId = c.req.param("taskId");
  const task = await scoped.taskById(taskId);
  if (!task) return notFound(c, `Task ${taskId} not found.`);
  const rows = await scoped.taskLogsByTask(taskId);
  return ok(c, rows.map(rowToDto));
});

taskLogs.put("/", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const parsed = upsertTaskLogSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(
      c,
      "Invalid task log payload.",
      parsed.error.flatten()
    );
  }
  const input: UpsertTaskLogInputDTO = parsed.data;

  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const task = await scoped.taskById(input.taskId);
  if (!task) return notFound(c, `Task ${input.taskId} not found.`);

  const taskScore = computeTaskScore({
    actualValue: input.actualValue,
    targetValue: task.targetValue,
    importanceWeight: task.importanceWeight,
    unit: task.unit as TaskUnit,
    scaleType: task.scaleType as ScaleType
  });

  const upserted = await scoped.upsertTaskLog(input.taskId, input.date, {
    actualValue: input.actualValue,
    taskScore
  });

  if (!upserted) {
    return ok(c, null as unknown as TaskLogDTO);
  }
  return ok(c, rowToDto(upserted));
});

taskLogs.delete("/:id", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");
  const existing = await scoped.taskLogById(id);
  if (!existing) return notFound(c, `Task log ${id} not found.`);
  await scoped.deleteTaskLog(id);
  return ok(c, { id });
});

taskLogs.get("/daily-rating/:date", async (c) => {
  const date = c.req.param("date");
  if (!PKT_DATE_REGEX.test(date)) {
    return validationError(c, "date must be YYYY-MM-DD.", { date });
  }
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const tasksWithLogs = await scoped.tasksWithLogsForDate(date);

  const tasks: TaskBreakdownDTO[] = tasksWithLogs.map(({ task, log }) => {
    const actualValue = log?.actualValue ?? null;
    const taskScore = computeTaskScore({
      actualValue,
      targetValue: task.targetValue,
      importanceWeight: task.importanceWeight,
      unit: task.unit as TaskUnit,
      scaleType: task.scaleType as ScaleType
    });
    return {
      taskId: task.id,
      title: task.title,
      targetValue: task.targetValue,
      unit: task.unit as TaskBreakdownDTO["unit"],
      importanceWeight: task.importanceWeight,
      actualValue,
      taskScore,
      capped: taskScore >= task.importanceWeight && actualValue !== null && actualValue > 0,
      missed: actualValue === null || actualValue <= 0
    };
  });

  const result = computeDailyRating(
    tasksWithLogs.map(({ task, log }) => ({
      actualValue: log?.actualValue ?? null,
      targetValue: task.targetValue,
      importanceWeight: task.importanceWeight,
      unit: task.unit as TaskUnit,
      scaleType: task.scaleType as ScaleType
    })),
    date
  );

  const dto: DailyRatingWithBreakdownDTO = {
    pktDate: date,
    rating: result.rating,
    taskCount: result.taskCount,
    totalWeight: result.totalWeight,
    totalScore: result.totalScore,
    tasks
  };

  return ok(c, dto);
});

export type TaskLogsRoute = typeof taskLogs;
export type { ApiResponse, TaskLogDTO, DailyRatingDTO, DailyRatingWithBreakdownDTO };
