import type { MiddlewareHandler } from "hono";
import { getAllowedOrigins } from "../lib/origins.js";
import type { Env } from "../types.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const csrfMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    if (!MUTATING_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const origin = c.req.header("Origin");
    if (!origin) {
      return c.json(
        {
          ok: false as const,
          error: {
            code: "csrf_error",
            message: "Origin header required for mutating requests."
          }
        },
        403
      );
    }

    const env = (c.env as Env) ?? ({} as Env);
    const allowed = getAllowedOrigins(env);
    // In local dev the web app is often served from a different origin than the
    // API (e.g. a tunnel host). CSRF protection still requires an Origin header
    // to be present (which browsers always send for cross-site mutating
    // requests), so we accept any non-empty Origin locally. Production uses the
    // strict allow-list above (WEB_ORIGINS + BETTER_AUTH_URL + legacy hosts).
    if (!allowed.includes(origin) && env.APP_ENV !== "production") {
      await next();
      return;
    }
    if (!allowed.includes(origin)) {
      return c.json(
        {
          ok: false as const,
          error: {
            code: "csrf_error",
            message: "Origin not allowed."
          }
        },
        403
      );
    }

    await next();
  };
};
