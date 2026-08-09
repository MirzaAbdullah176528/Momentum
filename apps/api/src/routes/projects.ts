import { Hono } from "hono";
import { z } from "zod";
import { createScopedDb } from "@momentum/db";
import {
  DEFAULT_PROJECT_COLOR,
  type ProjectDTO,
  type CreateProjectInputDTO,
  type UpdateProjectInputDTO,
  type ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, notFound, validationError } from "../lib/http.js";
import { toIso } from "../lib/date.js";
import { MUTATING_ENDPOINT_RATE_LIMIT } from "../middleware/rate-limit.js";

const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
});

function rowToDto(row: {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): ProjectDTO {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    color: row.color,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

export const projects = new Hono<AppContext>();

projects.get("/", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const rows = await scoped.projects();
  return ok(c, rows.map(rowToDto));
});

projects.get("/:id", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const row = await scoped.projectById(c.req.param("id"));
  if (!row) return notFound(c, `Project ${c.req.param("id")} not found.`);
  return ok(c, rowToDto(row));
});

projects.post("/", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const parsed = createProjectSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(c, "Invalid project payload.", parsed.error.flatten());
  }
  const input: CreateProjectInputDTO = {
    name: parsed.data.name,
    color: parsed.data.color ?? DEFAULT_PROJECT_COLOR
  };
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const created = await scoped.insertProject(input);
  return ok(c, rowToDto(created), 201);
});

projects.patch("/:id", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const parsed = updateProjectSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(c, "Invalid update payload.", parsed.error.flatten());
  }
  const input: UpdateProjectInputDTO = parsed.data;
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");

  const existing = await scoped.projectById(id);
  if (!existing) return notFound(c, `Project ${id} not found.`);

  const updated = await scoped.updateProject(id, input);
  if (!updated) return notFound(c, `Project ${id} not found after update.`);
  return ok(c, rowToDto(updated));
});

projects.delete("/:id", MUTATING_ENDPOINT_RATE_LIMIT, async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const id = c.req.param("id");
  const existing = await scoped.projectById(id);
  if (!existing) return notFound(c, `Project ${id} not found.`);
  await scoped.deleteProject(id);
  return ok(c, { id });
});

export type ProjectsRoute = typeof projects;
export type { ApiResponse, ProjectDTO };
