import { createMiddleware } from "hono/factory";
import { createAuth } from "../lib/auth.js";
import type { AppContext } from "../types.js";

export const authMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
    query: {
      disableCookieCache: true
    }
  });

  if (!session) {
    return c.json(
      {
        ok: false as const,
        error: {
          code: "unauthorized",
          message: "Authentication required."
        }
      },
      401
    );
  }

  c.set("userId", session.user.id);
  c.set("sessionId", session.session.id);
  await next();
});
