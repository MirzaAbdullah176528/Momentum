import type { MiddlewareHandler } from "hono";
import type { Env } from "../types.js";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin"
};

function buildCsp(env: Env): string {
  const isProduction = env.APP_ENV === "production";
  const allowedOrigins = isProduction
    ? ["https://momentum-by-abdullah-hassan.vercel.app", "https://momentum-by-abdullah-hassan.vercel.app"]
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

  return [
    "default-src 'none'",
    `connect-src 'self' ${allowedOrigins.join(" ")}`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    "img-src 'self' data:",
    "style-src 'unsafe-inline'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; ");
}

export const securityHeaders = (): MiddlewareHandler => {
  return async (c, next) => {
    await next();

    const env = (c.env as Env) ?? ({} as Partial<Env> as Env);

    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      c.header(key, value);
    }

    c.header("Content-Security-Policy", buildCsp(env));

    if (env.APP_ENV === "production") {
      c.header(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload"
      );
    }
  };
};
