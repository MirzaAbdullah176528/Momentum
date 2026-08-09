import { Hono } from "hono";
import { z } from "zod";
import { createScopedDb } from "@momentum/db";
import {
  type UserDTO,
  type UpdateUserInputDTO,
  type ApiResponse
} from "@momentum/shared-types";
import type { AppContext } from "../types.js";
import { ok, validationError } from "../lib/http.js";
import { toIso } from "../lib/date.js";

const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  image: z.string().url().nullable().optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  timezone: z.string().min(1).optional()
});

function rowToDto(row: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean | number;
  image: string | null;
  username: string;
  timezone: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}): UserDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: Boolean(row.emailVerified),
    image: row.image,
    username: row.username,
    timezone: row.timezone,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt)
  };
}

export const userRoute = new Hono<AppContext>();

userRoute.get("/", async (c) => {
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const row = await scoped.currentUser();
  if (!row) {
    return ok(c, null as unknown as UserDTO);
  }
  return ok(c, rowToDto(row));
});

userRoute.patch("/", async (c) => {
  const parsed = updateUserSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return validationError(c, "Invalid user payload.", parsed.error.flatten());
  }
  const input: UpdateUserInputDTO = parsed.data;
  const scoped = await createScopedDb(c.env.DB, c.get("userId"));
  const updated = await scoped.updateUser(input);
  if (!updated) {
    return ok(c, null as unknown as UserDTO);
  }
  return ok(c, rowToDto(updated));
});

export type UserRouteType = typeof userRoute;
export type { ApiResponse, UserDTO };
