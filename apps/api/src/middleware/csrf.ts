import type { MiddlewareHandler } from "hono";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getAllowedOrigins(env: { APP_ENV?: string; BETTER_AUTH_URL?: string }): string[] {
  const origins = new Set<string>();
  if (env.BETTER_AUTH_URL) {
    origins.add(env.BETTER_AUTH_URL);
  }
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  if (env.APP_ENV === "production") {
    origins.add("https://momentum.app");
    origins.add("https://app.momentum.app");
  }
  return [...origins];
}

function isLocalDev(env: { APP_ENV?: string }): boolean {
  return env.APP_ENV !== "production";
}

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

    const allowed = getAllowedOrigins(c.env as { APP_ENV?: string; BETTER_AUTH_URL?: string });
    // In local dev the web app is often served from a different origin than the
    // API (e.g. a tunnel host). CSRF protection still requires an Origin header
    // to be present (which browsers always send for cross-site mutating
    // requests), so we accept any non-empty Origin locally. Production keeps the
    // strict allow-list above.
    if (!allowed.includes(origin) && !isLocalDev(c.env as { APP_ENV?: string })) {
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
