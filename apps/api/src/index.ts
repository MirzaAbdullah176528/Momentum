import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { tasks } from "./routes/tasks.js";
import { seasons } from "./routes/seasons.js";
import { projects } from "./routes/projects.js";
import { taskLogs } from "./routes/task-logs.js";
import { userRoute } from "./routes/user.js";
import { analytics } from "./routes/analytics.js";
import { leaderboard } from "./routes/leaderboard.js";
import { authMiddleware } from "./middleware/auth.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { csrfMiddleware } from "./middleware/csrf.js";
import { AUTH_ENDPOINT_RATE_LIMIT } from "./middleware/rate-limit.js";
import { createAuth } from "./lib/auth.js";
import type { AppContext, Env } from "./types.js";

const app = new Hono<AppContext>();

/**
 * Map a thrown error to a short, user-facing JSON error shape. Used by the
 * global onError handler and the auth-handler wrapper so the same clear
 * messages surface everywhere instead of a generic "An unexpected error
 * occurred." Safe to expose: keys only on stable SQLite text, never returns
 * the raw query or stack.
 */
function classifyError(raw: string, isLocal: boolean): {
  code: string;
  message: string;
  status: 200 | 409 | 500 | 503;
} {
  const lower = raw.toLowerCase();
  if (lower.includes("no such column") || lower.includes("no such table")) {
    return {
      code: "db_migration_required",
      message: isLocal
        ? "The database needs a migration. Run \u201Cnpm run db:apply:local\u201D (from apps/api), then restart the server."
        : "The database is missing a required update. Please apply pending migrations and retry.",
      status: 503
    };
  }
  if (lower.includes("sqlite_constraint") || lower.includes("unique constraint")) {
    return {
      code: "constraint_violation",
      message: "That value conflicts with existing data. Try a different value.",
      status: 409
    };
  }
  return { code: "internal_error", message: "An unexpected error occurred.", status: 500 };
}

app.use("*", logger());
app.use("*", securityHeaders());
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const env = (c.env as Env) ?? ({} as Env);
      const isProduction = env.APP_ENV === "production";
      const allowed = isProduction
        ? ["https://momentum-by-abdullah-hassan.vercel.app", "https://momentum-by-abdullah-hassan.vercel.app"]
        : ["http://localhost:3000", "http://127.0.0.1:3000"];
      if (!origin || allowed.includes(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);
app.use("*", csrfMiddleware());

app.get("/health", (c) =>
  c.json({
    ok: true,
    data: {
      service: "momentum-api",
      env: c.env.APP_ENV ?? "local",
      timestamp: new Date().toISOString()
    }
  })
);

// Better-auth catches its own DB errors and returns an empty 5xx response,
// which hides the real cause ("no such table/column") from the user. Run its
// handler through a wrapper that, on a thrown DB-schema error, returns the
// same clear, actionable JSON shape the rest of the API uses.
async function handleAuth(c: Context<AppContext>): Promise<Response> {
  const auth = createAuth(c.env);
  const isLocal = c.env?.APP_ENV !== "production";
  try {
    const response = await auth.handler(c.req.raw);
    // Better-auth catches its own DB errors internally and returns an empty
    // 5xx response, hiding the real cause. When we get a server error with no
    // usable body, replace it with the same clear, actionable JSON shape the
    // rest of the API uses. On a correctly-migrated DB this branch is never
    // hit because better-auth returns well-formed responses.
    if (response.status >= 500) {
      const text = await response.text();
      const trimmed = text.trim();
      if (!trimmed || trimmed === "{}" || trimmed.startsWith("<")) {
        return c.json(
          {
            ok: false,
            error: {
              code: "db_migration_required",
              message: isLocal
                ? "The database needs a migration. Run \u201Cnpm run db:apply:local\u201D (from apps/api), then restart the server."
                : "The database is missing a required update. Please apply pending migrations and retry."
            }
          },
          503
        );
      }
      return new Response(text, {
        status: response.status,
        headers: response.headers
      });
    }
    return response;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[momentum-api] auth handler error:", err);
    const { code, message, status } = classifyError(raw, isLocal);
    return c.json({ ok: false, error: { code, message } }, status);
  }
}

app.all("/api/auth/sign-up/*", AUTH_ENDPOINT_RATE_LIMIT, (c) => handleAuth(c));
app.all("/api/auth/sign-in/*", AUTH_ENDPOINT_RATE_LIMIT, (c) => handleAuth(c));
app.all("/api/auth/request-password-reset", AUTH_ENDPOINT_RATE_LIMIT, (c) =>
  handleAuth(c)
);
app.all("/api/auth/reset-password", AUTH_ENDPOINT_RATE_LIMIT, (c) =>
  handleAuth(c)
);
app.all("/api/auth/*", (c) => handleAuth(c));

const api = new Hono<AppContext>();
api.use("*", authMiddleware);
api.route("/user", userRoute);
api.route("/seasons", seasons);
api.route("/projects", projects);
api.route("/tasks", tasks);
api.route("/task-logs", taskLogs);
api.route("/analytics", analytics);
api.route("/leaderboard", leaderboard);

app.route("/api", api);

app.notFound((c) =>
  c.json(
    { ok: false, error: { code: "not_found", message: "Route not found." } },
    404
  )
);

app.onError((err, c) => {
  console.error("[momentum-api] unhandled error:", err);
  const raw = err instanceof Error ? err.message : String(err);
  const { code, message, status } = classifyError(
    raw,
    c.env?.APP_ENV !== "production"
  );
  return c.json({ ok: false, error: { code, message } }, status);
});

export default app;
export type { Env };
