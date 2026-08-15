import type { Env } from "../types.js";

const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function splitOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The full set of browser origins trusted to call the API. A single source of
 * truth shared by better-auth's trustedOrigins, the CORS middleware, the CSRF
 * middleware, and the CSP connect-src list so all four agree.
 *
 * In production the list is:
 *   WEB_ORIGINS (comma-separated, configured per deployment) +
 *   BETTER_AUTH_URL +
 *   localhost (kept so local-only smoke tests against the prod worker still
 *   work; harmless in production).
 *
 * In local dev we additionally accept WEB_DEV_ORIGINS (tunnel hosts etc.) and
 * the localhost origins.
 */
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
