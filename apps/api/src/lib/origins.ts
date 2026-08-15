import type { Env } from "../types.js";

const LOCAL_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const LEGACY_PROD_ORIGINS = ["https://momentum.app", "https://app.momentum.app"];

function splitOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The full set of browser origins trusted to call the API. A single source of
 * truth shared by better-auth's trustedOrigins, the CORS middleware, and the
 * CSRF middleware so all three agree.
 *
 * In production the list is:
 *   WEB_ORIGINS (comma-separated, configured per deployment) +
 *   BETTER_AUTH_URL +
 *   the legacy momentum.app hosts (kept for back-compat).
 *
 * In local dev we additionally accept WEB_DEV_ORIGINS (tunnel hosts etc.) and
 * the localhost origins, and the CSRF middleware still requires an Origin
 * header to be present.
 */
export function getAllowedOrigins(env: Env): string[] {
  const origins = new Set<string>();

  if (env.BETTER_AUTH_URL) origins.add(env.BETTER_AUTH_URL);

  if (env.APP_ENV === "production") {
    for (const o of splitOrigins(env.WEB_ORIGINS)) origins.add(o);
    for (const o of LEGACY_PROD_ORIGINS) origins.add(o);
  } else {
    for (const o of splitOrigins(env.WEB_DEV_ORIGINS)) origins.add(o);
    for (const o of LOCAL_DEV_ORIGINS) origins.add(o);
  }

  return [...origins];
}
