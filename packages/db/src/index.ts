import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.js";
import { ScopedDb } from "./scoped.js";

export type Database = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

export async function createScopedDb(
  d1: D1Database,
  userId: string
): Promise<ScopedDb> {
  await d1.prepare("PRAGMA foreign_keys = ON;").run();
  const db = createDb(d1);
  return new ScopedDb(db, userId);
}

export { schema, ScopedDb };
export * from "./schema.js";
export * from "./scoped.js";
