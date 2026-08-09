import { Hono } from "hono";
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

app.use("*", logger());
app.use("*", securityHeaders());
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const env = (c.env as Env) ?? ({} as Env);
      const isProduction = env.APP_ENV === "production";
      const allowed = isProduction
        ? ["https://momentum.app", "https://app.momentum.app"]
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

app.all("/api/auth/sign-up/*", AUTH_ENDPOINT_RATE_LIMIT, async (c) => {
  const auth = createAuth(c.env);
  const response = await auth.handler(c.req.raw);
  return response;
});

app.all("/api/auth/sign-in/*", AUTH_ENDPOINT_RATE_LIMIT, async (c) => {
  const auth = createAuth(c.env);
  const response = await auth.handler(c.req.raw);
  return response;
});

app.all("/api/auth/request-password-reset", AUTH_ENDPOINT_RATE_LIMIT, async (c) => {
  const auth = createAuth(c.env);
  const response = await auth.handler(c.req.raw);
  return response;
});

app.all("/api/auth/reset-password", AUTH_ENDPOINT_RATE_LIMIT, async (c) => {
  const auth = createAuth(c.env);
  const response = await auth.handler(c.req.raw);
  return response;
});

app.all("/api/auth/*", async (c) => {
  const auth = createAuth(c.env);
  const response = await auth.handler(c.req.raw);
  return response;
});

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
  return c.json(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: "An unexpected error occurred."
      }
    },
    500
  );
});

export default app;
export type { Env };
