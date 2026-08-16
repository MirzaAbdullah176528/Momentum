import type { Env } from "../types.js";

const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function splitOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(env: Env): string[] {
  const origins = new Set<string>();

  if (env.BETTER_AUTH_URL) origins.add(env.BETTER_AUTH_URL);

  if (env.APP_ENV === "production") {
    for (const o of splitOrigins(env.WEB_ORIGINS)) origins.add(o);
  } else {
    for (const o of splitOrigins(env.WEB_DEV_ORIGINS)) origins.add(o);
  }

  for (const o of LOCAL_DEV_ORIGINS) origins.add(o);

  return [...origins];
}
